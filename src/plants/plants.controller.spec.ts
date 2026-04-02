import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';
import { createMockPlantsService } from '../../test/mocks';
import {
    testPlantIds,
    validCreatePlantDto,
    validUpdatePlantDto,
    defaultPlantQuery,
    leafyGreensQuery,
    paginatedPlantsResponse,
    plantCreatedResponse,
    plantUpdatedResponse,
    plantDeletedResponse,
    plantDetailsResponse,
} from '../../test/fixtures';

describe('PlantsController', () => {
    let controller: PlantsController;

    const mockPlantsService = createMockPlantsService();

    const testPlantId = testPlantIds.primary;

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
});
