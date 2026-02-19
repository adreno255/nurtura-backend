import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { RacksService } from './racks.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceStatus, ActivityEventType, NotificationType } from '../generated/prisma/client';
import { type CreateRackDto } from './dto/create-rack.dto';
import { type UpdateRackDto } from './dto/update-rack.dto';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { DeviceStatusDto, DeviceErrorDto, ErrorSeverity, SensorType } from './dto';
import {
    createMockDatabaseService,
    createMockEventEmitter,
    createMockLogger,
    createMockLogRackActivityHelper,
} from '../../test/mocks';

import {
    testDbIds,
    mockRack,
    mockRacks,
    validCreateRackDto,
    validUpdateRackDto,
    mockSensorReading,
    statusMessage,
    testMacAddresses,
    testRackIds,
} from '../../test/fixtures';

// Mock MqttMessageParser at module level
jest.mock('../common/utils/mqtt-parser.helper', () => ({
    MqttMessageParser: {
        parseAndValidate: jest.fn(),
    },
}));

import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';

describe('RacksService', () => {
    let service: RacksService;

    const testRackId = testRackIds.primary;
    const testMacAddress = testMacAddresses.valid;

    const createRackDto: CreateRackDto = validCreateRackDto;
    const updateRackDto: UpdateRackDto = validUpdateRackDto;

    const mockDatabaseService = createMockDatabaseService();
    const mockLoggerService = createMockLogger();
    const mockEventEmitter = createMockEventEmitter();
    const mockLogRackActivityHelper = createMockLogRackActivityHelper();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RacksService,
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: LogRackActivityHelper,
                    useValue: mockLogRackActivityHelper,
                },
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<RacksService>(RacksService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a rack successfully', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            const result = await service.create(testDbIds.primary, createRackDto);

            expect(result).toEqual({
                message: 'Rack registered successfully',
                rackId: mockRack.id,
            });
            expect(mockDatabaseService.rack.create).toHaveBeenCalledWith({
                data: {
                    userId: testDbIds.primary,
                    name: createRackDto.name,
                    macAddress: createRackDto.macAddress,
                    mqttTopic: expect.any(String) as string,
                    description: createRackDto.description,
                },
            });
        });

        it('should generate MQTT topic if not provided', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            const dtoWithoutTopic = { ...createRackDto };
            delete dtoWithoutTopic.mqttTopic;

            await service.create(testDbIds.primary, dtoWithoutTopic);

            expect(mockDatabaseService.rack.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    mqttTopic: `nurtura/rack/${createRackDto.macAddress.replace(/:/g, '-').toLowerCase()}`,
                }) as Partial<CreateRackDto>,
            });
        });

        it('should use custom MQTT topic if provided', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            await service.create(testDbIds.primary, createRackDto);

            expect(mockDatabaseService.rack.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    mqttTopic: createRackDto.mqttTopic,
                }) as Partial<CreateRackDto>,
            });
        });

        it('should throw ConflictException if MAC address already exists', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);

            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                ConflictException,
            );
            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                'MAC address already registered',
            );
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            await service.create(testDbIds.primary, createRackDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Rack created successfully: ${mockRack.id} for user ${testDbIds.primary}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                'Failed to register rack',
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findUnique.mockRejectedValue(dbError);

            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error creating rack for user ${testDbIds.primary}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('findAll', () => {
        const query: PaginationQueryDto = { page: 1, limit: 10 };

        it('should retrieve all racks for a user with pagination', async () => {
            mockDatabaseService.rack.findMany.mockResolvedValue(mockRacks);
            mockDatabaseService.rack.count.mockResolvedValue(mockRacks.length);

            const result = await service.findAll(testDbIds.primary, query);

            expect(result).toEqual({
                data: mockRacks,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: mockRacks.length,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            });
        });

        it('should call database with correct pagination parameters', async () => {
            mockDatabaseService.rack.findMany.mockResolvedValue(mockRacks);
            mockDatabaseService.rack.count.mockResolvedValue(mockRacks.length);

            await service.findAll(testDbIds.primary, query);

            expect(mockDatabaseService.rack.findMany).toHaveBeenCalledWith({
                where: { userId: testDbIds.primary },
                skip: 0,
                take: 10,
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.findMany.mockResolvedValue(mockRacks);
            mockDatabaseService.rack.count.mockResolvedValue(mockRacks.length);

            await service.findAll(testDbIds.primary, query);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Retrieved ${mockRacks.length} racks for user ${testDbIds.primary} (page 1)`,
                'RacksService',
            );
        });

        it('should return empty data array when no racks found', async () => {
            mockDatabaseService.rack.findMany.mockResolvedValue([]);
            mockDatabaseService.rack.count.mockResolvedValue(0);

            const result = await service.findAll(testDbIds.primary, query);

            expect(result.data).toEqual([]);
            expect(result.meta.totalItems).toBe(0);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('Database error'));

            await expect(service.findAll(testDbIds.primary, query)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findAll(testDbIds.primary, query)).rejects.toThrow(
                'Failed to fetch racks',
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findMany.mockRejectedValue(dbError);

            await expect(service.findAll(testDbIds.primary, query)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching racks for user ${testDbIds.primary}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('findById', () => {
        it('should retrieve rack by ID', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            const result = await service.findById(testRackId, testDbIds.primary);

            expect(result).toEqual({
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            });
        });

        it('should call database with correct parameters', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.findById(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                'Rack not found or access denied',
            );
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.findById(testRackId, testDbIds.primary);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Rack details fetched: ${testRackId}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockRejectedValue(new Error('Database error'));

            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                'Failed to fetch rack details',
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('findByMacAddress', () => {
        it('should find rack by MAC address', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);

            const result = await service.findByMacAddress(testMacAddress);

            expect(result).toEqual(mockRack);
            expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                where: { macAddress: testMacAddress },
            });
        });

        it('should return null if rack not found', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            const result = await service.findByMacAddress(testMacAddress);

            expect(result).toBeNull();
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findByMacAddress(testMacAddress)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findByMacAddress(testMacAddress)).rejects.toThrow(
                'Failed to find rack by MAC address',
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findUnique.mockRejectedValue(dbError);

            await expect(service.findByMacAddress(testMacAddress)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error finding rack by MAC address: ${testMacAddress}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('update', () => {
        it('should update rack successfully', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...mockRack,
                ...updateRackDto,
            });

            const result = await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(result).toEqual({
                message: 'Rack updated successfully',
                rack: { ...mockRack, ...updateRackDto },
            });
        });

        it('should verify ownership before updating', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should call database update with correct data', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: updateRackDto,
            });
        });

        it('should throw NotFoundException if ownership verification fails', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow('Rack not found or access denied');
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Rack updated successfully: ${testRackId}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow('Failed to update rack');
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            const dbError = new Error('Database error');
            mockDatabaseService.rack.update.mockRejectedValue(dbError);

            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error updating rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('delete', () => {
        it('should soft delete rack successfully', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue({ ...mockRack, isActive: false });

            const result = await service.delete(testRackId, testDbIds.primary);

            expect(result).toEqual({
                message: 'Rack deleted successfully',
            });
        });

        it('should verify ownership before deleting', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.delete(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should set isActive to false', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.delete(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: { isActive: false },
            });
        });

        it('should throw NotFoundException if ownership verification fails', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                'Rack not found or access denied',
            );
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.delete(testRackId, testDbIds.primary);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Rack soft deleted: ${testRackId}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                'Failed to delete rack',
            );
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            const dbError = new Error('Database error');
            mockDatabaseService.rack.update.mockRejectedValue(dbError);

            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error deleting rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('verifyRackOwnership', () => {
        it('should return true if user owns rack', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            const result = await service.verifyRackOwnership(testRackId, testDbIds.primary);

            expect(result).toBe(true);
        });

        it('should call database with correct parameters', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.verifyRackOwnership(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.verifyRackOwnership(testRackId, testDbIds.primary),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.verifyRackOwnership(testRackId, testDbIds.primary),
            ).rejects.toThrow('Rack not found or access denied');
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(
                service.verifyRackOwnership(testRackId, testDbIds.primary),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error verifying rack ownership: ${testRackId} for user: ${testDbIds.primary}`,
                'Database error',
                'RacksService',
            );
        });

        it('should propagate errors', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(
                service.verifyRackOwnership(testRackId, testDbIds.primary),
            ).rejects.toThrow(dbError);
        });
    });

    describe('processDeviceStatus', () => {
        const statusData: DeviceStatusDto = {
            online: true,
            timestamp: Date.now(),
        };

        beforeEach(() => {
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(statusData);
        });

        it('should process device status successfully', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...mockRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(jest.spyOn(MqttMessageParser, 'parseAndValidate')).toHaveBeenCalledWith(
                statusMessage,
                DeviceStatusDto,
                testMacAddress,
            );
        });

        it('should update rack status to ONLINE when device is online', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: expect.objectContaining({
                    status: DeviceStatus.ONLINE,
                    lastSeenAt: expect.any(Date) as Date,
                    lastActivityAt: expect.any(Date) as Date,
                }) as Partial<UpdateRackDto>,
            });
        });

        it('should update rack status to OFFLINE when device is offline', async () => {
            const offlineData: DeviceStatusDto = { online: false };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(offlineData);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: expect.objectContaining({
                    status: DeviceStatus.OFFLINE,
                    lastSeenAt: expect.any(Date) as Date,
                }) as Partial<UpdateRackDto>,
            });
        });

        it('should log activity when status changes', async () => {
            // start with rack offline so we trigger the status change branch
            const offlineRack = { ...mockRack, status: DeviceStatus.OFFLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(offlineRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...offlineRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                offlineRack.id,
                ActivityEventType.DEVICE_ONLINE,
                expect.stringContaining('Device status changed'),
                expect.any(Object),
            );
        });

        it('should not log activity when status does not change', async () => {
            const onlineRack = { ...mockRack, status: DeviceStatus.ONLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(onlineRack);
            mockDatabaseService.rack.update.mockResolvedValue(onlineRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockLogRackActivityHelper.logActivity).not.toHaveBeenCalled();
        });

        it('should broadcast status update via WebSocket', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastDeviceStatus',
                DeviceStatus.ONLINE,
            );
        });

        it('should throw BadRequestException if device not registered', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow(`Device with MAC address ${testMacAddress} is not registered`);
        });

        it('should log warning for unregistered device', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                `Received status update from unregistered device: ${testMacAddress}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            // simulate error during update rather than find so outer catch triggers
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to process device status for: ${testMacAddress}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('processDeviceError', () => {
        const errorMessage = JSON.stringify({
            c: 'ERR_SENSOR_FAIL',
            m: 'Sensor failed',
            s: 'CRITICAL',
        });
        const errorData: DeviceErrorDto = {
            code: 'ERR_SENSOR_FAIL',
            message: 'Sensor failed',
            severity: ErrorSeverity.CRITICAL,
            sensorType: SensorType.TEMPERATURE,
        };

        beforeEach(() => {
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(errorData);
        });

        it('should process device error successfully', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue({
                id: 'notif-1',
                userId: testDbIds.primary,
                rackId: testRackId,
                type: NotificationType.ALERT,
                title: `Device Error: ${errorData.code}`,
                message: errorData.message,
            });

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(jest.spyOn(MqttMessageParser, 'parseAndValidate')).toHaveBeenCalledWith(
                errorMessage,
                DeviceErrorDto,
                testMacAddress,
            );
        });

        it('should update rack status to ERROR', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue({} as any);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: {
                    status: 'ERROR',
                    lastSeenAt: expect.any(Date) as Date,
                },
            });
        });

        it('should create ALERT notification for CRITICAL errors', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue({} as any);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    type: NotificationType.ALERT,
                }) as Partial<Notification>,
            });
        });

        it('should create WARNING notification for non-critical errors', async () => {
            const warningData = { ...errorData, severity: ErrorSeverity.MEDIUM };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(warningData);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue({} as any);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    type: NotificationType.WARNING,
                }) as Partial<Notification>,
            });
        });

        it('should broadcast notification via WebSocket', async () => {
            const notification = {
                id: 'notif-1',
                userId: testDbIds.primary,
                type: NotificationType.ALERT,
            };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue(notification as any);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastNotification',
                notification,
            );
        });

        it('should broadcast device status via WebSocket', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.notification.create.mockResolvedValue({} as any);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastDeviceStatus',
                mockRack.status,
            );
        });

        it('should not update status if already ERROR', async () => {
            const errorRack = { ...mockRack, status: DeviceStatus.ERROR };
            mockDatabaseService.rack.findUnique.mockResolvedValue(errorRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).not.toHaveBeenCalled();
            expect(mockDatabaseService.notification.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if device not registered', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(service.processDeviceError(testMacAddress, errorMessage)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should log warning for unregistered device', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(
                service.processDeviceError(testMacAddress, errorMessage),
            ).rejects.toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                `Received error from unregistered device: ${testMacAddress}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.processDeviceError(testMacAddress, errorMessage)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            // simulate error during update so outer catch logs
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.processDeviceError(testMacAddress, errorMessage),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to process device error for: ${testMacAddress}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('getLatestSensorReading', () => {
        it('should retrieve latest sensor reading', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(mockSensorReading);

            const result = await service.getLatestSensorReading(testRackId);

            expect(result).toEqual(mockSensorReading);
            expect(mockDatabaseService.sensorReading.findFirst).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
            });
        });

        it('should return null if no readings found', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);

            const result = await service.getLatestSensorReading(testRackId);

            expect(result).toBeNull();
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.sensorReading.findFirst.mockRejectedValue(
                new Error('Database error'),
            );

            await expect(service.getLatestSensorReading(testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findFirst.mockRejectedValue(dbError);

            await expect(service.getLatestSensorReading(testRackId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching latest sensor reading for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('getCurrentState', () => {
        const mockRackState = {
            id: testRackId,
            name: 'Test Rack',
            status: DeviceStatus.ONLINE,
            lastSeenAt: new Date(),
        };

        it('should retrieve current rack state with sensor reading', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackState as any);
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(mockSensorReading);

            const result = await service.getCurrentState(testRackId, testDbIds.primary);

            expect(result).toEqual({
                message: 'Current rack state retrieved successfully',
                rack: mockRackState,
                latestReading: {
                    temperature: mockSensorReading.temperature,
                    humidity: mockSensorReading.humidity,
                    moisture: mockSensorReading.moisture,
                    lightLevel: mockSensorReading.lightLevel,
                    timestamp: mockSensorReading.timestamp,
                },
            });
        });

        it('should verify ownership before retrieving state', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackState as any);
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);

            await service.getCurrentState(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should return null latestReading when no sensor data', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackState as any);
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);

            const result = await service.getCurrentState(testRackId, testDbIds.primary);

            expect(result.latestReading).toBeNull();
        });

        it('should throw NotFoundException if ownership verification fails', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(service.getCurrentState(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(service.getCurrentState(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.getCurrentState(testRackId, testDbIds.primary)).rejects.toThrow(
                'Rack not found',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockRejectedValue(new Error('Database error'));

            await expect(service.getCurrentState(testRackId, testDbIds.primary)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(service.getCurrentState(testRackId, testDbIds.primary)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching current state for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('getDeviceStatus', () => {
        const mockStatusData = {
            status: DeviceStatus.ONLINE,
            lastSeenAt: new Date(),
        };

        it('should retrieve device status', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockStatusData as any);

            const result = await service.getDeviceStatus(testRackId, testDbIds.primary);

            expect(result).toEqual({
                message: 'Device status retrieved successfully',
                status: mockStatusData.status,
                lastSeenAt: mockStatusData.lastSeenAt,
            });
        });

        it('should verify ownership before retrieving status', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockStatusData as any);

            await service.getDeviceStatus(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalled();
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(service.getDeviceStatus(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockRejectedValue(new Error('Database error'));

            await expect(service.getDeviceStatus(testRackId, testDbIds.primary)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(service.getDeviceStatus(testRackId, testDbIds.primary)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching device status for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('updateDeviceStatus', () => {
        it('should update device status', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.updateDeviceStatus(testRackId, DeviceStatus.ONLINE);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: { status: DeviceStatus.ONLINE },
            });
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.updateDeviceStatus(testRackId, DeviceStatus.ONLINE);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Device status updated for rack ${testRackId}: ONLINE`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.updateDeviceStatus(testRackId, DeviceStatus.ONLINE),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.update.mockRejectedValue(dbError);

            await expect(
                service.updateDeviceStatus(testRackId, DeviceStatus.ONLINE),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error updating device status for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('updateLastSeenAt', () => {
        it('should update lastSeenAt timestamp', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.updateLastSeenAt(testRackId);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: { lastSeenAt: expect.any(Date) as Date },
            });
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.updateLastSeenAt(testRackId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Last seen updated for rack ${testRackId}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(service.updateLastSeenAt(testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.update.mockRejectedValue(dbError);

            await expect(service.updateLastSeenAt(testRackId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error updating last seen for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });

    describe('getRecentActivities', () => {
        const mockActivities = [
            {
                id: 'activity-1',
                rackId: testRackId,
                eventType: ActivityEventType.DEVICE_ONLINE,
                timestamp: new Date(),
            },
        ];

        it('should retrieve recent activities', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities as any);

            const result = await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(result).toEqual(mockActivities);
        });

        it('should verify ownership before retrieving activities', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities as any);

            await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalled();
        });

        it('should use default limit of 50', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities as any);

            await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
                take: 50,
            });
        });

        it('should use custom limit when provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities as any);

            await service.getRecentActivities(testRackId, testDbIds.primary, 100);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
                take: 100,
            });
        });

        it('should throw NotFoundException if ownership verification fails', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.getRecentActivities(testRackId, testDbIds.primary),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findFirst.mockRejectedValue(new Error('Database error'));

            await expect(
                service.getRecentActivities(testRackId, testDbIds.primary),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findFirst.mockRejectedValue(dbError);

            await expect(
                service.getRecentActivities(testRackId, testDbIds.primary),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching activities for rack ${testRackId}`,
                'Database error',
                'RacksService',
            );
        });
    });
});
