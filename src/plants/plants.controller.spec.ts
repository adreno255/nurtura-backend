import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';
import { createMockPlantsService } from '../../test/mocks';
import {
    testUser,
    testPlantIds,
    validCreatePlantDto,
    validUpdatePlantDto,
    validAssignPlantToRackDto,
    defaultPlantQuery,
    leafyGreensQuery,
    paginatedPlantsResponse,
    paginatedHistoryResponse,
    plantCreatedResponse,
    plantUpdatedResponse,
    plantDeletedResponse,
    plantDetailsResponse,
    assignSuccessResponse,
    removeFromRackSuccessResponse,
    harvestSuccessResponse,
} from '../../test/fixtures';

describe('PlantsController', () => {
    let controller: PlantsController;

    const mockPlantsService = createMockPlantsService();

    const testPlantId = testPlantIds.primary;
    const testRackId = 'rack-123';

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PlantsController],
            providers: [
                {
                    provide: PlantsService,
                    useValue: mockPlantsService,
                },
            ],
        }).compile();

        controller = module.get<PlantsController>(PlantsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // findAll
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        it('should return paginated plants', async () => {
            mockPlantsService.findAll.mockResolvedValue(paginatedPlantsResponse);

            const result = await controller.findAll(defaultPlantQuery);

            expect(result).toEqual(paginatedPlantsResponse);
            expect(mockPlantsService.findAll).toHaveBeenCalledWith(defaultPlantQuery);
            expect(mockPlantsService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should pass category filter to service', async () => {
            mockPlantsService.findAll.mockResolvedValue(paginatedPlantsResponse);

            await controller.findAll(leafyGreensQuery);

            expect(mockPlantsService.findAll).toHaveBeenCalledWith(leafyGreensQuery);
        });

        it('should return empty paginated response when no plants found', async () => {
            const emptyResponse = {
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
            mockPlantsService.findAll.mockResolvedValue(emptyResponse);

            const result = await controller.findAll(defaultPlantQuery);

            expect(result.data).toHaveLength(0);
            expect(result.meta.totalItems).toBe(0);
        });

        it('should propagate service errors', async () => {
            mockPlantsService.findAll.mockRejectedValue(new Error('Failed to fetch plants'));

            await expect(controller.findAll(defaultPlantQuery)).rejects.toThrow(
                'Failed to fetch plants',
            );
        });
    });

    // ─────────────────────────────────────────────
    // findOne
    // ─────────────────────────────────────────────

    describe('findOne', () => {
        it('should return a plant by ID', async () => {
            mockPlantsService.findOne.mockResolvedValue(plantDetailsResponse);

            const result = await controller.findOne(testPlantId);

            expect(result).toEqual(plantDetailsResponse);
            expect(mockPlantsService.findOne).toHaveBeenCalledWith(testPlantId);
            expect(mockPlantsService.findOne).toHaveBeenCalledTimes(1);
        });

        it('should propagate NotFoundException from service', async () => {
            mockPlantsService.findOne.mockRejectedValue(
                new NotFoundException(`Plant with ID ${testPlantId} not found`),
            );

            await expect(controller.findOne(testPlantId)).rejects.toThrow(NotFoundException);
        });

        it('should pass the correct plant ID to service', async () => {
            mockPlantsService.findOne.mockResolvedValue(plantDetailsResponse);

            await controller.findOne(testPlantIds.secondary);

            expect(mockPlantsService.findOne).toHaveBeenCalledWith(testPlantIds.secondary);
        });
    });

    // ─────────────────────────────────────────────
    // create
    // ─────────────────────────────────────────────

    describe('create', () => {
        it('should create a plant successfully', async () => {
            mockPlantsService.create.mockResolvedValue(plantCreatedResponse);

            const result = await controller.create(validCreatePlantDto);

            expect(result).toEqual(plantCreatedResponse);
            expect(mockPlantsService.create).toHaveBeenCalledWith(validCreatePlantDto);
            expect(mockPlantsService.create).toHaveBeenCalledTimes(1);
        });

        it('should pass the full DTO to service', async () => {
            mockPlantsService.create.mockResolvedValue(plantCreatedResponse);

            await controller.create(validCreatePlantDto);

            expect(mockPlantsService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: validCreatePlantDto.name,
                    category: validCreatePlantDto.category,
                    recommendedSoil: validCreatePlantDto.recommendedSoil,
                }),
            );
        });

        it('should propagate service errors', async () => {
            mockPlantsService.create.mockRejectedValue(new Error('Failed to create plant'));

            await expect(controller.create(validCreatePlantDto)).rejects.toThrow(
                'Failed to create plant',
            );
        });
    });

    // ─────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────

    describe('update', () => {
        it('should update a plant successfully', async () => {
            mockPlantsService.update.mockResolvedValue(plantUpdatedResponse);

            const result = await controller.update(testPlantId, validUpdatePlantDto);

            expect(result).toEqual(plantUpdatedResponse);
            expect(mockPlantsService.update).toHaveBeenCalledWith(testPlantId, validUpdatePlantDto);
            expect(mockPlantsService.update).toHaveBeenCalledTimes(1);
        });

        it('should propagate NotFoundException from service', async () => {
            mockPlantsService.update.mockRejectedValue(
                new NotFoundException(`Plant with ID ${testPlantId} not found`),
            );

            await expect(controller.update(testPlantId, validUpdatePlantDto)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should pass correct id and dto to service', async () => {
            mockPlantsService.update.mockResolvedValue(plantUpdatedResponse);

            await controller.update(testPlantIds.secondary, validUpdatePlantDto);

            expect(mockPlantsService.update).toHaveBeenCalledWith(
                testPlantIds.secondary,
                validUpdatePlantDto,
            );
        });
    });

    // ─────────────────────────────────────────────
    // remove
    // ─────────────────────────────────────────────

    describe('remove', () => {
        it('should delete a plant successfully', async () => {
            mockPlantsService.remove.mockResolvedValue(plantDeletedResponse);

            const result = await controller.remove(testPlantId);

            expect(result).toEqual(plantDeletedResponse);
            expect(mockPlantsService.remove).toHaveBeenCalledWith(testPlantId);
            expect(mockPlantsService.remove).toHaveBeenCalledTimes(1);
        });

        it('should propagate NotFoundException from service', async () => {
            mockPlantsService.remove.mockRejectedValue(
                new NotFoundException(`Plant with ID ${testPlantId} not found`),
            );

            await expect(controller.remove(testPlantId)).rejects.toThrow(NotFoundException);
        });

        it('should propagate ConflictException when plant is assigned to a rack', async () => {
            mockPlantsService.remove.mockRejectedValue(
                new ConflictException(
                    'Cannot delete a plant that is currently assigned to one or more racks.',
                ),
            );

            await expect(controller.remove(testPlantId)).rejects.toThrow(ConflictException);
        });
    });

    // ─────────────────────────────────────────────
    // assignToRack
    // ─────────────────────────────────────────────

    describe('assignToRack', () => {
        it('should assign a plant to a rack successfully', async () => {
            mockPlantsService.assignToRack.mockResolvedValue(assignSuccessResponse);

            const result = await controller.assignToRack(
                testPlantId,
                validAssignPlantToRackDto,
                testUser,
            );

            expect(result).toEqual(assignSuccessResponse);
            expect(mockPlantsService.assignToRack).toHaveBeenCalledWith(
                testPlantId,
                testUser.dbId,
                validAssignPlantToRackDto,
            );
            expect(mockPlantsService.assignToRack).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockPlantsService.assignToRack.mockResolvedValue(assignSuccessResponse);

            await controller.assignToRack(testPlantId, validAssignPlantToRackDto, testUser);

            expect(mockPlantsService.assignToRack).toHaveBeenCalledWith(
                expect.any(String),
                testUser.dbId,
                expect.any(Object),
            );
        });

        it('should propagate BadRequestException for inactive plant', async () => {
            mockPlantsService.assignToRack.mockRejectedValue(
                new BadRequestException('Cannot assign an inactive plant to a rack'),
            );

            await expect(
                controller.assignToRack(testPlantId, validAssignPlantToRackDto, testUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockPlantsService.assignToRack.mockRejectedValue(
                new NotFoundException('Rack not found or does not belong to you'),
            );

            await expect(
                controller.assignToRack(testPlantId, validAssignPlantToRackDto, testUser),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ─────────────────────────────────────────────
    // removeFromRack
    // ─────────────────────────────────────────────

    describe('removeFromRack', () => {
        it('should remove a plant from a rack successfully', async () => {
            mockPlantsService.removeFromRack.mockResolvedValue(removeFromRackSuccessResponse);

            const result = await controller.removeFromRack(testPlantId, testRackId, testUser);

            expect(result).toEqual(removeFromRackSuccessResponse);
            expect(mockPlantsService.removeFromRack).toHaveBeenCalledWith(
                testPlantId,
                testRackId,
                testUser.dbId,
            );
            expect(mockPlantsService.removeFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockPlantsService.removeFromRack.mockResolvedValue(removeFromRackSuccessResponse);

            await controller.removeFromRack(testPlantId, testRackId, testUser);

            expect(mockPlantsService.removeFromRack).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                testUser.dbId,
            );
        });

        it('should propagate BadRequestException when plant is not in rack', async () => {
            mockPlantsService.removeFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.removeFromRack(testPlantId, testRackId, testUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockPlantsService.removeFromRack.mockRejectedValue(
                new NotFoundException('Rack not found or does not belong to you'),
            );

            await expect(
                controller.removeFromRack(testPlantId, testRackId, testUser),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ─────────────────────────────────────────────
    // harvestFromRack
    // ─────────────────────────────────────────────

    describe('harvestFromRack', () => {
        it('should harvest a plant from a rack successfully', async () => {
            mockPlantsService.harvestFromRack.mockResolvedValue(harvestSuccessResponse);

            const result = await controller.harvestFromRack(testPlantId, testRackId, testUser);

            expect(result).toEqual(harvestSuccessResponse);
            expect(mockPlantsService.harvestFromRack).toHaveBeenCalledWith(
                testPlantId,
                testRackId,
                testUser.dbId,
            );
            expect(mockPlantsService.harvestFromRack).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockPlantsService.harvestFromRack.mockResolvedValue(harvestSuccessResponse);

            await controller.harvestFromRack(testPlantId, testRackId, testUser);

            expect(mockPlantsService.harvestFromRack).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                testUser.dbId,
            );
        });

        it('should propagate BadRequestException when plant is not in rack', async () => {
            mockPlantsService.harvestFromRack.mockRejectedValue(
                new BadRequestException('This plant is not currently assigned to that rack'),
            );

            await expect(
                controller.harvestFromRack(testPlantId, testRackId, testUser),
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockPlantsService.harvestFromRack.mockRejectedValue(
                new NotFoundException('Rack not found or does not belong to you'),
            );

            await expect(
                controller.harvestFromRack(testPlantId, testRackId, testUser),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ─────────────────────────────────────────────
    // getRackHistory
    // ─────────────────────────────────────────────

    describe('getRackHistory', () => {
        it('should return paginated planting history for a rack', async () => {
            mockPlantsService.getRackHistory.mockResolvedValue(paginatedHistoryResponse);

            const result = await controller.getRackHistory(testRackId, defaultPlantQuery, testUser);

            expect(result).toEqual(paginatedHistoryResponse);
            expect(mockPlantsService.getRackHistory).toHaveBeenCalledWith(
                testRackId,
                testUser.dbId,
                defaultPlantQuery,
            );
            expect(mockPlantsService.getRackHistory).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            mockPlantsService.getRackHistory.mockResolvedValue(paginatedHistoryResponse);

            await controller.getRackHistory(testRackId, defaultPlantQuery, testUser);

            expect(mockPlantsService.getRackHistory).toHaveBeenCalledWith(
                expect.any(String),
                testUser.dbId,
                expect.any(Object),
            );
        });

        it('should propagate NotFoundException for missing rack', async () => {
            mockPlantsService.getRackHistory.mockRejectedValue(
                new NotFoundException('Rack not found or does not belong to you'),
            );

            await expect(
                controller.getRackHistory(testRackId, defaultPlantQuery, testUser),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
