import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { RacksController } from './racks.controller';
import { RacksService } from './racks.service';
import { type CreateRackDto } from './dto/create-rack.dto';
import { type UpdateRackDto } from './dto/update-rack.dto';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { type ActivityQueryDto } from './dto/activity-query.dto';
import { type HarvestSeedsDto, type UnassignFromRackDto } from './dto';

import {
    testUser,
    mockRack,
    mockSensorReading,
    validCreateRackDto,
    validUpdateRackDto,
    mockRacks,
    testRackIds,
    expectedPaginatedResponse,
    assignSuccessResponse,
    baseActivityQuery,
    harvestSuccessResponse,
    harvestLeavesSuccessResponse,
    harvestSeedsSuccessResponse,
    unassignFromRackSuccessResponse,
    validAssignPlantToRackDto,
    testPlantIds,
    harvestDto,
    harvestLeavesDto,
    harvestSeedsDto,
    inactivePlantAssignDto,
} from '../../test/fixtures';
import { createMockRacksService } from '../../test/mocks';

describe('RacksController', () => {
    let controller: RacksController;

    const createRackDto: CreateRackDto = validCreateRackDto;
    const updateRackDto: UpdateRackDto = validUpdateRackDto;

    const mockUser = testUser;
    const testRackId = testRackIds.primary;
    const testPlantId = testPlantIds.primary;

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

    // ─────────────────────────────────────────────
    // CRUD
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        const paginationQuery: PaginationQueryDto = { page: 1, limit: 10 };

        it('should retrieve paginated racks successfully', async () => {
            const expectedResponse = {
                data: mockRacks,
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

            const result = await controller.findAll(mockUser, paginationQuery);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findAll).toHaveBeenCalledWith(mockUser.dbId, paginationQuery);
            expect(mockRacksService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.findAll.mockResolvedValue({ data: [], meta: {} });

            await controller.findAll(mockUser, paginationQuery);

            expect(mockRacksService.findAll).toHaveBeenCalledWith(mockUser.dbId, paginationQuery);
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

            const result = await controller.findAll(mockUser, page2Query);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findAll).toHaveBeenCalledWith(mockUser.dbId, page2Query);
        });

        it('should handle empty pagination query', async () => {
            const emptyQuery: PaginationQueryDto = {};
            mockRacksService.findAll.mockResolvedValue({ data: [], meta: {} });

            await controller.findAll(mockUser, emptyQuery);

            expect(mockRacksService.findAll).toHaveBeenCalledWith(mockUser.dbId, emptyQuery);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.findAll.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch racks'),
            );

            await expect(controller.findAll(mockUser, paginationQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('findOne', () => {
        it('should retrieve rack details successfully', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };

            mockRacksService.findById.mockResolvedValue(expectedResponse);

            const result = await controller.findOne(mockUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, mockUser.dbId);
            expect(mockRacksService.findById).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId and userId in the correct order', async () => {
            mockRacksService.findById.mockResolvedValue({
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            });

            await controller.findOne(mockUser, testRackId);

            expect(mockRacksService.findById).toHaveBeenCalledWith(testRackId, mockUser.dbId);
        });

        it('should throw NotFoundException when rack not found', async () => {
            mockRacksService.findById.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.findOne(mockUser, testRackId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.findById.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch rack details'),
            );

            await expect(controller.findOne(mockUser, testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return consistent response shape', async () => {
            const expectedResponse = {
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            };
            mockRacksService.findById.mockResolvedValue(expectedResponse);

            const result = await controller.findOne(mockUser, testRackId);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rack');
        });
    });

    describe('getCurrentState', () => {
        it('should retrieve current rack state with sensor reading', async () => {
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

            const result = await controller.getCurrentState(mockUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.getCurrentState).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
            );
            expect(mockRacksService.getCurrentState).toHaveBeenCalledTimes(1);
        });

        it('should handle null latestReading', async () => {
            const expectedResponse = {
                message: 'Current rack state retrieved successfully',
                rack: mockRack,
                latestReading: null,
            };

            mockRacksService.getCurrentState.mockResolvedValue(expectedResponse);

            const result = await controller.getCurrentState(mockUser, testRackId);

            expect(result.latestReading).toBeNull();
        });

        it('should pass rackId and userId in the correct order', async () => {
            mockRacksService.getCurrentState.mockResolvedValue({});

            await controller.getCurrentState(mockUser, testRackId);

            expect(mockRacksService.getCurrentState).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
            );
        });

        it('should throw NotFoundException when rack not found', async () => {
            mockRacksService.getCurrentState.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.getCurrentState(mockUser, testRackId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getCurrentState.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch current rack state'),
            );

            await expect(controller.getCurrentState(mockUser, testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
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

            const result = await controller.getStatus(mockUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.getDeviceStatus).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
            );
            expect(mockRacksService.getDeviceStatus).toHaveBeenCalledTimes(1);
        });

        it('should handle all device status values', async () => {
            for (const status of ['ONLINE', 'OFFLINE', 'ERROR']) {
                mockRacksService.getDeviceStatus.mockResolvedValue({
                    message: 'Device status retrieved successfully',
                    status,
                    lastSeenAt: mockRack.lastSeenAt,
                });

                const result = await controller.getStatus(mockUser, testRackId);

                expect(result.status).toBe(status);
            }
        });

        it('should handle null lastSeenAt', async () => {
            mockRacksService.getDeviceStatus.mockResolvedValue({
                message: 'Device status retrieved successfully',
                status: 'OFFLINE',
                lastSeenAt: null,
            });

            const result = await controller.getStatus(mockUser, testRackId);

            expect(result.lastSeenAt).toBeNull();
        });

        it('should throw NotFoundException when rack not found', async () => {
            mockRacksService.getDeviceStatus.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.getStatus(mockUser, testRackId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getDeviceStatus.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch device status'),
            );

            await expect(controller.getStatus(mockUser, testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('create', () => {
        it('should register a new rack successfully', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };

            mockRacksService.create.mockResolvedValue(expectedResponse);

            const result = await controller.create(mockUser, createRackDto);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.create).toHaveBeenCalledWith(mockUser.dbId, createRackDto);
            expect(mockRacksService.create).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.create.mockResolvedValue({
                message: 'Rack registered successfully',
                rackId: testRackId,
            });

            await controller.create(mockUser, createRackDto);

            expect(mockRacksService.create).toHaveBeenCalledWith(mockUser.dbId, createRackDto);
        });

        it('should return recovered rack message when rack was previously archived', async () => {
            const recoveredResponse = {
                message: 'Archived rack recovered succefully.',
                rackId: testRackId,
            };
            mockRacksService.create.mockResolvedValue(recoveredResponse);

            const result = await controller.create(mockUser, createRackDto);

            expect(result).toEqual(recoveredResponse);
        });

        it('should propagate ConflictException for duplicate active MAC address', async () => {
            mockRacksService.create.mockRejectedValue(
                new ConflictException('MAC address already registered'),
            );

            await expect(controller.create(mockUser, createRackDto)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.create.mockRejectedValue(
                new InternalServerErrorException('Failed to register rack'),
            );

            await expect(controller.create(mockUser, createRackDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return response with message and rackId', async () => {
            const expectedResponse = {
                message: 'Rack registered successfully',
                rackId: testRackId,
            };
            mockRacksService.create.mockResolvedValue(expectedResponse);

            const result = await controller.create(mockUser, createRackDto);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rackId');
        });
    });

    describe('update', () => {
        it('should update rack successfully', async () => {
            const expectedResponse = {
                message: 'Rack updated successfully',
                rack: { ...mockRack, ...updateRackDto },
            };

            mockRacksService.update.mockResolvedValue(expectedResponse);

            const result = await controller.update(mockUser, testRackId, updateRackDto);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                updateRackDto,
            );
            expect(mockRacksService.update).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in correct order', async () => {
            mockRacksService.update.mockResolvedValue({
                message: 'Rack updated successfully',
                rack: mockRack,
            });

            await controller.update(mockUser, testRackId, updateRackDto);

            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                updateRackDto,
            );
        });

        it('should handle partial update DTO', async () => {
            const partialUpdate: UpdateRackDto = { name: 'New Name Only' };
            mockRacksService.update.mockResolvedValue({
                message: 'Rack updated successfully',
                rack: { ...mockRack, name: partialUpdate.name },
            });

            await controller.update(mockUser, testRackId, partialUpdate);

            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                partialUpdate,
            );
        });

        it('should handle empty update DTO', async () => {
            const emptyUpdate: UpdateRackDto = {};
            mockRacksService.update.mockResolvedValue({
                message: 'Rack updated successfully',
                rack: mockRack,
            });

            await controller.update(mockUser, testRackId, emptyUpdate);

            expect(mockRacksService.update).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                emptyUpdate,
            );
        });

        it('should throw NotFoundException when rack not found', async () => {
            mockRacksService.update.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.update(mockUser, testRackId, updateRackDto)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.update.mockRejectedValue(
                new InternalServerErrorException('Failed to update rack'),
            );

            await expect(controller.update(mockUser, testRackId, updateRackDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('remove', () => {
        it('should delete rack successfully', async () => {
            const expectedResponse = { message: 'Rack deleted successfully' };
            mockRacksService.delete.mockResolvedValue(expectedResponse);

            const result = await controller.remove(mockUser, testRackId);

            expect(result).toEqual(expectedResponse);
            expect(mockRacksService.delete).toHaveBeenCalledWith(testRackId, mockUser.dbId);
            expect(mockRacksService.delete).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId and userId in the correct order', async () => {
            mockRacksService.delete.mockResolvedValue({ message: 'Rack deleted successfully' });

            await controller.remove(mockUser, testRackId);

            expect(mockRacksService.delete).toHaveBeenCalledWith(testRackId, mockUser.dbId);
        });

        it('should throw NotFoundException when rack not found', async () => {
            mockRacksService.delete.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.remove(mockUser, testRackId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.delete.mockRejectedValue(
                new InternalServerErrorException('Failed to delete rack'),
            );

            await expect(controller.remove(mockUser, testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // ACTIVITY ENDPOINTS
    // ─────────────────────────────────────────────

    describe('getRackActivities', () => {
        it('should return paginated rack activities', async () => {
            mockRacksService.getRackActivities.mockResolvedValue(expectedPaginatedResponse);

            const result = await controller.getRackActivities(mockUser, baseActivityQuery);

            expect(result).toEqual(expectedPaginatedResponse);
            expect(mockRacksService.getRackActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                baseActivityQuery,
            );
            expect(mockRacksService.getRackActivities).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.getRackActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getRackActivities(mockUser, baseActivityQuery);

            expect(mockRacksService.getRackActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should forward the full query object to the service', async () => {
            const filteredQuery: ActivityQueryDto = {
                page: 2,
                limit: 5,
                rackId: [testRackId],
                startDate: '2024-01-01',
                endDate: '2024-12-31',
            };
            mockRacksService.getRackActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getRackActivities(mockUser, filteredQuery);

            expect(mockRacksService.getRackActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                filteredQuery,
            );
        });

        it('should propagate NotFoundException for unauthorized rack filter', async () => {
            mockRacksService.getRackActivities.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(controller.getRackActivities(mockUser, baseActivityQuery)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getRackActivities.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch rack activities'),
            );

            await expect(controller.getRackActivities(mockUser, baseActivityQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('getPlantCareActivities', () => {
        it('should return paginated plant care activities', async () => {
            mockRacksService.getPlantCareActivities.mockResolvedValue(expectedPaginatedResponse);

            const result = await controller.getPlantCareActivities(mockUser, baseActivityQuery);

            expect(result).toEqual(expectedPaginatedResponse);
            expect(mockRacksService.getPlantCareActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                baseActivityQuery,
            );
            expect(mockRacksService.getPlantCareActivities).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.getPlantCareActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getPlantCareActivities(mockUser, baseActivityQuery);

            expect(mockRacksService.getPlantCareActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should forward the full query object to the service', async () => {
            const filteredQuery: ActivityQueryDto = {
                page: 1,
                limit: 10,
                rackId: [testRackId],
                startDate: '2025-02-01',
                endDate: '2025-02-28',
            };
            mockRacksService.getPlantCareActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getPlantCareActivities(mockUser, filteredQuery);

            expect(mockRacksService.getPlantCareActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                filteredQuery,
            );
        });

        it('should propagate NotFoundException for unauthorized rack filter', async () => {
            mockRacksService.getPlantCareActivities.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.getPlantCareActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getPlantCareActivities.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch plant care activities'),
            );

            await expect(
                controller.getPlantCareActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getHarvestActivities', () => {
        const harvestActivityResponse = {
            ...expectedPaginatedResponse,
            totalHarvestCount: 150,
        };

        it('should return paginated harvest activities with totalHarvestCount', async () => {
            mockRacksService.getHarvestActivities.mockResolvedValue(harvestActivityResponse);

            const result = await controller.getHarvestActivities(mockUser, baseActivityQuery);

            expect(result).toEqual(harvestActivityResponse);
            expect(mockRacksService.getHarvestActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                baseActivityQuery,
            );
            expect(mockRacksService.getHarvestActivities).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.getHarvestActivities.mockResolvedValue(harvestActivityResponse);

            await controller.getHarvestActivities(mockUser, baseActivityQuery);

            expect(mockRacksService.getHarvestActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should forward the full query object to the service', async () => {
            const filteredQuery: ActivityQueryDto = {
                page: 1,
                limit: 10,
                rackId: [testRackId],
                startDate: '2025-02-01',
                endDate: '2025-02-28',
            };
            mockRacksService.getHarvestActivities.mockResolvedValue(harvestActivityResponse);

            await controller.getHarvestActivities(mockUser, filteredQuery);

            expect(mockRacksService.getHarvestActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                filteredQuery,
            );
        });

        it('should include totalHarvestCount in the response', async () => {
            mockRacksService.getHarvestActivities.mockResolvedValue(harvestActivityResponse);

            const result = await controller.getHarvestActivities(mockUser, baseActivityQuery);

            expect(result).toHaveProperty('totalHarvestCount', 150);
        });

        it('should propagate NotFoundException for unauthorized rack filter', async () => {
            mockRacksService.getHarvestActivities.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.getHarvestActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getHarvestActivities.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch harvest activities'),
            );

            await expect(
                controller.getHarvestActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getPlantingActivities', () => {
        it('should return paginated planting activities', async () => {
            mockRacksService.getPlantingActivities.mockResolvedValue(expectedPaginatedResponse);

            const result = await controller.getPlantingActivities(mockUser, baseActivityQuery);

            expect(result).toEqual(expectedPaginatedResponse);
            expect(mockRacksService.getPlantingActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                baseActivityQuery,
            );
            expect(mockRacksService.getPlantingActivities).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockRacksService.getPlantingActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getPlantingActivities(mockUser, baseActivityQuery);

            expect(mockRacksService.getPlantingActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should forward the full query object to the service', async () => {
            const filteredQuery: ActivityQueryDto = {
                page: 1,
                limit: 10,
                rackId: [testRackId],
                startDate: '2025-01-01',
                endDate: '2025-12-31',
            };
            mockRacksService.getPlantingActivities.mockResolvedValue(expectedPaginatedResponse);

            await controller.getPlantingActivities(mockUser, filteredQuery);

            expect(mockRacksService.getPlantingActivities).toHaveBeenCalledWith(
                mockUser.dbId,
                filteredQuery,
            );
        });

        it('should propagate NotFoundException for unauthorized rack filter', async () => {
            mockRacksService.getPlantingActivities.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.getPlantingActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.getPlantingActivities.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch planting activities'),
            );

            await expect(
                controller.getPlantingActivities(mockUser, baseActivityQuery),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ─────────────────────────────────────────────
    // RACK OPERATION ENDPOINTS
    // ─────────────────────────────────────────────

    describe('checkAssignToRack', () => {
        const checkNoWarningResponse = {
            hasWarning: false,
            latestTemperatureReading: null,
            maxTemperatureThreshold: 30,
        };

        const checkWithWarningResponse = {
            hasWarning: true,
            latestTemperatureReading: 35,
            maxTemperatureThreshold: 25,
        };

        it('should return check result with no warning', async () => {
            mockRacksService.checkAssignToRack.mockResolvedValue(checkNoWarningResponse);

            const result = await controller.checkAssignToRack(
                testRackId,
                validAssignPlantToRackDto,
                mockUser,
            );

            expect(result).toEqual(checkNoWarningResponse);
            expect(mockRacksService.checkAssignToRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                validAssignPlantToRackDto,
            );
            expect(mockRacksService.checkAssignToRack).toHaveBeenCalledTimes(1);
        });

        it('should return check result with temperature warning', async () => {
            mockRacksService.checkAssignToRack.mockResolvedValue(checkWithWarningResponse);

            const result = await controller.checkAssignToRack(
                testRackId,
                validAssignPlantToRackDto,
                mockUser,
            );

            expect(result).toEqual(checkWithWarningResponse);
            expect(result.hasWarning).toBe(true);
            expect(result.latestTemperatureReading).toBe(35);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.checkAssignToRack.mockResolvedValue(checkNoWarningResponse);

            await controller.checkAssignToRack(testRackId, validAssignPlantToRackDto, mockUser);

            expect(mockRacksService.checkAssignToRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                validAssignPlantToRackDto,
            );
        });

        it('should use the authenticated user dbId, not firebaseUid', async () => {
            mockRacksService.checkAssignToRack.mockResolvedValue(checkNoWarningResponse);

            await controller.checkAssignToRack(testRackId, validAssignPlantToRackDto, mockUser);

            expect(mockRacksService.checkAssignToRack).toHaveBeenCalledWith(
                expect.any(String),
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should propagate NotFoundException when plant does not exist', async () => {
            mockRacksService.checkAssignToRack.mockRejectedValue(
                new NotFoundException('Plant with ID not found'),
            );

            await expect(
                controller.checkAssignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate BadRequestException for inactive plant', async () => {
            mockRacksService.checkAssignToRack.mockRejectedValue(
                new BadRequestException('Cannot assign an inactive plant to a rack'),
            );

            await expect(
                controller.checkAssignToRack(testRackId, inactivePlantAssignDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException when rack already has a plant', async () => {
            mockRacksService.checkAssignToRack.mockRejectedValue(
                new BadRequestException(
                    'This rack already has a plant assigned. Please remove the current plant before assigning a new one.',
                ),
            );

            await expect(
                controller.checkAssignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.checkAssignToRack.mockRejectedValue(
                new InternalServerErrorException('Failed to check plant assignment'),
            );

            await expect(
                controller.checkAssignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('assignToRack', () => {
        it('should assign a plant to a rack successfully', async () => {
            mockRacksService.assignToRack.mockResolvedValue(assignSuccessResponse);

            const result = await controller.assignToRack(
                testRackId,
                validAssignPlantToRackDto,
                mockUser,
            );

            expect(result).toEqual(assignSuccessResponse);
            expect(mockRacksService.assignToRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                validAssignPlantToRackDto,
            );
            expect(mockRacksService.assignToRack).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.assignToRack.mockResolvedValue(assignSuccessResponse);

            await controller.assignToRack(testRackId, validAssignPlantToRackDto, mockUser);

            expect(mockRacksService.assignToRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                validAssignPlantToRackDto,
            );
        });

        it('should propagate BadRequestException for inactive plant', async () => {
            mockRacksService.assignToRack.mockRejectedValue(
                new BadRequestException('Cannot assign an inactive plant to a rack'),
            );

            await expect(
                controller.assignToRack(testRackId, inactivePlantAssignDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException when rack already has a plant', async () => {
            mockRacksService.assignToRack.mockRejectedValue(
                new BadRequestException(
                    'This rack already has a plant assigned. Please remove the current plant before assigning a new one.',
                ),
            );

            await expect(
                controller.assignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack or plant', async () => {
            mockRacksService.assignToRack.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.assignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.assignToRack.mockRejectedValue(
                new InternalServerErrorException('Failed to assign plant to rack'),
            );

            await expect(
                controller.assignToRack(testRackId, validAssignPlantToRackDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('unassignFromRack', () => {
        const unassignDto: UnassignFromRackDto = { plantId: testPlantId };

        it('should remove a plant from a rack successfully', async () => {
            mockRacksService.unassignFromRack.mockResolvedValue(unassignFromRackSuccessResponse);

            const result = await controller.unassignFromRack(testRackId, unassignDto, mockUser);

            expect(result).toEqual(unassignFromRackSuccessResponse);
            expect(mockRacksService.unassignFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                unassignDto,
            );
            expect(mockRacksService.unassignFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.unassignFromRack.mockResolvedValue(unassignFromRackSuccessResponse);

            await controller.unassignFromRack(testRackId, unassignDto, mockUser);

            expect(mockRacksService.unassignFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                unassignDto,
            );
        });

        it('should propagate BadRequestException when plant is not assigned', async () => {
            mockRacksService.unassignFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.unassignFromRack(testRackId, unassignDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockRacksService.unassignFromRack.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.unassignFromRack(testRackId, unassignDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.unassignFromRack.mockRejectedValue(
                new InternalServerErrorException('Failed to remove plant from rack'),
            );

            await expect(
                controller.unassignFromRack(testRackId, unassignDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('harvestPlantFromRack', () => {
        it('should harvest a plant from a rack successfully', async () => {
            mockRacksService.harvestPlantFromRack.mockResolvedValue(harvestSuccessResponse);

            const result = await controller.harvestPlantFromRack(testRackId, harvestDto, mockUser);

            expect(result).toEqual(harvestSuccessResponse);
            expect(mockRacksService.harvestPlantFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestDto,
            );
            expect(mockRacksService.harvestPlantFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.harvestPlantFromRack.mockResolvedValue(harvestSuccessResponse);

            await controller.harvestPlantFromRack(testRackId, harvestDto, mockUser);

            expect(mockRacksService.harvestPlantFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestDto,
            );
        });

        it('should propagate BadRequestException when plant is not assigned', async () => {
            mockRacksService.harvestPlantFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.harvestPlantFromRack(testRackId, harvestDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockRacksService.harvestPlantFromRack.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.harvestPlantFromRack(testRackId, harvestDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.harvestPlantFromRack.mockRejectedValue(
                new InternalServerErrorException('Failed to harvest plant'),
            );

            await expect(
                controller.harvestPlantFromRack(testRackId, harvestDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('harvestLeavesFromRack', () => {
        it('should harvest leaves and return success message', async () => {
            mockRacksService.harvestLeavesFromRack.mockResolvedValue(harvestLeavesSuccessResponse);

            const result = await controller.harvestLeavesFromRack(
                testRackId,
                harvestLeavesDto,
                mockUser,
            );

            expect(result).toEqual(harvestLeavesSuccessResponse);
            expect(mockRacksService.harvestLeavesFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestLeavesDto,
            );
            expect(mockRacksService.harvestLeavesFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.harvestLeavesFromRack.mockResolvedValue(harvestLeavesSuccessResponse);

            await controller.harvestLeavesFromRack(testRackId, harvestLeavesDto, mockUser);

            expect(mockRacksService.harvestLeavesFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestLeavesDto,
            );
        });

        it('should use the authenticated user dbId as the userId', async () => {
            mockRacksService.harvestLeavesFromRack.mockResolvedValue(harvestLeavesSuccessResponse);

            await controller.harvestLeavesFromRack(testRackId, harvestLeavesDto, mockUser);

            expect(mockRacksService.harvestLeavesFromRack).toHaveBeenCalledWith(
                expect.any(String),
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should propagate BadRequestException when plant is not assigned', async () => {
            mockRacksService.harvestLeavesFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.harvestLeavesFromRack(testRackId, harvestLeavesDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException from service', async () => {
            mockRacksService.harvestLeavesFromRack.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.harvestLeavesFromRack(testRackId, harvestLeavesDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.harvestLeavesFromRack.mockRejectedValue(
                new InternalServerErrorException('Failed to harvest leaves'),
            );

            await expect(
                controller.harvestLeavesFromRack(testRackId, harvestLeavesDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('harvestSeedsFromRack', () => {
        it('should harvest seeds and return success message', async () => {
            mockRacksService.harvestSeedsFromRack.mockResolvedValue(harvestSeedsSuccessResponse);

            const result = await controller.harvestSeedsFromRack(
                testRackId,
                harvestSeedsDto,
                mockUser,
            );

            expect(result).toEqual(harvestSeedsSuccessResponse);
            expect(mockRacksService.harvestSeedsFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestSeedsDto,
            );
            expect(mockRacksService.harvestSeedsFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass rackId, userId, and dto in the correct order', async () => {
            mockRacksService.harvestSeedsFromRack.mockResolvedValue(harvestSeedsSuccessResponse);

            await controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser);

            expect(mockRacksService.harvestSeedsFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                harvestSeedsDto,
            );
        });

        it('should forward the full dto including quantity to the service', async () => {
            mockRacksService.harvestSeedsFromRack.mockResolvedValue(harvestSeedsSuccessResponse);
            const dtoWithQuantity: HarvestSeedsDto = { plantId: testPlantId, quantity: 7 };

            await controller.harvestSeedsFromRack(testRackId, dtoWithQuantity, mockUser);

            expect(mockRacksService.harvestSeedsFromRack).toHaveBeenCalledWith(
                testRackId,
                mockUser.dbId,
                dtoWithQuantity,
            );
        });

        it('should use the authenticated user dbId as the userId', async () => {
            mockRacksService.harvestSeedsFromRack.mockResolvedValue(harvestSeedsSuccessResponse);

            await controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser);

            expect(mockRacksService.harvestSeedsFromRack).toHaveBeenCalledWith(
                expect.any(String),
                mockUser.dbId,
                expect.any(Object),
            );
        });

        it('should propagate BadRequestException — plant not assigned', async () => {
            mockRacksService.harvestSeedsFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException — below minimum threshold', async () => {
            mockRacksService.harvestSeedsFromRack.mockRejectedValue(
                new BadRequestException(
                    'Cannot harvest seeds — rack must have at least 2 seeds to harvest any (quantity must be at least 2)',
                ),
            );

            await expect(
                controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException — above maximum threshold', async () => {
            mockRacksService.harvestSeedsFromRack.mockRejectedValue(
                new BadRequestException(
                    'Cannot harvest 10 seeds — maximum allowed is 9 (rack quantity minus 1)',
                ),
            );

            await expect(
                controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException from service', async () => {
            mockRacksService.harvestSeedsFromRack.mockRejectedValue(
                new NotFoundException(`Rack ${testRackId} not found or access denied`),
            );

            await expect(
                controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockRacksService.harvestSeedsFromRack.mockRejectedValue(
                new InternalServerErrorException('Failed to harvest seeds'),
            );

            await expect(
                controller.harvestSeedsFromRack(testRackId, harvestSeedsDto, mockUser),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ─────────────────────────────────────────────
    // CROSS-CUTTING CONCERNS
    // ─────────────────────────────────────────────

    describe('authentication — dbId vs firebaseUid', () => {
        it('should use dbId, not firebaseUid, when calling service methods', async () => {
            mockRacksService.create.mockResolvedValue({
                message: 'Rack registered successfully',
                rackId: testRackId,
            });

            await controller.create(mockUser, createRackDto);

            expect(mockRacksService.create).toHaveBeenCalledWith(mockUser.dbId, createRackDto);
            expect(mockRacksService.create).not.toHaveBeenCalledWith(
                mockUser.firebaseUid,
                createRackDto,
            );
        });

        it('should use dbId for all write operations', async () => {
            mockRacksService.assignToRack.mockResolvedValue(assignSuccessResponse);
            mockRacksService.unassignFromRack.mockResolvedValue(unassignFromRackSuccessResponse);
            mockRacksService.harvestPlantFromRack.mockResolvedValue(harvestSuccessResponse);

            await controller.assignToRack(testRackId, validAssignPlantToRackDto, mockUser);
            await controller.unassignFromRack(testRackId, { plantId: testPlantId }, mockUser);
            await controller.harvestPlantFromRack(testRackId, harvestDto, mockUser);

            for (const method of [
                mockRacksService.assignToRack,
                mockRacksService.unassignFromRack,
                mockRacksService.harvestPlantFromRack,
            ]) {
                expect(method).toHaveBeenCalledWith(
                    expect.any(String),
                    mockUser.dbId,
                    expect.any(Object),
                );
            }
        });
    });

    describe('response format consistency', () => {
        it('create should return message and rackId', async () => {
            mockRacksService.create.mockResolvedValue({
                message: 'Rack registered successfully',
                rackId: testRackId,
            });

            const result = await controller.create(mockUser, createRackDto);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rackId');
        });

        it('findOne should return message and rack', async () => {
            mockRacksService.findById.mockResolvedValue({
                message: 'Rack details retrieved successfully',
                rack: mockRack,
            });

            const result = await controller.findOne(mockUser, testRackId);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rack');
        });

        it('update should return message and rack', async () => {
            mockRacksService.update.mockResolvedValue({
                message: 'Rack updated successfully',
                rack: mockRack,
            });

            const result = await controller.update(mockUser, testRackId, updateRackDto);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rack');
        });

        it('remove should return message only', async () => {
            mockRacksService.delete.mockResolvedValue({ message: 'Rack deleted successfully' });

            const result = await controller.remove(mockUser, testRackId);

            expect(result).toHaveProperty('message');
            expect(result).not.toHaveProperty('rack');
        });

        it('assignToRack should return message only', async () => {
            mockRacksService.assignToRack.mockResolvedValue(assignSuccessResponse);

            const result = await controller.assignToRack(
                testRackId,
                validAssignPlantToRackDto,
                mockUser,
            );

            expect(result).toHaveProperty('message');
        });

        it('checkAssignToRack should return hasWarning, latestTemperatureReading, maxTemperatureThreshold', async () => {
            mockRacksService.checkAssignToRack.mockResolvedValue({
                hasWarning: false,
                latestTemperatureReading: null,
                maxTemperatureThreshold: null,
            });

            const result = await controller.checkAssignToRack(
                testRackId,
                validAssignPlantToRackDto,
                mockUser,
            );

            expect(result).toHaveProperty('hasWarning');
            expect(result).toHaveProperty('latestTemperatureReading');
            expect(result).toHaveProperty('maxTemperatureThreshold');
        });

        it('getHarvestActivities should include totalHarvestCount alongside pagination meta', async () => {
            mockRacksService.getHarvestActivities.mockResolvedValue({
                ...expectedPaginatedResponse,
                totalHarvestCount: 42,
            });

            const result = await controller.getHarvestActivities(mockUser, baseActivityQuery);

            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(result).toHaveProperty('totalHarvestCount');
        });
    });
});
