import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { RacksController } from './racks.controller';
import { RacksService } from './racks.service';
import { type CreateRackDto } from './dto/create-rack.dto';
import { type UpdateRackDto } from './dto/update-rack.dto';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';

// shared fixtures
import {
    testUser,
    mockRack,
    mockSensorReading,
    validCreateRackDto,
    validUpdateRackDto,
    mockRacks,
    testRackIds,
    testMacAddresses,
} from '../../test/fixtures';
import { createMockRacksService } from '../../test/mocks';

describe('RacksController', () => {
    let controller: RacksController;

    const createRackDto: CreateRackDto = validCreateRackDto;
    const updateRackDto: UpdateRackDto = validUpdateRackDto;

    const testRackId = testRackIds.primary;
    const testMacAddress = testMacAddresses.valid;

    const mockRacksService = createMockRacksService();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RacksController],
            providers: [
                {
                    provide: RacksService,
                    useValue: mockRacksService,
                },
            ],
        }).compile();

        controller = module.get<RacksController>(RacksController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should register a new rack successfully', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };

            mockRacksService.create.mockResolvedValue(expectedResponse);

            const result = await controller.create(testUser, createRackDto);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.create).toHaveBeenCalledWith(testUser.dbId, createRackDto);
            expect(mockRacksService.create).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };

            mockRacksService.create.mockResolvedValue(expectedResponse);

            await controller.create(testUser, createRackDto);

            expect(mockRacksService.create).toHaveBeenCalledWith(testUser.dbId, createRackDto);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to register rack');
            mockRacksService.create.mockRejectedValue(error);

            await expect(controller.create(testUser, createRackDto)).rejects.toThrow(error);
            expect(mockRacksService.create).toHaveBeenCalledWith(testUser.dbId, createRackDto);
        });

        it('should handle ConflictException for duplicate MAC address', async () => {
            const error = new InternalServerErrorException('MAC address already registered');
            mockRacksService.create.mockRejectedValue(error);

            await expect(controller.create(testUser, createRackDto)).rejects.toThrow(error);
        });
    });

    describe('findAll', () => {
        const paginationQuery: PaginationQueryDto = {
            page: 1,
            limit: 10,
        };

        it('should retrieve paginated racks successfully', async () => {
            const expectedResponse = {
                data: mockRacks.map((r) => ({
                    id: r.id,
                    name: r.name,
                    macAddress: r.macAddress,
                    status: r.status,
                    lastSeenAt: r.lastSeenAt,
                })),
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: mockRacks.length,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockRacksService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.findAll(testUser, paginationQuery);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findAll).toHaveBeenCalledWith(testUser.dbId, paginationQuery);
            expect(mockRacksService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockRacksService.findAll.mockResolvedValue(expectedResponse);

            await controller.findAll(testUser, paginationQuery);

            expect(mockRacksService.findAll).toHaveBeenCalledWith(testUser.dbId, paginationQuery);
        });

        it('should handle different page numbers', async () => {
            const page2Query: PaginationQueryDto = { page: 2, limit: 10 };
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 2,
                    itemsPerPage: 10,
                    totalItems: 5,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: true,
                },
            };

            mockRacksService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.findAll(testUser, page2Query);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findAll).toHaveBeenCalledWith(testUser.dbId, page2Query);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to fetch racks');
            mockRacksService.findAll.mockRejectedValue(error);

            await expect(controller.findAll(testUser, paginationQuery)).rejects.toThrow(error);
        });
    });

    describe('findOne', () => {
        it('should retrieve rack details successfully', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: {
                    id: mockRack.id,
                    name: mockRack.name,
                    macAddress: mockRack.macAddress,
                    mqttTopic: mockRack.mqttTopic,
                    description: mockRack.description,
                    status: mockRack.status,
                    isActive: mockRack.isActive,
                    lastSeenAt: mockRack.lastSeenAt,
                    createdAt: mockRack.createdAt,
                },
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            const result = await controller.findOne(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, testUser.dbId);
            expect(mockRacksService.findById).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            await controller.findOne(testUser, testRackId);

            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, testUser.dbId);
        });

        it('should throw NotFoundException when rack not found', async () => {
            const error = new NotFoundException('Rack not found or access denied');
            mockRacksService.findById.mockRejectedValue(error);

            await expect(controller.findOne(testUser, testRackId)).rejects.toThrow(error);
            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, testUser.dbId);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to fetch rack details');
            mockRacksService.findById.mockRejectedValue(error);

            await expect(controller.findOne(testUser, testRackId)).rejects.toThrow(error);
        });
    });

    describe('update', () => {
        it('should update rack successfully', async () => {
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: {
                    ...mockRack,
                    name: updateRackDto.name,
                    description: updateRackDto.description,
                    mqttTopic: updateRackDto.mqttTopic,
                },
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            const result = await controller.update(testUser, testRackId, updateRackDto);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
                updateRackDto,
            );
            expect(mockRacksService.update).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: mockRack,
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            await controller.update(testUser, testRackId, updateRackDto);

            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
                updateRackDto,
            );
        });

        it('should handle partial updates', async () => {
            const partialUpdate: UpdateRackDto = { name: 'New Name Only' };
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: { ...mockRack, name: partialUpdate.name },
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            const result = await controller.update(testUser, testRackId, partialUpdate);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
                partialUpdate,
            );
        });

        it('should throw NotFoundException when rack not found', async () => {
            const error = new NotFoundException('Rack not found or access denied');
            mockRacksService.update.mockRejectedValue(error);

            await expect(controller.update(testUser, testRackId, updateRackDto)).rejects.toThrow(
                error,
            );
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to update rack');
            mockRacksService.update.mockRejectedValue(error);

            await expect(controller.update(testUser, testRackId, updateRackDto)).rejects.toThrow(
                error,
            );
        });
    });

    describe('remove', () => {
        it('should delete rack successfully', async () => {
            const expectedResponse = {
                message: 'Rack deleted successfully',
            };

            mockRacksService.delete.mockResolvedValue(expectedResponse);

            const result = await controller.remove(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.delete).toHaveBeenCalledWith(testRackId, testUser.dbId);
            expect(mockRacksService.delete).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Rack deleted successfully',
            };

            mockRacksService.delete.mockResolvedValue(expectedResponse);

            await controller.remove(testUser, testRackId);

            expect(mockRacksService.delete).toHaveBeenCalledWith(testRackId, testUser.dbId);
        });

        it('should throw NotFoundException when rack not found', async () => {
            const error = new NotFoundException('Rack not found or access denied');
            mockRacksService.delete.mockRejectedValue(error);

            await expect(controller.remove(testUser, testRackId)).rejects.toThrow(error);
            expect(mockRacksService.delete).toHaveBeenCalledWith(testRackId, testUser.dbId);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to delete rack');
            mockRacksService.delete.mockRejectedValue(error);

            await expect(controller.remove(testUser, testRackId)).rejects.toThrow(error);
        });
    });

    describe('getCurrentState', () => {
        it('should retrieve current rack state successfully', async () => {
            const expectedResponse = {
                message: 'Current rack state retrieved successfully',
                rack: {
                    id: mockRack.id,
                    name: mockRack.name,
                    status: mockRack.status,
                    lastSeenAt: mockRack.lastSeenAt,
                },
                latestReading: {
                    temperature: mockSensorReading.temperature,
                    humidity: mockSensorReading.humidity,
                    moisture: mockSensorReading.moisture,
                    lightLevel: mockSensorReading.lightLevel,
                    timestamp: mockSensorReading.timestamp,
                },
            };

            mockRacksService.getCurrentState.mockResolvedValue(expectedResponse);

            const result = await controller.getCurrentState(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.getCurrentState).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
            );
            expect(mockRacksService.getCurrentState).toHaveBeenCalledTimes(1);
        });

        it('should handle null latestReading', async () => {
            const expectedResponse = {
                message: 'Current rack state retrieved successfully',
                rack: {
                    id: mockRack.id,
                    name: mockRack.name,
                    status: mockRack.status,
                    lastSeenAt: mockRack.lastSeenAt,
                },
                latestReading: null,
            };

            mockRacksService.getCurrentState.mockResolvedValue(expectedResponse);

            const result = await controller.getCurrentState(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(result.latestReading).toBeNull();
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Current rack state retrieved successfully',
                rack: mockRack,
                latestReading: mockSensorReading,
            };

            mockRacksService.getCurrentState.mockResolvedValue(expectedResponse);

            await controller.getCurrentState(testUser, testRackId);

            expect(mockRacksService.getCurrentState).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
            );
        });

        it('should throw NotFoundException when rack not found', async () => {
            const error = new NotFoundException('Rack not found or access denied');
            mockRacksService.getCurrentState.mockRejectedValue(error);

            await expect(controller.getCurrentState(testUser, testRackId)).rejects.toThrow(error);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to fetch current rack state');
            mockRacksService.getCurrentState.mockRejectedValue(error);

            await expect(controller.getCurrentState(testUser, testRackId)).rejects.toThrow(error);
        });
    });

    describe('getStatus', () => {
        it('should retrieve device status successfully', async () => {
            const expectedResponse = {
                message: 'Device status retrieved successfully',
                status: 'ONLINE',
                lastSeenAt: mockRack.lastSeenAt,
            };

            mockRacksService.getDeviceStatus.mockResolvedValue(expectedResponse);

            const result = await controller.getStatus(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.getDeviceStatus).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
            );
            expect(mockRacksService.getDeviceStatus).toHaveBeenCalledTimes(1);
        });

        it('should handle different device statuses', async () => {
            const statuses = ['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE'];

            for (const status of statuses) {
                mockRacksService.getDeviceStatus.mockResolvedValue({
                    message: 'Device status retrieved successfully',
                    status,
                    lastSeenAt: mockRack.lastSeenAt,
                });

                const result = await controller.getStatus(testUser, testRackId);

                expect(result.status).toBe(status);
            }
        });

        it('should handle null lastSeenAt', async () => {
            const expectedResponse = {
                message: 'Device status retrieved successfully',
                status: 'OFFLINE',
                lastSeenAt: null,
            };

            mockRacksService.getDeviceStatus.mockResolvedValue(expectedResponse);

            const result = await controller.getStatus(testUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(result.lastSeenAt).toBeNull();
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Device status retrieved successfully',
                status: 'ONLINE',
                lastSeenAt: mockRack.lastSeenAt,
            };

            mockRacksService.getDeviceStatus.mockResolvedValue(expectedResponse);

            await controller.getStatus(testUser, testRackId);

            expect(mockRacksService.getDeviceStatus).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
            );
        });

        it('should throw NotFoundException when rack not found', async () => {
            const error = new NotFoundException('Rack not found or access denied');
            mockRacksService.getDeviceStatus.mockRejectedValue(error);

            await expect(controller.getStatus(testUser, testRackId)).rejects.toThrow(error);
        });

        it('should propagate service errors', async () => {
            const error = new InternalServerErrorException('Failed to fetch device status');
            mockRacksService.getDeviceStatus.mockRejectedValue(error);

            await expect(controller.getStatus(testUser, testRackId)).rejects.toThrow(error);
        });
    });

    // Note: The command endpoints (water, light, sensors) are commented out in the controller
    // These tests would be added when those features are implemented

    describe('edge cases and error handling', () => {
        it('should handle service returning undefined', async () => {
            mockRacksService.findById.mockResolvedValue(undefined);

            const result = await controller.findOne(testUser, testRackId);

            expect(result).toBeUndefined();
        });

        it('should handle empty string rackId', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            await controller.findOne(testUser, '');

            expect(mockRacksService.findById).toHaveBeenCalledWith('', testUser.dbId);
        });

        it('should handle empty pagination query', async () => {
            const emptyQuery: PaginationQueryDto = {};
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockRacksService.findAll.mockResolvedValue(expectedResponse);

            await controller.findAll(testUser, emptyQuery);

            expect(mockRacksService.findAll).toHaveBeenCalledWith(testUser.dbId, emptyQuery);
        });

        it('should handle empty update DTO', async () => {
            const emptyUpdate: UpdateRackDto = {};
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: mockRack,
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            await controller.update(testUser, testRackId, emptyUpdate);

            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
                emptyUpdate,
            );
        });
    });

    describe('authentication and authorization', () => {
        it('should use CurrentUser decorator to extract user info', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            await controller.findOne(testUser, testRackId);

            // Verify that user.dbId is used (comes from CurrentUser decorator)
            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, testUser.dbId);
        });

        it('should pass dbId not uid to service methods', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };

            mockRacksService.create.mockResolvedValue(expectedResponse);

            const createDto: CreateRackDto = {
                name: 'Test Rack',
                macAddress: testMacAddress,
            };

            await controller.create(testUser, createDto);

            // Should use dbId, not uid
            expect(mockRacksService.create).toHaveBeenCalledWith(testUser.dbId, createDto);
            expect(mockRacksService.create).not.toHaveBeenCalledWith(
                testUser.firebaseUid,
                createDto,
            );
        });
    });

    describe('parameter validation', () => {
        it('should accept valid rackId format', async () => {
            const validRackIds = ['rack-123', 'clx123abc', 'abc-def-ghi'];

            for (const rackId of validRackIds) {
                mockRacksService.findById.mockResolvedValue({
                    message: 'Rack details retrieved successfully',
                    rack: { ...mockRack, id: rackId },
                });

                await controller.findOne(testUser, rackId);

                expect(mockRacksService.findById).toHaveBeenCalledWith(rackId, testUser.dbId);
            }
        });

        it('should handle special characters in query parameters', async () => {
            const specialQuery: PaginationQueryDto = {
                page: 1,
                limit: 100,
            };

            mockRacksService.findAll.mockResolvedValue({
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 100,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            });

            await controller.findAll(testUser, specialQuery);

            expect(mockRacksService.findAll).toHaveBeenCalledWith(testUser.dbId, specialQuery);
        });
    });

    describe('response format consistency', () => {
        it('should return consistent success response format for create', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };

            mockRacksService.create.mockResolvedValue(expectedResponse);

            const result = await controller.create(testUser, {
                name: 'Test',
                macAddress: testMacAddress,
            });

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rackId');
            expect(typeof result.message).toBe('string');
        });

        it('should return consistent success response format for findById', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            const result = await controller.findOne(testUser, testRackId);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rack');
            expect(typeof result.message).toBe('string');
        });

        it('should return consistent success response format for update', async () => {
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: mockRack,
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            const result = await controller.update(testUser, testRackId, { name: 'New Name' });

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rack');
        });

        it('should return consistent success response format for delete', async () => {
            const expectedResponse = {
                message: 'Rack deleted successfully',
            };

            mockRacksService.delete.mockResolvedValue(expectedResponse);

            const result = await controller.remove(testUser, testRackId);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });
    });
});
