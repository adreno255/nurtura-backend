import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PlantsService } from './plants.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { type Prisma } from '../generated/prisma';
import { createMockDatabaseService, createMockLogger } from '../../test/mocks';
import {
    testPlantIds,
    mockPlant,
    mockPlants,
    validCreatePlantDto,
    validUpdatePlantDto,
    defaultPlantQuery,
    leafyGreensQuery,
    activeOnlyQuery,
} from '../../test/fixtures';

describe('PlantsService', () => {
    let service: PlantsService;

    const mockDatabaseService = createMockDatabaseService();
    const mockLoggerService = createMockLogger();

    const testPlantId = testPlantIds.primary;
    const testRackId = 'rack-123';

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PlantsService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
            ],
        }).compile();

        service = module.get<PlantsService>(PlantsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // create
    // ─────────────────────────────────────────────

    describe('create', () => {
        it('should create a plant successfully', async () => {
            mockDatabaseService.plant.create.mockResolvedValue(mockPlant);

            const result = await service.create(validCreatePlantDto);

            expect(result).toEqual({ message: 'Plant created successfully', plant: mockPlant });
            expect(mockDatabaseService.plant.create).toHaveBeenCalledWith({
                data: {
                    name: validCreatePlantDto.name,
                    category: validCreatePlantDto.category,
                    recommendedSoil: validCreatePlantDto.recommendedSoil,
                    description: validCreatePlantDto.description,
                },
            });
        });

        it('should log creation attempt and success', async () => {
            mockDatabaseService.plant.create.mockResolvedValue(mockPlant);

            await service.create(validCreatePlantDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Creating plant: ${validCreatePlantDto.name}`,
                'PlantsService',
            );
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Plant created successfully: ${mockPlant.id}`,
                'PlantsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.create.mockRejectedValue(new Error('DB error'));

            await expect(service.create(validCreatePlantDto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.create(validCreatePlantDto)).rejects.toThrow(
                'Failed to create plant',
            );
        });

        it('should log error on failure', async () => {
            const dbError = new Error('DB connection failed');
            mockDatabaseService.plant.create.mockRejectedValue(dbError);

            await expect(service.create(validCreatePlantDto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Error creating plant',
                dbError.message,
                'PlantsService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // findAll
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        it('should return paginated plants with no filters', async () => {
            mockDatabaseService.plant.findMany.mockResolvedValue(mockPlants);
            mockDatabaseService.plant.count.mockResolvedValue(mockPlants.length);

            const result = await service.findAll(defaultPlantQuery);

            expect(result.data).toEqual(mockPlants);
            expect(result.meta.totalItems).toBe(mockPlants.length);
            expect(result.meta.currentPage).toBe(1);
        });

        it('should apply category filter to query', async () => {
            mockDatabaseService.plant.findMany.mockResolvedValue([mockPlant]);
            mockDatabaseService.plant.count.mockResolvedValue(1);

            await service.findAll(leafyGreensQuery);

            expect(mockDatabaseService.plant.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        category: leafyGreensQuery.category,
                    }) as unknown as Prisma.PlantFindManyArgs,
                }),
            );
        });

        it('should apply isActive filter to query', async () => {
            mockDatabaseService.plant.findMany.mockResolvedValue([mockPlant]);
            mockDatabaseService.plant.count.mockResolvedValue(1);

            await service.findAll(activeOnlyQuery);

            expect(mockDatabaseService.plant.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isActive: true,
                    }) as unknown as Prisma.PlantFindManyArgs,
                }),
            );
        });

        it('should omit filters when not provided', async () => {
            mockDatabaseService.plant.findMany.mockResolvedValue(mockPlants);
            mockDatabaseService.plant.count.mockResolvedValue(mockPlants.length);

            await service.findAll(defaultPlantQuery);

            expect(mockDatabaseService.plant.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: {} }),
            );
        });

        it('should order results by createdAt descending', async () => {
            mockDatabaseService.plant.findMany.mockResolvedValue(mockPlants);
            mockDatabaseService.plant.count.mockResolvedValue(mockPlants.length);

            await service.findAll(defaultPlantQuery);

            expect(mockDatabaseService.plant.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findMany.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.findAll(defaultPlantQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // findOne
    // ─────────────────────────────────────────────

    describe('findOne', () => {
        it('should return a plant by ID', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);

            const result = await service.findOne(testPlantId);

            expect(result).toEqual({ message: 'Plant retrieved successfully', plant: mockPlant });
            expect(mockDatabaseService.plant.findUnique).toHaveBeenCalledWith({
                where: { id: testPlantId },
            });
        });

        it('should throw NotFoundException when plant does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);

            await expect(service.findOne(testPlantIds.nonExistent)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findOne(testPlantIds.nonExistent)).rejects.toThrow(
                `Plant with ID ${testPlantIds.nonExistent} not found`,
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findUnique.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.findOne(testPlantId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────

    describe('update', () => {
        it('should update a plant successfully', async () => {
            const updatedPlant = { ...mockPlant, name: 'Updated Lettuce' };
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.plant.update.mockResolvedValue(updatedPlant);

            const result = await service.update(testPlantId, validUpdatePlantDto);

            expect(result).toEqual({ message: 'Plant updated successfully', plant: updatedPlant });
            expect(mockDatabaseService.plant.update).toHaveBeenCalledWith({
                where: { id: testPlantId },
                data: {
                    name: validUpdatePlantDto.name,
                    category: validUpdatePlantDto.category,
                    recommendedSoil: validUpdatePlantDto.recommendedSoil,
                    description: validUpdatePlantDto.description,
                    isActive: validUpdatePlantDto.isActive,
                },
            });
        });

        it('should throw NotFoundException when plant does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);

            await expect(
                service.update(testPlantIds.nonExistent, validUpdatePlantDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should log success', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.plant.update.mockResolvedValue(mockPlant);

            await service.update(testPlantId, validUpdatePlantDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Plant updated successfully: ${testPlantId}`,
                'PlantsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(mockPlant);
            mockDatabaseService.plant.update.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.update(testPlantId, validUpdatePlantDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // remove
    // ─────────────────────────────────────────────

    describe('remove', () => {
        it('should delete a plant not assigned to any rack', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({ ...mockPlant, racks: [] });
            mockDatabaseService.plant.delete.mockResolvedValue(mockPlant);

            const result = await service.remove(testPlantId);

            expect(result).toEqual({ message: 'Plant deleted successfully' });
            expect(mockDatabaseService.plant.delete).toHaveBeenCalledWith({
                where: { id: testPlantId },
            });
        });

        it('should throw NotFoundException when plant does not exist', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);

            await expect(service.remove(testPlantIds.nonExistent)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ConflictException when plant is assigned to a rack', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({
                ...mockPlant,
                racks: [{ id: testRackId }],
            });

            await expect(service.remove(testPlantId)).rejects.toThrow(ConflictException);
            await expect(service.remove(testPlantId)).rejects.toThrow(
                'Cannot delete a plant that is currently assigned to one or more racks',
            );
        });

        it('should check racks relation when fetching plant for deletion', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({ ...mockPlant, racks: [] });
            mockDatabaseService.plant.delete.mockResolvedValue(mockPlant);

            await service.remove(testPlantId);

            expect(mockDatabaseService.plant.findUnique).toHaveBeenCalledWith({
                where: { id: testPlantId },
                include: { racks: { select: { id: true } } },
            });
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({ ...mockPlant, racks: [] });
            mockDatabaseService.plant.delete.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.remove(testPlantId)).rejects.toThrow(InternalServerErrorException);
        });
    });
});
