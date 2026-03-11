import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
    ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { PaginationHelper } from '../common/utils/pagination.helper';
import { ActivityEventType, type Rack, type Plant } from '../generated/prisma';
import { type PaginatedResponse } from '../common/interfaces/pagination.interface';
import {
    type PlantCreatedResponse,
    type PlantUpdatedResponse,
    type PlantDeletedResponse,
    type PlantDetailsResponse,
} from './interfaces/plant.interface';
import { CreatePlantDto, UpdatePlantDto, AssignPlantToRackDto, PlantCategoryQueryDto } from './dto';
import { RacksService } from '../racks/racks.service';

@Injectable()
export class PlantsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logRackActivityHelper: LogRackActivityHelper,
        private readonly racksService: RacksService,
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

    // ─────────────────────────────────────────────
    // RACK ASSIGNMENT OPERATIONS
    // ─────────────────────────────────────────────

    /**
     * Assign a plant to a rack.
     *
     * Activity logic:
     * - Rack has NO current plant → PLANT_ADDED
     * - Rack has a DIFFERENT current plant → PLANT_CHANGED (old plant recorded as removed without harvest)
     *   Also logs PLANT_REMOVED for the outgoing plant.
     */
    async assignToRack(
        plantId: string,
        userId: string,
        dto: AssignPlantToRackDto,
    ): Promise<{ message: string }> {
        try {
            this.logger.log(`Assigning plant ${plantId} to rack ${dto.rackId}`, 'PlantsService');

            // Verify plant exists and is active
            const plant = await this.databaseService.plant.findUnique({
                where: { id: plantId },
            });

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            if (!plant.isActive) {
                throw new BadRequestException('Cannot assign an inactive plant to a rack');
            }

            // Verify rack belongs to user
            await this.racksService.verifyRackOwnership(dto.rackId, userId);

            const rack = (await this.databaseService.rack.findFirst({
                where: { id: dto.rackId, userId },
            })) as Rack;

            const plantedAt = dto.plantedAt ? new Date(dto.plantedAt) : new Date();
            const now = new Date();
            const hadPreviousPlant = rack.currentPlantId !== null;
            const isChangingPlant = hadPreviousPlant && rack.currentPlantId !== plantId;

            await this.databaseService.$transaction(async (tx) => {
                // If changing plants, close out the previous RackPlantHistory entry
                if (isChangingPlant && rack.plantedAt) {
                    await tx.rackPlantHistory.create({
                        data: {
                            rackId: rack.id,
                            plantId: rack.currentPlantId!,
                            quantity: rack.quantity,
                            plantedAt: rack.plantedAt,
                            harvestedAt: null, // removed, not harvested
                            harvestCount: 0,
                        },
                    });
                }

                // Update rack with new plant
                await tx.rack.update({
                    where: { id: rack.id },
                    data: {
                        currentPlantId: plantId,
                        quantity: dto.quantity,
                        plantedAt,
                        lastActivityAt: now,
                    },
                });

                // Create new history entry for the incoming plant
                await tx.rackPlantHistory.create({
                    data: {
                        rackId: rack.id,
                        plantId,
                        quantity: dto.quantity,
                        plantedAt,
                        harvestedAt: null,
                        harvestCount: 0,
                    },
                });
            });

            // Log activity outside transaction (non-critical)
            if (isChangingPlant) {
                // First log the removal of the old plant
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_REMOVED,
                    `Plant removed from rack (replaced during crop rotation)`,
                    { removedPlantId: rack.currentPlantId, replacedByPlantId: plantId },
                );

                // Then log the change
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_CHANGED,
                    `Plant changed from previous to "${plant.name}"`,
                    {
                        previousPlantId: rack.currentPlantId,
                        newPlantId: plantId,
                        newPlantName: plant.name,
                        quantity: dto.quantity,
                    },
                );
            } else {
                // Fresh planting
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_ADDED,
                    `Plant "${plant.name}" added to rack`,
                    {
                        plantId,
                        plantName: plant.name,
                        quantity: dto.quantity,
                        plantedAt: plantedAt.toISOString(),
                    },
                );
            }

            this.logger.log(
                `Plant ${plantId} successfully assigned to rack ${dto.rackId}`,
                'PlantsService',
            );

            return { message: 'Plant assigned to rack successfully' };
        } catch (error) {
            console.log('FULL ERROR:', error);
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error assigning plant ${plantId} to rack ${dto.rackId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to assign plant to rack');
        }
    }

    /**
     * Remove a plant from a rack WITHOUT harvesting (failure/death case).
     * Logs PLANT_REMOVED activity.
     */
    async removeFromRack(
        plantId: string,
        rackId: string,
        userId: string,
    ): Promise<{ message: string }> {
        try {
            this.logger.log(`Removing plant ${plantId} from rack ${rackId}`, 'PlantsService');

            await this.racksService.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findFirst({
                where: { id: rackId, userId },
            })) as Rack;

            if (rack.currentPlantId !== plantId) {
                throw new BadRequestException('This plant is not currently assigned to that rack');
            }

            const now = new Date();

            await this.databaseService.$transaction(async (tx) => {
                // Close history entry (no harvest)
                if (rack.plantedAt) {
                    await tx.rackPlantHistory.updateMany({
                        where: {
                            rackId,
                            plantId,
                            harvestedAt: null,
                        },
                        data: { harvestedAt: now },
                    });
                }

                await tx.rack.update({
                    where: { id: rackId },
                    data: {
                        currentPlantId: null,
                        quantity: 0,
                        plantedAt: null,
                        lastActivityAt: now,
                    },
                });
            });

            await this.logRackActivityHelper.logActivity(
                rackId,
                ActivityEventType.PLANT_REMOVED,
                `Plant removed from rack (without harvest)`,
                { plantId, rackId },
            );

            this.logger.log(`Plant ${plantId} removed from rack ${rackId}`, 'PlantsService');

            return { message: 'Plant removed from rack successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error removing plant ${plantId} from rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to remove plant from rack');
        }
    }

    /**
     * Harvest the current plant from a rack (successful completion).
     * Logs PLANT_HARVESTED activity.
     */
    async harvestFromRack(
        plantId: string,
        rackId: string,
        userId: string,
    ): Promise<{ message: string }> {
        try {
            this.logger.log(`Harvesting plant ${plantId} from rack ${rackId}`, 'PlantsService');

            await this.racksService.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findFirst({
                where: { id: rackId, userId },
                include: { currentPlant: { select: { name: true } } },
            })) as Rack & { currentPlant: { name: string } };

            if (rack.currentPlantId !== plantId) {
                throw new BadRequestException('This plant is not currently assigned to that rack');
            }

            const now = new Date();
            const newHarvestCount = rack.harvestCount + 1;

            await this.databaseService.$transaction(async (tx) => {
                // Update history record with harvest date and count
                if (rack.plantedAt) {
                    await tx.rackPlantHistory.updateMany({
                        where: {
                            rackId,
                            plantId,
                            harvestedAt: null,
                        },
                        data: {
                            harvestedAt: now,
                            harvestCount: newHarvestCount,
                        },
                    });
                }

                // Clear plant from rack
                await tx.rack.update({
                    where: { id: rackId },
                    data: {
                        currentPlantId: null,
                        quantity: 0,
                        plantedAt: null,
                        lastHarvestAt: now,
                        harvestCount: newHarvestCount,
                        lastActivityAt: now,
                    },
                });
            });

            await this.logRackActivityHelper.logActivity(
                rackId,
                ActivityEventType.PLANT_HARVESTED,
                `Plant "${rack.currentPlant?.name ?? plantId}" harvested from rack`,
                {
                    plantId,
                    rackId,
                    harvestCount: newHarvestCount,
                    harvestedAt: now.toISOString(),
                },
            );

            this.logger.log(
                `Plant ${plantId} harvested from rack ${rackId} (total harvests: ${newHarvestCount})`,
                'PlantsService',
            );

            return { message: 'Plant harvested successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error harvesting plant ${plantId} from rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to harvest plant');
        }
    }

    /**
     * Get planting history for a rack
     */
    async getRackHistory(
        rackId: string,
        userId: string,
        query: PlantCategoryQueryDto,
    ): Promise<PaginatedResponse<object>> {
        try {
            this.logger.log(`Fetching plant history for rack ${rackId}`, 'PlantsService');

            await this.racksService.verifyRackOwnership(rackId, userId);

            const [history, totalItems] = await Promise.all([
                this.databaseService.rackPlantHistory.findMany({
                    where: { rackId },
                    include: {
                        plant: {
                            select: { id: true, name: true, category: true, recommendedSoil: true },
                        },
                    },
                    orderBy: { plantedAt: 'desc' },
                    ...PaginationHelper.getPrismaOptions(query),
                }),
                this.databaseService.rackPlantHistory.count({ where: { rackId } }),
            ]);

            return PaginationHelper.createResponse(history, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching rack history for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch rack plant history');
        }
    }
}
