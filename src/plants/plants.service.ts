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
import { ActivityQueryDto } from '../common/dto/activity-query.dto';

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
     * Get rack-plant assignment history for a specific rack (Planting Activity).
     * Already covers the "Planting Activity" screen.
     */
    /**
     * Get Planting Activity — RackPlantHistory records across all user racks.
     * Supports date range filtering on plantedAt.
     * Returns paginated results + `amount` count within the date range.
     */
    async getPlantingActivities(
        userId: string,
        query: ActivityQueryDto,
    ): Promise<{ data: object[]; meta: object; amount: number }> {
        try {
            const userRacks = await this.databaseService.rack.findMany({
                where: { userId },
                select: { id: true },
            });
            const rackIds = userRacks.map((r) => r.id);

            const dateFilter =
                query.startDate || query.endDate
                    ? {
                          plantedAt: {
                              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                          },
                      }
                    : {};

            const where = {
                rackId: { in: rackIds },
                ...dateFilter,
            };

            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [history, totalItems] = await Promise.all([
                this.databaseService.rackPlantHistory.findMany({
                    where,
                    orderBy: { plantedAt: 'desc' },
                    skip,
                    take,
                    include: {
                        plant: { select: { id: true, name: true, category: true } },
                        rack: { select: { id: true, name: true, macAddress: true } },
                    },
                }),
                this.databaseService.rackPlantHistory.count({ where }),
            ]);

            this.logger.log(
                `Retrieved ${history.length} planting activity records for user ${userId}`,
                'PlantsService',
            );

            return {
                ...PaginationHelper.createResponse(history, totalItems, query),
                amount: totalItems,
            };
        } catch (error) {
            this.logger.error(
                `Error fetching planting activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch planting activities');
        }
    }

    /**
     * Get Plant Care Activity — watering and grow light events across all user racks.
     * Event types: WATERING_ON, WATERING_OFF, LIGHT_ON, LIGHT_OFF.
     * Includes associated rack and current plant info.
     * Returns paginated results + `amount` count within the date range.
     */
    async getPlantCareActivities(
        userId: string,
        query: ActivityQueryDto,
    ): Promise<{ data: object[]; meta: object; amount: number }> {
        try {
            const userRacks = await this.databaseService.rack.findMany({
                where: { userId },
                select: { id: true },
            });
            const rackIds = userRacks.map((r) => r.id);

            const dateFilter =
                query.startDate || query.endDate
                    ? {
                          timestamp: {
                              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                          },
                      }
                    : {};

            const where = {
                rackId: { in: rackIds },
                eventType: {
                    in: [
                        ActivityEventType.WATERING_ON,
                        ActivityEventType.WATERING_OFF,
                        ActivityEventType.LIGHT_ON,
                        ActivityEventType.LIGHT_OFF,
                    ],
                },
                ...dateFilter,
            };

            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [activities, totalItems] = await Promise.all([
                this.databaseService.activity.findMany({
                    where,
                    orderBy: { timestamp: 'desc' },
                    skip,
                    take,
                    include: {
                        rack: {
                            select: {
                                id: true,
                                name: true,
                                macAddress: true,
                                currentPlantId: true,
                                currentPlant: {
                                    select: { id: true, name: true, category: true },
                                },
                            },
                        },
                    },
                }),
                this.databaseService.activity.count({ where }),
            ]);

            this.logger.log(
                `Retrieved ${activities.length} plant care activities for user ${userId}`,
                'PlantsService',
            );

            return {
                ...PaginationHelper.createResponse(activities, totalItems, query),
                amount: totalItems,
            };
        } catch (error) {
            this.logger.error(
                `Error fetching plant care activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch plant care activities');
        }
    }

    /**
     * Get Harvest Activity — PLANT_HARVESTED events across all user racks.
     * Returns paginated results + `amount` count within the date range
     * + `totalHarvestCount` summed from activity metadata.
     */
    async getHarvestActivities(
        userId: string,
        query: ActivityQueryDto,
    ): Promise<{ data: object[]; meta: object; amount: number; totalHarvestCount: number }> {
        try {
            const userRacks = await this.databaseService.rack.findMany({
                where: { userId },
                select: { id: true },
            });
            const rackIds = userRacks.map((r) => r.id);

            const dateFilter =
                query.startDate || query.endDate
                    ? {
                          timestamp: {
                              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                          },
                      }
                    : {};

            const where = {
                rackId: { in: rackIds },
                eventType: ActivityEventType.PLANT_HARVESTED,
                ...dateFilter,
            };

            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [activities, totalItems] = await Promise.all([
                this.databaseService.activity.findMany({
                    where,
                    orderBy: { timestamp: 'desc' },
                    skip,
                    take,
                    include: {
                        rack: {
                            select: {
                                id: true,
                                name: true,
                                macAddress: true,
                                currentPlantId: true,
                                currentPlant: {
                                    select: { id: true, name: true, category: true },
                                },
                            },
                        },
                    },
                }),
                this.databaseService.activity.count({ where }),
            ]);

            // Sum the quantity from metadata across all harvest events in the date range
            // to give the frontend a total pieces/heads harvested count
            const allInRange = await this.databaseService.activity.findMany({
                where,
                select: { metadata: true },
            });

            const totalHarvestCount = allInRange.reduce((sum, act) => {
                const meta = act.metadata as Record<string, unknown> | null;
                const qty = typeof meta?.['quantity'] === 'number' ? meta['quantity'] : 0;
                return sum + qty;
            }, 0);

            this.logger.log(
                `Retrieved ${activities.length} harvest activities for user ${userId} (total count: ${totalHarvestCount})`,
                'PlantsService',
            );

            return {
                ...PaginationHelper.createResponse(activities, totalItems, query),
                amount: totalItems,
                totalHarvestCount,
            };
        } catch (error) {
            this.logger.error(
                `Error fetching harvest activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch harvest activities');
        }
    }
}
