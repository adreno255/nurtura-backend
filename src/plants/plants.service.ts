import {
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { PaginationHelper } from '../common/utils/pagination.helper';
import { type Plant } from '../generated/prisma';
import { type PaginatedResponse } from '../common/interfaces/pagination.interface';
import {
    type PlantCreatedResponse,
    type PlantUpdatedResponse,
    type PlantDeletedResponse,
    type PlantDetailsResponse,
} from './interfaces/plant.interface';
import { CreatePlantDto, UpdatePlantDto, PlantCategoryQueryDto } from './dto';

@Injectable()
export class PlantsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    /**
     * Create a new plant entry in the catalog
     */
    async create(dto: CreatePlantDto): Promise<PlantCreatedResponse> {
        try {
            this.logger.log(`Creating plant: ${dto.name}`, 'PlantsService');

            const plant = await this.databaseService.plant.create({
                data: {
                    name: dto.name,
                    category: dto.category,
                    recommendedSoil: dto.recommendedSoil,
                    description: dto.description,
                },
            });

            this.logger.log(`Plant created successfully: ${plant.id}`, 'PlantsService');

            return { message: 'Plant created successfully', plant };
        } catch (error) {
            this.logger.error(
                'Error creating plant',
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to create plant');
        }
    }

    /**
     * Get all plants with optional filtering by category and pagination
     */
    async findAll(query: PlantCategoryQueryDto): Promise<PaginatedResponse<Plant>> {
        try {
            this.logger.log(
                `Fetching plants - category: ${query.category ?? 'all'}, isActive: ${query.isActive ?? 'all'}`,
                'PlantsService',
            );

            const where = {
                ...(query.category !== undefined && { category: query.category }),
                ...(query.isActive !== undefined && { isActive: query.isActive }),
            };

            const [plants, totalItems] = await Promise.all([
                this.databaseService.plant.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    ...PaginationHelper.getPrismaOptions(query),
                }),
                this.databaseService.plant.count({ where }),
            ]);

            return PaginationHelper.createResponse(plants, totalItems, query);
        } catch (error) {
            this.logger.error(
                'Error fetching plants',
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch plants');
        }
    }

    /**
     * Get a single plant by ID
     */
    async findOne(plantId: string): Promise<PlantDetailsResponse> {
        try {
            this.logger.log(`Fetching plant: ${plantId}`, 'PlantsService');

            const plant = await this.databaseService.plant.findUnique({
                where: { id: plantId },
            });

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            return { message: 'Plant retrieved successfully', plant };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching plant ${plantId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch plant');
        }
    }

    /**
     * Update a plant in the catalog
     */
    async update(plantId: string, dto: UpdatePlantDto): Promise<PlantUpdatedResponse> {
        try {
            this.logger.log(`Updating plant: ${plantId}`, 'PlantsService');

            const existing = await this.databaseService.plant.findUnique({
                where: { id: plantId },
            });

            if (!existing) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            const plant = await this.databaseService.plant.update({
                where: { id: plantId },
                data: {
                    name: dto.name,
                    category: dto.category,
                    recommendedSoil: dto.recommendedSoil,
                    description: dto.description,
                    isActive: dto.isActive,
                },
            });

            this.logger.log(`Plant updated successfully: ${plantId}`, 'PlantsService');

            return { message: 'Plant updated successfully', plant };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error updating plant ${plantId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to update plant');
        }
    }

    /**
     * Delete a plant from the catalog.
     * Prevented if the plant is currently assigned to any rack.
     */
    async remove(plantId: string): Promise<PlantDeletedResponse> {
        try {
            this.logger.log(`Deleting plant: ${plantId}`, 'PlantsService');

            const plant = await this.databaseService.plant.findUnique({
                where: { id: plantId },
                include: { racks: { select: { id: true } } },
            });

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            if (plant.racks.length > 0) {
                throw new ConflictException(
                    'Cannot delete a plant that is currently assigned to one or more racks. Remove it from all racks first.',
                );
            }

            await this.databaseService.plant.delete({ where: { id: plantId } });

            this.logger.log(`Plant deleted successfully: ${plantId}`, 'PlantsService');

            return { message: 'Plant deleted successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ConflictException)
                throw error;

            this.logger.error(
                `Error deleting plant ${plantId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to delete plant');
        }
    }
}
