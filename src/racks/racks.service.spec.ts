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
import {
    type DeviceStatusDto,
    type DeviceErrorDto,
    ErrorSeverity,
    type HarvestLeavesDto,
    type HarvestSeedsDto,
    ErrorCode,
    HardwareType,
    type RecoveryCode,
} from './dto';
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
    rackWithPlant,
    testPlantIds,
    baseActivityQuery,
    expectedPaginatedResponse,
    filteredActivityQuery,
    mockActivities,
    mockActivity,
    assignWithDateDto,
    emptyRackForPlant,
    harvestDto,
    mockInactivePlant,
    mockPlant,
    rackForLeaves,
    unassignDto,
    validAssignPlantToRackDto,
    harvestSeedsDto,
    rackForSeeds,
} from '../../test/fixtures';

// Mock MqttMessageParser at module level
jest.mock('../common/utils/mqtt-parser.helper', () => ({
    MqttMessageParser: {
        parseAndValidate: jest.fn(),
    },
}));

import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';

// ─── Fixtures local to operation tests ──────────────────────────────────────

const testPlantId = testPlantIds.primary;
const testRackId = testRackIds.primary;
const testUserId = testDbIds.primary;

// ─────────────────────────────────────────────────────────────────────────────

describe('RacksService', () => {
    let service: RacksService;

    const testMacAddress = testMacAddresses.valid;

    const createRackDto: CreateRackDto = validCreateRackDto;
    const updateRackDto: UpdateRackDto = validUpdateRackDto;

    const mockDatabaseService = createMockDatabaseService();
    const mockLoggerService = createMockLogger();
    const mockEventEmitter = createMockEventEmitter();
    const mockLogRackActivityHelper = createMockLogRackActivityHelper();

    beforeEach(async () => {
        jest.clearAllMocks();

        if (!mockDatabaseService.rackPlantingHistory) {
            mockDatabaseService.rackPlantingHistory = {
                create: jest.fn(),
                updateMany: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
            };
        }

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

    // ─────────────────────────────────────────────
    // CRUD OPERATIONS
    // ─────────────────────────────────────────────

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
                include: {
                    currentPlant: {
                        select: {
                            name: true,
                            category: true,
                            recommendedSoil: true,
                            description: true,
                        },
                    },
                },
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
                include: {
                    currentPlant: {
                        select: {
                            name: true,
                            category: true,
                            recommendedSoil: true,
                            description: true,
                        },
                    },
                },
            });
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findById(testRackId, testDbIds.primary)).rejects.toThrow(
                `Rack ${testRackId} not found or access denied`,
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

        it('should throw ConflictException if MAC address already exists and rack is active', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);

            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                ConflictException,
            );
            await expect(service.create(testDbIds.primary, createRackDto)).rejects.toThrow(
                'MAC address already registered',
            );
        });

        it('should recover archived rack if MAC exists but isActive is false', async () => {
            const archivedRack = { ...mockRack, isActive: false };
            mockDatabaseService.rack.findUnique.mockResolvedValue(archivedRack);
            mockDatabaseService.rack.update.mockResolvedValue({ ...archivedRack, isActive: true });

            const result = await service.create(testDbIds.primary, createRackDto);

            expect(result).toEqual({
                message: 'Archived rack recovered succefully.',
                rackId: archivedRack.id,
            });
            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: archivedRack.id },
                data: {
                    name: createRackDto.name,
                    isActive: true,
                },
            });
        });

        it('should emit sensor_start command when recovering archived rack', async () => {
            const archivedRack = { ...mockRack, isActive: false };
            mockDatabaseService.rack.findUnique.mockResolvedValue(archivedRack);
            mockDatabaseService.rack.update.mockResolvedValue({ ...archivedRack, isActive: true });

            await service.create(testDbIds.primary, createRackDto);

            expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
                'publishCommand',
                archivedRack.macAddress,
                'sensors',
                { action: 'sensor_start' },
            );
        });

        it('should emit sensor_start command after creating a new rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            await service.create(testDbIds.primary, createRackDto);

            expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
                'publishCommand',
                mockRack.macAddress,
                'sensors',
                { action: 'sensor_start' },
            );
        });

        it('should log RACK_ADDED activity after creating a new rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.create.mockResolvedValue(mockRack);

            await service.create(testDbIds.primary, createRackDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                mockRack.id,
                ActivityEventType.RACK_ADDED,
                expect.stringContaining(mockRack.name),
                expect.objectContaining({ macAddress: mockRack.macAddress }),
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

    describe('update', () => {
        beforeEach(() => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                name: mockRack.name,
                macAddress: mockRack.macAddress,
            });
        });

        it('should update rack successfully', async () => {
            mockDatabaseService.rack.update.mockResolvedValue({
                ...mockRack,
                name: updateRackDto.name,
                description: updateRackDto.description,
            });

            const result = await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(result).toEqual({
                message: 'Rack updated successfully',
                rack: {
                    ...mockRack,
                    name: updateRackDto.name,
                    description: updateRackDto.description,
                },
            });
        });

        it('should verify ownership before updating', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: {
                    id: testRackId,
                    userId: testDbIds.primary,
                },
            });
        });

        it('should fetch current rack name before updating', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                where: { id: testRackId },
                select: { name: true, macAddress: true },
            });
        });

        it('should call database update with correct data shape', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: {
                    name: updateRackDto.name,
                    mqttTopic: updateRackDto.mqttTopic,
                    description: updateRackDto.description,
                },
            });
        });

        it('should log RACK_RENAMED activity when name changes', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                name: 'Old Name',
                macAddress: mockRack.macAddress,
            });
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, {
                ...updateRackDto,
                name: 'New Name',
            });

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.RACK_RENAMED,
                expect.stringContaining('renamed'),
                expect.objectContaining({ oldName: 'Old Name', newName: 'New Name' }),
            );
        });

        it('should not log RACK_RENAMED activity when name is unchanged', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                name: updateRackDto.name,
                macAddress: mockRack.macAddress,
            });
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockLogRackActivityHelper.logActivity).not.toHaveBeenCalledWith(
                expect.anything(),
                ActivityEventType.RACK_RENAMED,
                expect.anything(),
                expect.anything(),
            );
        });

        it('should throw NotFoundException if ownership verification fails', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow(`Rack ${testRackId} not found or access denied`);
        });

        it('should log success message', async () => {
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.update(testRackId, testDbIds.primary, updateRackDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Rack updated successfully: ${testRackId}`,
                'RacksService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.update(testRackId, testDbIds.primary, updateRackDto),
            ).rejects.toThrow('Failed to update rack');
        });

        it('should log error on failure', async () => {
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

        it('should emit sensor_stop command after soft deleting', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.delete(testRackId, testDbIds.primary);

            expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
                'publishCommand',
                mockRack.macAddress,
                'sensors',
                { action: 'sensor_stop' },
            );
        });

        it('should log RACK_REMOVED activity after soft deleting', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.delete(testRackId, testDbIds.primary);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.RACK_REMOVED,
                expect.stringContaining(mockRack.name),
                expect.objectContaining({ macAddress: mockRack.macAddress }),
            );
        });

        it('should throw NotFoundException if rack not found', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.delete(testRackId, testDbIds.primary)).rejects.toThrow(
                `Rack ${testRackId} not found or access denied`,
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
            ).rejects.toThrow(`Rack ${testRackId} not found or access denied`);
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

    describe('resolveAuthorizedRackIds', () => {
        type PrivateResolve = {
            resolveAuthorizedRackIds(
                userId: string,
                requestedRackIds?: string[],
            ): Promise<string[]>;
        };
        const call = (userId: string, requestedRackIds?: string[]) =>
            (service as unknown as PrivateResolve).resolveAuthorizedRackIds(
                userId,
                requestedRackIds,
            );

        const rackIdA = testRackIds.primary;
        const rackIdB = testRackIds.secondary ?? 'rack-id-b';
        const rackIdC = 'rack-id-c';

        const seedUserRacks = (...ids: string[]) =>
            mockDatabaseService.rack.findMany.mockResolvedValue(ids.map((id) => ({ id })));

        describe('when no requestedRackIds are provided', () => {
            it('should return all rack IDs belonging to the user', async () => {
                seedUserRacks(rackIdA, rackIdB);

                const result = await call(testUserId);

                expect(result).toEqual([rackIdA, rackIdB]);
            });

            it('should query rack.findMany with the correct userId filter', async () => {
                seedUserRacks(rackIdA);

                await call(testUserId);

                expect(mockDatabaseService.rack.findMany).toHaveBeenCalledWith({
                    where: { userId: testUserId },
                    select: { id: true },
                });
            });

            it('should return an empty array when the user owns no racks', async () => {
                seedUserRacks();

                const result = await call(testUserId);

                expect(result).toEqual([]);
            });

            it('should not call verifyRackOwnership', async () => {
                seedUserRacks(rackIdA);

                await call(testUserId);

                expect(mockDatabaseService.rack.findFirst).not.toHaveBeenCalled();
            });

            it('should treat undefined requestedRackIds the same as omitting it', async () => {
                seedUserRacks(rackIdA, rackIdB);

                const result = await call(testUserId, undefined);

                expect(result).toEqual([rackIdA, rackIdB]);
            });

            it('should treat an empty array the same as omitting it', async () => {
                seedUserRacks(rackIdA, rackIdB);

                const result = await call(testUserId, []);

                expect(result).toEqual([rackIdA, rackIdB]);
            });
        });

        describe('when requestedRackIds are provided', () => {
            it('should return only the requested rack IDs when all are owned by the user', async () => {
                seedUserRacks(rackIdA, rackIdB, rackIdC);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                const result = await call(testUserId, [rackIdA, rackIdB]);

                expect(result).toEqual([rackIdA, rackIdB]);
            });

            it('should call verifyRackOwnership once per requested rack ID', async () => {
                seedUserRacks(rackIdA, rackIdB);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                await call(testUserId, [rackIdA, rackIdB]);

                expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledTimes(2);
            });

            it('should call verifyRackOwnership with the correct rackId and userId each time', async () => {
                seedUserRacks(rackIdA, rackIdB);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                await call(testUserId, [rackIdA, rackIdB]);

                expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                    where: { id: rackIdA, userId: testUserId },
                });
                expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                    where: { id: rackIdB, userId: testUserId },
                });
            });

            it('should throw NotFoundException when a requested rack is not owned by the user', async () => {
                seedUserRacks(rackIdA);
                mockDatabaseService.rack.findFirst.mockResolvedValue(null);

                await expect(call(testUserId, [rackIdB])).rejects.toThrow(NotFoundException);
            });

            it('should filter out requested IDs that are not in the user rack set', async () => {
                seedUserRacks(rackIdA);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                const result = await call(testUserId, [rackIdA, rackIdC]);

                expect(result).toEqual([rackIdA]);
            });

            it('should return an empty array when all requested IDs are filtered out', async () => {
                seedUserRacks(rackIdA);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                const result = await call(testUserId, [rackIdC]);

                expect(result).toEqual([]);
            });

            it('should still call rack.findMany to build the user rack set', async () => {
                seedUserRacks(rackIdA);
                mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

                await call(testUserId, [rackIdA]);

                expect(mockDatabaseService.rack.findMany).toHaveBeenCalledWith({
                    where: { userId: testUserId },
                    select: { id: true },
                });
            });
        });
    });

    // ─────────────────────────────────────────────
    // DEVICE STATUS & ERROR
    // ─────────────────────────────────────────────

    describe('processDeviceStatus', () => {
        const statusData: DeviceStatusDto = {
            online: true,
            timestamp: new Date().toISOString(),
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

            expect(jest.spyOn(MqttMessageParser, 'parseAndValidate')).toHaveBeenCalled();
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

        it('should not include lastActivityAt when device goes offline', async () => {
            const offlineData: DeviceStatusDto = { online: false };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(offlineData);
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: expect.not.objectContaining({
                    lastActivityAt: expect.any(Date) as Date,
                }) as object,
            });
        });

        it('should log activity when status changes from OFFLINE to ONLINE', async () => {
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

        it('should log activity when status changes from ONLINE to OFFLINE', async () => {
            const offlineData: DeviceStatusDto = { online: false };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(offlineData);
            const onlineRack = { ...mockRack, status: DeviceStatus.ONLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(onlineRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...onlineRack,
                status: DeviceStatus.OFFLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                onlineRack.id,
                ActivityEventType.DEVICE_OFFLINE,
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

        it('should emit broadcastDeviceStatus with rackId and newStatus when status changes', async () => {
            const offlineRack = { ...mockRack, status: DeviceStatus.OFFLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(offlineRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...offlineRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastDeviceStatus',
                offlineRack.id,
                DeviceStatus.ONLINE,
            );
        });

        it('should emit createNotification when status changes', async () => {
            const offlineRack = { ...mockRack, status: DeviceStatus.OFFLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(offlineRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...offlineRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    userId: offlineRack.userId,
                    rackId: offlineRack.id,
                    type: NotificationType.INFO,
                    title: 'Rack Connected',
                }),
            );
        });

        it('should emit createNotification with disconnected title when going offline', async () => {
            const offlineData: DeviceStatusDto = { online: false };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(offlineData);
            const onlineRack = { ...mockRack, status: DeviceStatus.ONLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(onlineRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...onlineRack,
                status: DeviceStatus.OFFLINE,
            });

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    type: NotificationType.INFO,
                    title: 'Rack Disconnected',
                }),
            );
        });

        it('should not emit createNotification when status does not change', async () => {
            const onlineRack = { ...mockRack, status: DeviceStatus.ONLINE };
            mockDatabaseService.rack.findUnique.mockResolvedValue(onlineRack);
            mockDatabaseService.rack.update.mockResolvedValue(onlineRack);

            await service.processDeviceStatus(testMacAddress, statusMessage);

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'createNotification',
                expect.any(Object),
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

        it('should throw InternalServerErrorException on database update error', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(new Error('Database error'));

            await expect(
                service.processDeviceStatus(testMacAddress, statusMessage),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
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
            c: 'SENSOR_FAILURE',
            m: 'Sensor failed',
            s: 'CRITICAL',
            ht: 'TEMPERATURE',
        });
        const errorData: DeviceErrorDto = {
            code: ErrorCode.SENSOR_FAILURE,
            message: 'Sensor failed',
            severity: ErrorSeverity.CRITICAL,
            hardwareType: HardwareType.TEMPERATURE,
        };

        beforeEach(() => {
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(errorData);
        });

        it('should process device error successfully', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await expect(
                service.processDeviceError(testMacAddress, errorMessage),
            ).resolves.not.toThrow();

            expect(jest.spyOn(MqttMessageParser, 'parseAndValidate')).toHaveBeenCalled();
        });

        it('should update rack status to ERROR', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: {
                    status: DeviceStatus.ERROR,
                    lastSeenAt: expect.any(Date) as Date,
                },
            });
        });

        it('should emit broadcastDeviceStatus with ERROR status', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastDeviceStatus',
                mockRack.id,
                DeviceStatus.ERROR,
            );
        });

        it('should emit createNotification with ERROR type', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    userId: mockRack.userId,
                    rackId: mockRack.id,
                    type: NotificationType.ERROR,
                    title: 'Component Malfunction Detected',
                }),
            );
        });

        it('should not update status or emit events if rack is already in ERROR state', async () => {
            const errorRack = { ...mockRack, status: DeviceStatus.ERROR };
            mockDatabaseService.rack.findUnique.mockResolvedValue(errorRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).not.toHaveBeenCalled();
            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'createNotification',
                expect.any(Object),
            );
        });

        it('should handle recovery code by transitioning ERROR rack back to ONLINE', async () => {
            const recoveryData: DeviceErrorDto = {
                code: 'SENSOR_RECOVERED' as RecoveryCode,
                message: 'Sensor recovered',
                severity: ErrorSeverity.LOW,
            };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(recoveryData);
            const errorRack = { ...mockRack, status: DeviceStatus.ERROR };
            mockDatabaseService.rack.findUnique.mockResolvedValue(errorRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...errorRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: errorRack.id },
                data: {
                    status: DeviceStatus.ONLINE,
                    lastSeenAt: expect.any(Date) as Date,
                },
            });
        });

        it('should emit createNotification with INFO type on recovery', async () => {
            const recoveryData: DeviceErrorDto = {
                code: 'SENSOR_RECOVERED' as RecoveryCode,
                message: 'Sensor recovered',
                severity: ErrorSeverity.LOW,
            };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(recoveryData);
            const errorRack = { ...mockRack, status: DeviceStatus.ERROR };
            mockDatabaseService.rack.findUnique.mockResolvedValue(errorRack);
            mockDatabaseService.rack.update.mockResolvedValue({
                ...errorRack,
                status: DeviceStatus.ONLINE,
            });

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    type: NotificationType.INFO,
                    title: 'Component Recovered',
                }),
            );
        });

        it('should not recover if rack is not in ERROR state', async () => {
            const recoveryData: DeviceErrorDto = {
                code: 'SENSOR_RECOVERED' as RecoveryCode,
                message: 'Sensor recovered',
                severity: ErrorSeverity.LOW,
            };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(recoveryData);
            // Rack is ONLINE, not ERROR
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);

            await service.processDeviceError(testMacAddress, errorMessage);

            expect(mockDatabaseService.rack.update).not.toHaveBeenCalled();
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
            mockDatabaseService.rack.findUnique.mockRejectedValue(
                new InternalServerErrorException('Database error'),
            );

            await expect(service.processDeviceError(testMacAddress, errorMessage)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.rack.update.mockRejectedValue(
                new InternalServerErrorException('Database error'),
            );

            await expect(
                service.processDeviceError(testMacAddress, errorMessage),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to process device error/recovery for: ${testMacAddress}`,
                'Database error',
                'RacksService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // SENSOR & CURRENT STATE
    // ─────────────────────────────────────────────

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
                    waterUsed: mockSensorReading.waterUsed,
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
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

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

    // ─────────────────────────────────────────────
    // STATISTICS & ANALYTICS
    // ─────────────────────────────────────────────

    function seedResolveAuthorizedRackIds(
        mockDatabaseService: ReturnType<typeof createMockDatabaseService>,
        rackIds: string[] = [testRackId],
    ) {
        mockDatabaseService.rack.findMany.mockResolvedValue(rackIds.map((id) => ({ id })));
    }

    describe('getRackActivities', () => {
        beforeEach(() => {
            seedResolveAuthorizedRackIds(mockDatabaseService);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);
            mockDatabaseService.activity.count.mockResolvedValue(1);
        });

        it('should return paginated rack activities for all user racks', async () => {
            const result = await service.getRackActivities(testUserId, baseActivityQuery);

            expect(result).toEqual(expectedPaginatedResponse);
        });

        it('should query only RACK_ADDED, RACK_RENAMED, RACK_REMOVED event types', async () => {
            await service.getRackActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: {
                            in: expect.arrayContaining([
                                ActivityEventType.RACK_ADDED,
                                ActivityEventType.RACK_RENAMED,
                                ActivityEventType.RACK_REMOVED,
                            ]) as string[],
                        },
                    }) as object,
                }),
            );
        });

        it('should resolve all user rack IDs when no rackId filter provided', async () => {
            await service.getRackActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.rack.findMany).toHaveBeenCalledWith({
                where: { userId: testUserId },
                select: { id: true },
            });
        });

        it('should filter by specific rack IDs when rackId provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getRackActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rackId: { in: [testRackId] },
                    }) as object,
                }),
            );
        });

        it('should apply date range filter when startDate and endDate provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getRackActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: {
                            gte: new Date(filteredActivityQuery.startDate!),
                            lte: new Date(filteredActivityQuery.endDate!),
                        },
                    }) as object,
                }),
            );
        });

        it('should apply only gte when only startDate provided', async () => {
            await service.getRackActivities(testUserId, {
                ...baseActivityQuery,
                startDate: '2024-01-01',
            });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: { gte: new Date('2024-01-01') },
                    }) as object,
                }),
            );
        });

        it('should apply only lte when only endDate provided', async () => {
            await service.getRackActivities(testUserId, {
                ...baseActivityQuery,
                endDate: '2024-12-31',
            });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: { lte: new Date('2024-12-31') },
                    }) as object,
                }),
            );
        });

        it('should not include timestamp filter when no dates provided', async () => {
            await service.getRackActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        timestamp: expect.any(Date) as Date,
                    }) as object,
                }),
            );
        });

        it('should order results by timestamp descending', async () => {
            await service.getRackActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
            );
        });

        it('should apply correct pagination skip and take', async () => {
            await service.getRackActivities(testUserId, { page: 2, limit: 5 });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 5, take: 5 }),
            );
        });

        it('should throw NotFoundException when rackId filter contains an unauthorized rack', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.getRackActivities(testUserId, filteredActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(service.getRackActivities(testUserId, baseActivityQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getRackActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching rack activities for user ${testUserId}`,
                'DB error',
                'RacksService',
            );
        });
    });

    describe('getPlantCareActivities', () => {
        const plantCareActivity = {
            ...mockActivity,
            id: 'activity-2',
            eventType: ActivityEventType.WATERING_START,
        };

        beforeEach(() => {
            seedResolveAuthorizedRackIds(mockDatabaseService);
            mockDatabaseService.activity.findMany.mockResolvedValue([plantCareActivity]);
            mockDatabaseService.activity.count.mockResolvedValue(1);
        });

        it('should return paginated plant care activities', async () => {
            const result = await service.getPlantCareActivities(testUserId, baseActivityQuery);

            expect(result).toEqual({
                data: [plantCareActivity],
                meta: expectedPaginatedResponse.meta,
            });
        });

        it('should query only WATERING_START, WATERING_STOP, LIGHT_ON, LIGHT_OFF event types when no event filter', async () => {
            await service.getPlantCareActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: {
                            in: expect.arrayContaining([
                                ActivityEventType.WATERING_START,
                                ActivityEventType.WATERING_STOP,
                                ActivityEventType.LIGHT_ON,
                                ActivityEventType.LIGHT_OFF,
                            ]) as string[],
                        },
                    }) as object,
                }),
            );
        });

        it('should not include any rack-management event types', async () => {
            await service.getPlantCareActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: expect.objectContaining({
                            in: expect.not.arrayContaining([
                                ActivityEventType.RACK_ADDED,
                                ActivityEventType.PLANT_HARVESTED,
                            ]) as string,
                        }) as object,
                    }) as object,
                }),
            );
        });

        it('should filter by specific rack IDs when rackId provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getPlantCareActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rackId: { in: [testRackId] },
                    }) as object,
                }),
            );
        });

        it('should apply date range filter when dates provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getPlantCareActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: {
                            gte: new Date(filteredActivityQuery.startDate!),
                            lte: new Date(filteredActivityQuery.endDate!),
                        },
                    }) as object,
                }),
            );
        });

        it('should order results by timestamp descending', async () => {
            await service.getPlantCareActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
            );
        });

        it('should apply correct pagination skip and take', async () => {
            await service.getPlantCareActivities(testUserId, { page: 3, limit: 20 });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 40, take: 20 }),
            );
        });

        it('should throw NotFoundException when rackId filter contains an unauthorized rack', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.getPlantCareActivities(testUserId, filteredActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getPlantCareActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getPlantCareActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching plant care activities for user ${testUserId}`,
                'DB error',
                'RacksService',
            );
        });
    });

    describe('getPlantingActivities', () => {
        const plantingActivity = {
            ...mockActivity,
            id: 'activity-3',
            eventType: ActivityEventType.PLANT_ADDED,
        };

        beforeEach(() => {
            seedResolveAuthorizedRackIds(mockDatabaseService);
            mockDatabaseService.activity.findMany.mockResolvedValue([plantingActivity]);
            mockDatabaseService.activity.count.mockResolvedValue(1);
        });

        it('should return paginated planting activities', async () => {
            const result = await service.getPlantingActivities(testUserId, baseActivityQuery);

            expect(result).toEqual({
                data: [plantingActivity],
                meta: expectedPaginatedResponse.meta,
            });
        });

        it('should query only PLANT_ADDED and PLANT_REMOVED event types', async () => {
            await service.getPlantingActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: {
                            in: expect.arrayContaining([
                                ActivityEventType.PLANT_ADDED,
                                ActivityEventType.PLANT_REMOVED,
                            ]) as string[],
                        },
                    }) as object,
                }),
            );
        });

        it('should not include PLANT_HARVESTED in the event type filter', async () => {
            await service.getPlantingActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: expect.objectContaining({
                            in: expect.not.arrayContaining([
                                ActivityEventType.PLANT_HARVESTED,
                            ]) as string[],
                        }) as object,
                    }) as object,
                }),
            );
        });

        it('should filter by specific rack IDs when rackId provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getPlantingActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rackId: { in: [testRackId] },
                    }) as object,
                }),
            );
        });

        it('should apply date range filter when dates provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);

            await service.getPlantingActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: {
                            gte: new Date(filteredActivityQuery.startDate!),
                            lte: new Date(filteredActivityQuery.endDate!),
                        },
                    }) as object,
                }),
            );
        });

        it('should order results by timestamp descending', async () => {
            await service.getPlantingActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
            );
        });

        it('should apply correct pagination skip and take', async () => {
            await service.getPlantingActivities(testUserId, { page: 2, limit: 10 });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 10, take: 10 }),
            );
        });

        it('should throw NotFoundException when rackId filter contains an unauthorized rack', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.getPlantingActivities(testUserId, filteredActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getPlantingActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getPlantingActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching planting activities for user ${testUserId}`,
                'DB error',
                'RacksService',
            );
        });
    });

    describe('getHarvestActivities', () => {
        beforeEach(() => {
            seedResolveAuthorizedRackIds(mockDatabaseService);
            mockDatabaseService.activity.count.mockResolvedValue(1);
            // rack.aggregate for totalHarvestCount
            mockDatabaseService.rack.aggregate.mockResolvedValue({ _sum: { harvestCount: 5 } });
        });

        it('should return paginated harvest activities with totalHarvestCount', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            const result = await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(result).toEqual({
                data: mockActivities,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
                totalHarvestCount: 5,
            });
        });

        it('should use rack.aggregate to compute totalHarvestCount', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.rack.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    _sum: { harvestCount: true },
                }),
            );
        });

        it('should return totalHarvestCount of 0 when aggregate sum is null', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue([]);
            mockDatabaseService.activity.count.mockResolvedValue(0);
            mockDatabaseService.rack.aggregate.mockResolvedValue({ _sum: { harvestCount: null } });

            const result = await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(result.totalHarvestCount).toBe(0);
        });

        it('should query LEAVES_HARVESTED, PLANT_HARVESTED, and SEEDS_HARVESTED event types', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: {
                            in: expect.arrayContaining([
                                ActivityEventType.LEAVES_HARVESTED,
                                ActivityEventType.PLANT_HARVESTED,
                                ActivityEventType.SEEDS_HARVESTED,
                            ]) as string[],
                        },
                    }) as object,
                }),
            );
        });

        it('should make three parallel calls via Promise.all — findMany, count, aggregate', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledTimes(1);
            expect(mockDatabaseService.activity.count).toHaveBeenCalledTimes(1);
            expect(mockDatabaseService.rack.aggregate).toHaveBeenCalledTimes(1);
        });

        it('should filter by specific rack IDs when rackId provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rackId: { in: [testRackId] },
                    }) as object,
                }),
            );
        });

        it('should pass matching rack IDs to rack.aggregate where filter', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.rack.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { in: [testRackId] } },
                }),
            );
        });

        it('should apply date range filter when dates provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue([]);

            await service.getHarvestActivities(testUserId, filteredActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: {
                            gte: new Date(filteredActivityQuery.startDate!),
                            lte: new Date(filteredActivityQuery.endDate!),
                        },
                    }) as object,
                }),
            );
        });

        it('should order results by timestamp descending', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue(mockActivities);

            await service.getHarvestActivities(testUserId, baseActivityQuery);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
            );
        });

        it('should apply correct pagination skip and take', async () => {
            mockDatabaseService.activity.findMany.mockResolvedValue([]);

            await service.getHarvestActivities(testUserId, { page: 3, limit: 5 });

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 10, take: 5 }),
            );
        });

        it('should throw NotFoundException when rackId filter contains an unauthorized rack', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.getHarvestActivities(testUserId, filteredActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getHarvestActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findMany.mockRejectedValue(new Error('DB error'));

            await expect(
                service.getHarvestActivities(testUserId, baseActivityQuery),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching harvest activities for user ${testUserId}`,
                'DB error',
                'RacksService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // RACK ASSIGNMENT OPERATIONS
    // ─────────────────────────────────────────────

    describe('checkAssignToRack', () => {
        // service signature: checkAssignToRack(rackId, userId, dto)
        beforeEach(() => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);
        });

        it('should return hasWarning false when no sensor reading exists', async () => {
            const result = await service.checkAssignToRack(
                testRackId,
                testUserId,
                validAssignPlantToRackDto,
            );

            expect(result).toEqual({
                hasWarning: false,
                latestTemperatureReading: null,
                maxTemperatureThreshold: mockPlant.maxTemperature,
            });
        });

        it('should return hasWarning false when temperature is within threshold', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue({
                temperature: 20,
            });
            // mockPlant.maxTemperature should be > 20 for this to pass
            mockDatabaseService.plant.findUnique.mockResolvedValue({
                ...mockPlant,
                maxTemperature: 30,
            });

            const result = await service.checkAssignToRack(
                testRackId,
                testUserId,
                validAssignPlantToRackDto,
            );

            expect(result.hasWarning).toBe(false);
            expect(result.latestTemperatureReading).toBe(20);
        });

        it('should return hasWarning true when temperature exceeds plant max threshold', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue({
                temperature: 35,
            });
            mockDatabaseService.plant.findUnique.mockResolvedValue({
                ...mockPlant,
                maxTemperature: 25,
            });

            const result = await service.checkAssignToRack(
                testRackId,
                testUserId,
                validAssignPlantToRackDto,
            );

            expect(result.hasWarning).toBe(true);
            expect(result.latestTemperatureReading).toBe(35);
            expect(result.maxTemperatureThreshold).toBe(25);
        });

        it('should return hasWarning false when plant has no maxTemperature set', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue({ temperature: 99 });
            mockDatabaseService.plant.findUnique.mockResolvedValue({
                ...mockPlant,
                maxTemperature: null,
            });

            const result = await service.checkAssignToRack(
                testRackId,
                testUserId,
                validAssignPlantToRackDto,
            );

            expect(result.hasWarning).toBe(false);
        });

        it('should query sensor reading with correct rackId', async () => {
            await service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto);

            expect(mockDatabaseService.sensorReading.findFirst).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
                select: { temperature: true },
            });
        });

        it('should throw NotFoundException when plant does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);

            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when plant is inactive', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockInactivePlant);

            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow('Cannot assign an inactive plant to a rack');
        });

        it('should throw NotFoundException when rack does not exist', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when rack already has a plant assigned', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(rackWithPlant);

            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow('This rack already has a plant assigned');
        });

        it('should throw InternalServerErrorException on unexpected database error', async () => {
            mockDatabaseService.plant.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(
                service.checkAssignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('harvestLeavesFromRack', () => {
        const harvestLeavesDto: HarvestLeavesDto = { plantId: testPlantId };

        beforeEach(() => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackForLeaves);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
        });

        it('should return success message', async () => {
            const result = await service.harvestLeavesFromRack(
                testRackId,
                testUserId,
                harvestLeavesDto,
            );

            expect(result).toEqual({ message: 'Leaves harvested successfully' });
        });

        it('should update rack with incremented harvestCount and timestamps — not clear the plant', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: expect.objectContaining({
                    harvestCount: rackForLeaves.harvestCount + 1,
                    lastHarvestAt: expect.any(Date) as Date,
                    lastActivityAt: expect.any(Date) as Date,
                }) as object,
            });
        });

        it('should not clear currentPlantId or quantity', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        currentPlantId: expect.any(String) as string,
                        quantity: expect.any(Number) as number,
                        plantedAt: expect.any(String) as string,
                    }) as object,
                }),
            );
        });

        it('should log LEAVES_HARVESTED activity with correct metadata', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.LEAVES_HARVESTED,
                expect.stringContaining('Leaves harvested'),
                expect.objectContaining({
                    plantId: testPlantId,
                    plantName: rackForLeaves.currentPlant.name,
                    harvestCount: rackForLeaves.harvestCount + 1,
                    harvestedAt: expect.any(String) as string,
                }),
            );
        });

        it('should increment harvestCount correctly', async () => {
            const rackWith5Harvests = { ...rackForLeaves, harvestCount: 5 };
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWith5Harvests);

            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ harvestCount: 6 }) as object,
                }),
            );
        });

        it('should call verifyRackOwnership', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: { id: testRackId, userId: testUserId },
            });
        });

        it('should fetch the rack with currentPlant name via findUnique', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                where: { id: testRackId },
                include: { currentPlant: { select: { name: true } } },
            });
        });

        it('should log the start of the operation', async () => {
            await service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Harvesting leaves from plant ${testPlantId}`),
                'RacksService',
            );
        });

        it('should throw BadRequestException when plant is not assigned to the rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                ...rackForLeaves,
                currentPlantId: testPlantIds.secondary ?? 'plant-other',
            });

            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow('This plant is not currently assigned to that rack');
        });

        it('should re-throw NotFoundException from verifyRackOwnership', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on unexpected database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow('Failed to harvest leaves');
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(
                service.harvestLeavesFromRack(testRackId, testUserId, harvestLeavesDto),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error harvesting leaves from plant ${testPlantId}`),
                'DB error',
                'RacksService',
            );
        });
    });

    describe('harvestPlantFromRack', () => {
        beforeEach(() => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);
            mockDatabaseService.rackPlantingHistory.updateMany.mockResolvedValue({ count: 1 });
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.$transaction.mockImplementation(
                async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDatabaseService),
            );
        });

        it('should harvest plant and return success message', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            const result = await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(result).toEqual({ message: 'Plant harvested successfully' });
        });

        it('should log PLANT_HARVESTED activity', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.PLANT_HARVESTED,
                expect.stringContaining('harvested'),
                expect.objectContaining({ plantId: testPlantId }),
            );
        });

        it('should increment harvest count on the rack', async () => {
            const rackWithTwoHarvests = { ...rackWithPlant, harvestCount: 2 };
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithTwoHarvests);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        harvestCount: 3,
                    }) as object,
                }),
            );
        });

        it('should clear currentPlantId, quantity and plantedAt after harvest', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        currentPlantId: null,
                        quantity: 0,
                        plantedAt: null,
                    }) as object,
                }),
            );
        });

        it('should call verifyRackOwnership', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: { id: testRackId, userId: testUserId },
            });
        });

        it('should throw BadRequestException when plant is not in the rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                ...rackWithPlant,
                currentPlantId: testPlantIds.secondary ?? 'plant-other',
            });

            await expect(
                service.harvestPlantFromRack(testRackId, testUserId, harvestDto),
            ).rejects.toThrow(BadRequestException);
        });

        it('should log the correct harvest count in activity metadata', async () => {
            const rackWith3Harvests = { ...rackWithPlant, harvestCount: 3 };
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWith3Harvests);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.PLANT_HARVESTED,
                expect.any(String),
                expect.objectContaining({ harvestCount: 4 }),
            );
        });

        it('should run updates in a transaction', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.harvestPlantFromRack(testRackId, testUserId, harvestDto);

            expect(mockDatabaseService.$transaction).toHaveBeenCalledTimes(1);
        });

        it('should throw InternalServerErrorException on transaction error', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);
            mockDatabaseService.$transaction.mockRejectedValueOnce(new Error('DB error'));

            await expect(
                service.harvestPlantFromRack(testRackId, testUserId, harvestDto),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('harvestSeedsFromRack', () => {
        beforeEach(() => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackForSeeds);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
        });

        it('should return success message', async () => {
            const result = await service.harvestSeedsFromRack(
                testRackId,
                testUserId,
                harvestSeedsDto,
            );

            expect(result).toEqual({ message: 'Seeds harvested successfully' });
        });

        it('should decrement rack quantity by the requested amount', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: testRackId },
                data: expect.objectContaining({
                    quantity: rackForSeeds.quantity - harvestSeedsDto.quantity,
                }) as object,
            });
        });

        it('should increment harvestCount', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        harvestCount: rackForSeeds.harvestCount + 1,
                    }) as object,
                }),
            );
        });

        it('should update lastHarvestAt and lastActivityAt', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        lastHarvestAt: expect.any(Date) as Date,
                        lastActivityAt: expect.any(Date) as Date,
                    }) as object,
                }),
            );
        });

        it('should not clear currentPlantId or plantedAt', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        currentPlantId: expect.any(String) as string,
                        plantedAt: expect.any(String) as string,
                    }) as object,
                }),
            );
        });

        it('should log SEEDS_HARVESTED activity with correct metadata', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.SEEDS_HARVESTED,
                expect.stringContaining(`${harvestSeedsDto.quantity} seed`),
                expect.objectContaining({
                    plantId: testPlantId,
                    quantityTaken: harvestSeedsDto.quantity,
                    remainingQuantity: rackForSeeds.quantity - harvestSeedsDto.quantity,
                    harvestCount: rackForSeeds.harvestCount + 1,
                }),
            );
        });

        it('should allow taking exactly maxSeedsAllowed (quantity - 1)', async () => {
            const dto: HarvestSeedsDto = { plantId: testPlantId, quantity: 9 };

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, dto),
            ).resolves.toEqual({ message: 'Seeds harvested successfully' });
        });

        it('should call verifyRackOwnership', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: { id: testRackId, userId: testUserId },
            });
        });

        it('should fetch the rack with currentPlant name via findUnique', async () => {
            await service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto);

            expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                where: { id: testRackId },
                include: { currentPlant: { select: { name: true } } },
            });
        });

        it('should throw BadRequestException when plant is not assigned to the rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                ...rackForSeeds,
                currentPlantId: testPlantIds.secondary ?? 'plant-other',
            });

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow('This plant is not currently assigned to that rack');
        });

        it('should throw BadRequestException when rack quantity is 1 (below minimum threshold)', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({ ...rackForSeeds, quantity: 1 });

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow('quantity must be at least 2');
        });

        it('should throw BadRequestException when quantity requested exceeds maxSeedsAllowed', async () => {
            const dto: HarvestSeedsDto = { plantId: testPlantId, quantity: 10 };

            await expect(service.harvestSeedsFromRack(testRackId, testUserId, dto)).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.harvestSeedsFromRack(testRackId, testUserId, dto)).rejects.toThrow(
                'Cannot harvest 10 seeds — maximum allowed is 9',
            );
        });

        it('should include the correct max in the over-limit error message', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({ ...rackForSeeds, quantity: 5 });
            const dto: HarvestSeedsDto = { plantId: testPlantId, quantity: 5 };

            await expect(service.harvestSeedsFromRack(testRackId, testUserId, dto)).rejects.toThrow(
                'Cannot harvest 5 seeds — maximum allowed is 4',
            );
        });

        it('should re-throw NotFoundException from verifyRackOwnership', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw InternalServerErrorException on unexpected database error', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow('Failed to harvest seeds');
        });

        it('should log error on failure', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(
                service.harvestSeedsFromRack(testRackId, testUserId, harvestSeedsDto),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error harvesting seeds from plant ${testPlantId}`),
                'DB error',
                'RacksService',
            );
        });
    });

    describe('assignToRack', () => {
        beforeEach(() => {
            mockDatabaseService.rackPlantingHistory.create.mockResolvedValue({});
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.$transaction.mockImplementation(
                async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDatabaseService),
            );
        });

        it('should assign plant to empty rack and return success message', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            const result = await service.assignToRack(
                testRackId,
                testUserId,
                validAssignPlantToRackDto,
            );

            expect(result).toEqual({ message: 'Plant assigned to rack successfully' });
        });

        it('should log PLANT_ADDED activity when rack has no current plant', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.PLANT_ADDED,
                expect.stringContaining('added to rack'),
                expect.objectContaining({ plantId: testPlantId }),
            );
        });

        it('should create a RackPlantingHistory entry on assignment', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto);

            expect(mockDatabaseService.rackPlantingHistory.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        rackId: testRackId,
                        plantId: testPlantId,
                        quantity: validAssignPlantToRackDto.quantity,
                    }) as object,
                }),
            );
        });

        it('should use provided plantedAt date when given', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await service.assignToRack(testRackId, testUserId, assignWithDateDto);

            expect(mockDatabaseService.$transaction).toHaveBeenCalled();
        });

        it('should run updates in a transaction', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto);

            expect(mockDatabaseService.$transaction).toHaveBeenCalledTimes(1);
        });

        it('should call rack.update with the new plant inside the transaction', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: testRackId },
                    data: expect.objectContaining({
                        currentPlantId: testPlantId,
                        quantity: validAssignPlantToRackDto.quantity,
                    }) as object,
                }),
            );
        });

        it('should throw NotFoundException when plant does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when plant is inactive', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockInactivePlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);

            await expect(
                service.assignToRack(testRackId, testUserId, {
                    ...validAssignPlantToRackDto,
                    plantId: mockInactivePlant.id,
                }),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.assignToRack(testRackId, testUserId, {
                    ...validAssignPlantToRackDto,
                    plantId: mockInactivePlant.id,
                }),
            ).rejects.toThrow('Cannot assign an inactive plant to a rack');
        });

        it('should throw NotFoundException when rack does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(null);

            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when rack already has any plant assigned', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(rackWithPlant);

            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow('This rack already has a plant assigned');
        });

        it('should throw InternalServerErrorException on transaction error', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);
            mockDatabaseService.$transaction.mockRejectedValueOnce(new Error('DB error'));

            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should log error on failure', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.rack.findFirst.mockResolvedValue(emptyRackForPlant);
            mockDatabaseService.$transaction.mockRejectedValueOnce(new Error('DB error'));

            await expect(
                service.assignToRack(testRackId, testUserId, validAssignPlantToRackDto),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error assigning plant ${testPlantId}`),
                'DB error',
                'RacksService',
            );
        });
    });

    describe('unassignFromRack', () => {
        beforeEach(() => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);
            mockDatabaseService.rackPlantingHistory.updateMany.mockResolvedValue({ count: 1 });
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);
            mockDatabaseService.$transaction.mockImplementation(
                async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDatabaseService),
            );
        });

        it('should remove plant from rack and return success message', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            const result = await service.unassignFromRack(testRackId, testUserId, unassignDto);

            expect(result).toEqual({ message: 'Plant removed from rack successfully' });
        });

        it('should log PLANT_REMOVED activity without harvest', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.unassignFromRack(testRackId, testUserId, unassignDto);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.PLANT_REMOVED,
                expect.stringContaining('without harvest'),
                expect.objectContaining({ removedPlantId: testPlantId }),
            );
        });

        it('should clear currentPlantId, quantity and plantedAt on the rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.unassignFromRack(testRackId, testUserId, unassignDto);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        currentPlantId: null,
                        quantity: 0,
                        plantedAt: null,
                    }) as object,
                }),
            );
        });

        it('should call verifyRackOwnership', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.unassignFromRack(testRackId, testUserId, unassignDto);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalledWith({
                where: { id: testRackId, userId: testUserId },
            });
        });

        it('should throw BadRequestException when plant is not in the rack', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                ...rackWithPlant,
                currentPlantId: testPlantIds.secondary ?? 'plant-other',
            });

            await expect(
                service.unassignFromRack(testRackId, testUserId, unassignDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.unassignFromRack(testRackId, testUserId, unassignDto),
            ).rejects.toThrow('This plant is not currently assigned to that rack');
        });

        it('should run updates in a transaction', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);

            await service.unassignFromRack(testRackId, testUserId, unassignDto);

            expect(mockDatabaseService.$transaction).toHaveBeenCalledTimes(1);
        });

        it('should throw InternalServerErrorException on transaction error', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(rackWithPlant);
            mockDatabaseService.$transaction.mockRejectedValueOnce(new Error('DB error'));

            await expect(
                service.unassignFromRack(testRackId, testUserId, unassignDto),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ─────────────────────────────────────────────
    // UTILITY METHODS
    // ─────────────────────────────────────────────

    describe('getRecentActivities', () => {
        const mockRecentActivities = [
            {
                id: 'activity-1',
                rackId: testRackId,
                eventType: ActivityEventType.DEVICE_ONLINE,
                timestamp: new Date(),
            },
        ];

        it('should retrieve recent activities', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockRecentActivities as any);

            const result = await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(result).toEqual(mockRecentActivities);
        });

        it('should verify ownership before retrieving activities', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockRecentActivities as any);

            await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(mockDatabaseService.rack.findFirst).toHaveBeenCalled();
        });

        it('should use default limit of 50', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockRecentActivities as any);

            await service.getRecentActivities(testRackId, testDbIds.primary);

            expect(mockDatabaseService.activity.findMany).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
                take: 50,
            });
        });

        it('should use custom limit when provided', async () => {
            mockDatabaseService.rack.findFirst.mockResolvedValue(mockRack);
            mockDatabaseService.activity.findMany.mockResolvedValue(mockRecentActivities as any);

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
});
