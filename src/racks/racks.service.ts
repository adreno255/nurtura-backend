import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { ActivityEventType, DeviceStatus } from '../generated/prisma/client';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginationHelper } from '../common/utils/pagination.helper';
import {
    type RackCreatedResponse,
    type RackUpdatedResponse,
    type RackDeletedResponse,
    type RackDetailsResponse,
    type DeviceStatusResponse,
    type RackCurrentStateResponse,
} from './interfaces/rack.interface';
import { type PaginatedResponse } from '../common/interfaces/pagination.interface';
import { type Rack } from '../generated/prisma/client';
import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceErrorDto, DeviceStatusDto, ErrorSeverity } from './dto';
import { Activity, NotificationType, Prisma } from '../generated/prisma';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { ActivityQueryDto } from '../common/dto/activity-query.dto';
import {
    AssignPlantToRackDto,
    HarvestPlantDto,
    HarvestLeavesDto,
    HarvestSeedsDto,
    UnassignFromRackDto,
} from './dto/rack-operations.dto';

@Injectable()
export class RacksService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logRackActivityHelper: LogRackActivityHelper,
        private readonly eventEmitter: EventEmitter2,
        private readonly logger: MyLoggerService,
    ) {}

    // ─────────────────────────────────────────────
    // CRUD OPERATIONS
    // ─────────────────────────────────────────────

    /**
     * Get all racks for a user
     *
     * @param userId - User ID
     * @returns Array of racks
     */
    async findAll(userId: string, query: PaginationQueryDto): Promise<PaginatedResponse<Rack>> {
        try {
            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [racks, totalItems] = await Promise.all([
                this.databaseService.rack.findMany({
                    where: { userId },
                    skip,
                    take,
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
                }),
                this.databaseService.rack.count({ where: { userId } }),
            ]);

            this.logger.log(
                `Retrieved ${racks.length} racks for user ${userId} (page ${query.page ?? 1})`,
                'RacksService',
            );

            return PaginationHelper.createResponse(racks, totalItems, query);
        } catch (error) {
            this.logger.error(
                `Error fetching racks for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch racks');
        }
    }

    /**
     * Get a single rack by ID
     *
     * @param rackId - Rack ID
     * @param userId - User ID
     * @returns Rack details
     */
    async findById(rackId: string, userId: string): Promise<RackDetailsResponse> {
        try {
            const rack = await this.databaseService.rack.findFirst({
                where: { id: rackId, userId },
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

            if (!rack) {
                throw new NotFoundException(`Rack ${rackId} not found or access denied`);
            }

            this.logger.log(`Rack details fetched: ${rackId}`, 'RacksService');

            return { message: 'Rack details retrieved successfully', rack };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch rack details');
        }
    }

    async findByMacAddress(macAddress: string): Promise<Rack | null> {
        try {
            const rack = await this.databaseService.rack.findUnique({
                where: { macAddress },
            });

            return rack;
        } catch (error) {
            this.logger.error(
                `Error finding rack by MAC address: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to find rack by MAC address');
        }
    }

    /**
     * Register a new rack (ESP32 device) to the system
     *
     * @param userId - User ID who owns the rack
     * @param createRackDto - Rack creation data
     * @returns Created rack
     */
    async create(userId: string, dto: CreateRackDto): Promise<RackCreatedResponse> {
        try {
            const existingRack = await this.databaseService.rack.findUnique({
                where: { userId, macAddress: dto.macAddress },
            });

            if (existingRack) {
                throw new ConflictException(`MAC address already registered to ${userId}`);
            }

            const mqttTopic =
                dto.mqttTopic || `nurtura/rack/${dto.macAddress.replace(/:/g, '-').toLowerCase()}`;

            const rack = await this.databaseService.rack.create({
                data: {
                    userId,
                    name: dto.name,
                    macAddress: dto.macAddress,
                    mqttTopic,
                    description: dto.description,
                },
            });

            this.logger.log(
                `Rack created successfully: ${rack.id} for user ${userId}`,
                'RacksService',
            );

            // Log RACK_ADDED activity (non-critical — don't let it fail the response)
            await this.logRackActivityHelper.logActivity(
                rack.id,
                ActivityEventType.RACK_ADDED,
                `Rack "${rack.name}" registered`,
                { rackName: rack.name, macAddress: rack.macAddress, userId },
            );

            return {
                message: 'Rack registered successfully',
                rackId: rack.id,
            };
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }

            this.logger.error(
                `Error creating rack for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to register rack');
        }
    }

    /**
     * Update rack information
     *
     * @param rackId - Rack ID
     * @param userId - User ID (for authorization)
     * @param updateData - Data to update
     * @returns Updated rack
     */
    async update(rackId: string, userId: string, dto: UpdateRackDto): Promise<RackUpdatedResponse> {
        try {
            await this.verifyRackOwnership(rackId, userId);

            // Fetch current rack before update to capture the old name for the activity log
            const currentRack = await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: { name: true, macAddress: true },
            });

            const updatedRack = await this.databaseService.rack.update({
                where: { id: rackId },
                data: {
                    name: dto.name,
                    mqttTopic: dto.mqttTopic,
                    description: dto.description,
                },
            });

            this.logger.log(`Rack updated successfully: ${rackId}`, 'RacksService');

            // Log RACK_RENAMED activity only if the name actually changed
            if (dto.name && dto.name !== currentRack?.name) {
                await this.logRackActivityHelper.logActivity(
                    rackId,
                    ActivityEventType.RACK_RENAMED,
                    `Rack renamed from "${currentRack?.name}" to "${dto.name}"`,
                    {
                        oldName: currentRack?.name,
                        newName: dto.name,
                        macAddress: currentRack?.macAddress,
                        userId,
                    },
                );
            }

            return {
                message: 'Rack updated successfully',
                rack: updatedRack,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error updating rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to update rack');
        }
    }

    /**
     * Delete (soft delete) a rack
     *
     * @param rackId - Rack ID
     * @param userId - User ID
     */
    async delete(rackId: string, userId: string): Promise<RackDeletedResponse> {
        try {
            const rack = await this.databaseService.rack.findFirst({
                where: { id: rackId, userId },
            });

            if (!rack) {
                throw new NotFoundException(`Rack ${rackId} not found or access denied`);
            }

            await this.databaseService.rack.update({
                where: { id: rackId },
                data: { isActive: false },
            });

            this.logger.log(`Rack soft deleted: ${rackId}`, 'RacksService');

            // Log RACK_REMOVED activity
            await this.logRackActivityHelper.logActivity(
                rackId,
                ActivityEventType.RACK_REMOVED,
                `Rack "${rack.name}" removed`,
                { rackName: rack.name, macAddress: rack.macAddress, userId },
            );

            return { message: 'Rack deleted successfully' };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error deleting rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to delete rack');
        }
    }

    // Ownership & Validation

    async verifyRackOwnership(rackId: string, userId: string): Promise<boolean> {
        try {
            const rack = await this.databaseService.rack.findFirst({
                where: {
                    id: rackId,
                    userId,
                },
            });

            if (!rack) {
                throw new NotFoundException(`Rack ${rackId} not found or access denied`);
            }

            return true;
        } catch (error) {
            this.logger.error(
                `Error verifying rack ownership: ${rackId} for user: ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw error;
        }
    }

    private async resolveAuthorizedRackIds(
        userId: string,
        requestedRackIds?: string[],
    ): Promise<string[]> {
        const userRacks = await this.databaseService.rack.findMany({
            where: { userId },
            select: { id: true },
        });
        const userRackIds = userRacks.map((r) => r.id);

        if (requestedRackIds?.length) {
            for (const rackId of requestedRackIds) {
                await this.verifyRackOwnership(rackId, userId);
            }
        }

        return requestedRackIds?.length
            ? requestedRackIds.filter((id) => userRackIds.includes(id))
            : userRackIds;
    }

    // Current State Operations

    /**
     * Processes device status updates received from ESP32 devices via MQTT
     * Called by MqttService when a message arrives on nurtura/rack/{macAddress}/status
     *
     * @param macAddress - Device MAC address (e.g., AA:BB:CC:DD:EE:FF)
     * @param message - Raw JSON message from MQTT
     */
    async processDeviceStatus(macAddress: string, message: string): Promise<void> {
        this.logger.log(`Processing device status from: ${macAddress}`, 'RacksService');

        // Step 1: Parse and validate the JSON message
        const statusData = await MqttMessageParser.parseAndValidate(
            message,
            DeviceStatusDto,
            macAddress,
        );

        // Step 2: Find the rack by MAC address
        const rack = await this.findByMacAddress(macAddress);

        if (!rack) {
            this.logger.warn(
                `Received status update from unregistered device: ${macAddress}`,
                'RacksService',
            );
            throw new BadRequestException(
                `Device with MAC address ${macAddress} is not registered`,
            );
        }

        // Step 3: Update rack status in database
        try {
            const newStatus: DeviceStatus = statusData.online
                ? DeviceStatus.ONLINE
                : DeviceStatus.OFFLINE;
            const oldStatus = rack.status;

            await this.databaseService.rack.update({
                where: { id: rack.id },
                data: {
                    status: newStatus,
                    lastSeenAt: new Date(),
                    ...(statusData.online ? { lastActivityAt: new Date() } : {}),
                },
            });

            this.logger.log(
                `Rack ${rack.name} (${rack.id}) status updated: ${oldStatus} → ${newStatus}`,
                'RacksService',
            );

            // Step 4: Log status change activity if status changed
            if (oldStatus !== newStatus) {
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    statusData.online
                        ? ActivityEventType.DEVICE_ONLINE
                        : ActivityEventType.DEVICE_OFFLINE,
                    `Device status changed from ${oldStatus} to ${newStatus}`,
                    statusData as unknown as Prisma.InputJsonValue,
                );

                this.logger.log(
                    `Activity logged for rack ${rack.id}: ${oldStatus} → ${newStatus}`,
                    'RacksService',
                );
            }

            // Step 5: Broadcast status update to connected clients via WebSocket
            this.eventEmitter.emit('broadcastDeviceStatus', newStatus);

            this.logger.log(
                `Status update broadcasted to WebSocket clients for rack: ${rack.id}`,
                'RacksService',
            );
        } catch (error) {
            this.logger.error(
                `Failed to process device status for: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );

            throw new InternalServerErrorException('Failed to process device status');
        }
    }

    /**
     * Processes device error messages received from ESP32 devices via MQTT
     * Called by MqttService when a message arrives on nurtura/rack/{macAddress}/errors
     *
     * @param macAddress - Device MAC address (e.g., AA:BB:CC:DD:EE:FF)
     * @param message - Raw JSON message from MQTT
     */
    async processDeviceError(macAddress: string, message: string): Promise<void> {
        this.logger.warn(`Processing device error from: ${macAddress}`, 'RacksService');

        // Step 1: Parse and validate the JSON message
        const errorData = await MqttMessageParser.parseAndValidate(
            message,
            DeviceErrorDto,
            macAddress,
        );

        // Step 2: Find the rack by MAC address
        const rack = await this.findByMacAddress(macAddress);

        if (!rack) {
            this.logger.warn(
                `Received error from unregistered device: ${macAddress}`,
                'RacksService',
            );
            throw new BadRequestException(
                `Device with MAC address ${macAddress} is not registered`,
            );
        }

        // Step 3: Update rack status to ERROR
        try {
            if (rack.status !== 'ERROR') {
                await this.databaseService.rack.update({
                    where: { id: rack.id },
                    data: {
                        status: 'ERROR',
                        lastSeenAt: new Date(),
                    },
                });

                this.logger.warn(
                    `Rack ${rack.name} (${rack.id}) marked as ERROR due to: ${errorData.code}`,
                    'RacksService',
                );
                // Step 4: Create notification for the user
                const alert = await this.databaseService.notification.create({
                    data: {
                        userId: rack.userId,
                        rackId: rack.id,
                        type:
                            errorData.severity === ErrorSeverity.CRITICAL
                                ? NotificationType.ALERT
                                : NotificationType.WARNING,
                        title: `Device Error: ${errorData.code}`,
                        message: errorData.message,
                        metadata: errorData as unknown as Prisma.InputJsonValue,
                    },
                });

                this.logger.log(
                    `Notification created for rack ${rack.name} (${rack.id}) regarding error: ${errorData.code}`,
                    'RacksService',
                );

                // Step 5: Broadcast error to connected clients via WebSocket
                this.eventEmitter.emit('broadcastNotification', alert);

                this.eventEmitter.emit('broadcastDeviceStatus', rack.status);

                this.logger.warn(
                    `Device error broadcasted to WebSocket clients for rack: ${rack.id}`,
                    'RacksService',
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to process device error for: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );

            throw new InternalServerErrorException('Failed to process device error');
        }
    }

    async getLatestSensorReading(rackId: string) {
        try {
            const reading = await this.databaseService.sensorReading.findFirst({
                where: { rackId },
                orderBy: { timestamp: 'desc' },
            });

            return reading;
        } catch (error) {
            this.logger.error(
                `Error fetching latest sensor reading for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch latest sensor reading');
        }
    }

    async getCurrentState(rackId: string, userId: string): Promise<RackCurrentStateResponse> {
        try {
            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    lastSeenAt: true,
                    currentPlant: {
                        select: { id: true, name: true, category: true, recommendedSoil: true },
                    },
                },
            })) as RackCurrentStateResponse['rack'];

            const latestReading = await this.getLatestSensorReading(rackId);

            return {
                message: 'Current rack state retrieved successfully',
                rack,
                latestReading: latestReading
                    ? {
                          temperature: latestReading.temperature,
                          humidity: latestReading.humidity,
                          moisture: latestReading.moisture,
                          lightLevel: latestReading.lightLevel,
                          waterUsed: latestReading.waterUsed,
                          timestamp: latestReading.timestamp,
                      }
                    : null,
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching current state for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch current rack state');
        }
    }

    async getDeviceStatus(rackId: string, userId: string): Promise<DeviceStatusResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: {
                    status: true,
                    lastSeenAt: true,
                },
            })) as Rack;

            return {
                message: 'Device status retrieved successfully',
                status: rack.status,
                lastSeenAt: rack.lastSeenAt,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error fetching device status for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch device status');
        }
    }

    // ─────────────────────────────────────────────
    // STATISTICS & ANALYTICS
    // ─────────────────────────────────────────────

    async getRackActivities(
        userId: string,
        query: ActivityQueryDto,
    ): Promise<PaginatedResponse<Activity>> {
        try {
            const queryRackIds = await this.resolveAuthorizedRackIds(userId, query.rackId);

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
                rackId: { in: queryRackIds },
                eventType: {
                    in: [
                        ActivityEventType.RACK_ADDED,
                        ActivityEventType.RACK_RENAMED,
                        ActivityEventType.RACK_REMOVED,
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
                }),
                this.databaseService.activity.count({ where }),
            ]);

            this.logger.log(
                `Retrieved ${activities.length} rack activities for user ${userId}`,
                'RacksService',
            );

            return PaginationHelper.createResponse(activities, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching rack activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch rack activities');
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
    ): Promise<PaginatedResponse<Activity>> {
        try {
            const queryRackIds = await this.resolveAuthorizedRackIds(userId, query.rackId);

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
                rackId: { in: queryRackIds },
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
                }),
                this.databaseService.activity.count({ where }),
            ]);

            this.logger.log(
                `Retrieved ${activities.length} plant care activities for user ${userId}`,
                'PlantsService',
            );

            return PaginationHelper.createResponse(activities, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

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
    ): Promise<PaginatedResponse<Activity> & { totalHarvestCount: number }> {
        try {
            const queryRackIds = await this.resolveAuthorizedRackIds(userId, query.rackId);

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
                rackId: { in: queryRackIds },
                eventType: ActivityEventType.PLANT_HARVESTED,
                ...dateFilter,
            };

            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [activities, totalItems, allInRange] = await Promise.all([
                this.databaseService.activity.findMany({
                    where,
                    orderBy: { timestamp: 'desc' },
                    skip,
                    take,
                }),
                this.databaseService.activity.count({ where }),
                this.databaseService.activity.findMany({
                    where,
                    select: { metadata: true },
                }),
            ]);

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
                totalHarvestCount,
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching harvest activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch harvest activities');
        }
    }

    /**
     * Get rack-plant assignment history for a specific rack (Planting Activity).
     * Already covers the "Planting Activity" screen.
     */
    /**
     * Get Planting Activity — RackPlantingHistory records across all user racks.
     * Supports date range filtering on plantedAt.
     * Returns paginated results + `amount` count within the date range.
     */
    async getPlantingActivities(
        userId: string,
        query: ActivityQueryDto,
    ): Promise<PaginatedResponse<Activity>> {
        try {
            const queryRackIds = await this.resolveAuthorizedRackIds(userId, query.rackId);

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
                rackId: { in: queryRackIds },
                eventType: {
                    in: [
                        ActivityEventType.PLANT_ADDED,
                        ActivityEventType.PLANT_CHANGED,
                        ActivityEventType.PLANT_REMOVED,
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
                }),
                this.databaseService.activity.count({ where }),
            ]);

            this.logger.log(
                `Retrieved ${activities.length} planting activities for user ${userId}`,
                'PlantsService',
            );

            return PaginationHelper.createResponse(activities, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching planting activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to fetch planting activities');
        }
    }

    // ─────────────────────────────────────────────
    // RACK ASSIGNMENT OPERATIONS
    // ─────────────────────────────────────────────

    /**
     * Scenario 1: Harvest Leaves — increments harvestCount, rack and plant assignment unchanged.
     * Logs LEAVES_HARVESTED activity.
     */
    async harvestLeavesFromRack(
        rackId: string,
        userId: string,
        dto: HarvestLeavesDto,
    ): Promise<{ message: string }> {
        try {
            const plantId = dto.plantId;

            this.logger.log(
                `Harvesting leaves from plant ${plantId} in rack ${rackId}`,
                'RacksService',
            );

            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
                include: { currentPlant: { select: { name: true } } },
            })) as Rack & { currentPlant: { name: string } };

            if (rack.currentPlantId !== plantId) {
                throw new BadRequestException('This plant is not currently assigned to that rack');
            }

            const now = new Date();
            const newHarvestCount = rack.harvestCount + 1;

            // No transaction needed — only one write, rack stays planted
            await this.databaseService.rack.update({
                where: { id: rackId },
                data: {
                    lastHarvestAt: now,
                    harvestCount: newHarvestCount,
                    lastActivityAt: now,
                },
            });

            await this.logRackActivityHelper.logActivity(
                rackId,
                ActivityEventType.LEAVES_HARVESTED,
                `Leaves harvested from plant "${rack.currentPlant?.name ?? plantId}"`,
                {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId,
                    plantName: rack.currentPlant?.name,
                    harvestCount: newHarvestCount,
                    harvestedAt: now.toISOString(),
                },
            );

            this.logger.log(
                `Leaves harvested from plant ${plantId} in rack ${rackId} (total harvests: ${newHarvestCount})`,
                'RacksService',
            );

            return { message: 'Leaves harvested successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error harvesting leaves from plant ${dto.plantId} in rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to harvest leaves');
        }
    }

    /**
     * Scenario 2: Harvest All — removes plant from rack, increments harvestCount.
     * Logs PLANT_HARVESTED activity.
     */
    async harvestPlantFromRack(
        rackId: string,
        userId: string,
        dto: HarvestPlantDto,
    ): Promise<{ message: string }> {
        try {
            const plantId = dto.plantId;

            this.logger.log(`Harvesting plant ${plantId} from rack ${rackId}`, 'PlantsService');

            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
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
                    await tx.rackPlantingHistory.updateMany({
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
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId,
                    plantName: rack.currentPlant?.name,
                    harvestCount: newHarvestCount,
                    quantity: rack.quantity,
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
                `Error harvesting plant ${dto.plantId} from rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'PlantsService',
            );
            throw new InternalServerErrorException('Failed to harvest plant');
        }
    }

    /**
     * Scenario 3: Take Seeds — decrements rack quantity, increments harvestCount.
     * Quantity taken must be between 1 and (current quantity - 1).
     * Logs SEEDS_HARVESTED activity.
     */
    async harvestSeedsFromRack(
        rackId: string,
        userId: string,
        dto: HarvestSeedsDto,
    ): Promise<{ message: string }> {
        try {
            const { plantId, quantity } = dto;

            this.logger.log(
                `Taking ${quantity} seeds from plant ${plantId} in rack ${rackId}`,
                'RacksService',
            );

            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
                include: { currentPlant: { select: { name: true } } },
            })) as Rack & { currentPlant: { name: string } };

            if (rack.currentPlantId !== plantId) {
                throw new BadRequestException('This plant is not currently assigned to that rack');
            }

            const maxSeedsAllowed = rack.quantity - 1;

            if (maxSeedsAllowed < 1) {
                throw new BadRequestException(
                    'Cannot harvest seeds — rack must have at least 2 seeds to harvest any (quantity must be at least 2)',
                );
            }

            if (quantity > maxSeedsAllowed) {
                throw new BadRequestException(
                    `Cannot harvest ${quantity} seeds — maximum allowed is ${maxSeedsAllowed} (rack quantity minus 1)`,
                );
            }

            const now = new Date();
            const newQuantity = rack.quantity - quantity;
            const newHarvestCount = rack.harvestCount + 1;

            await this.databaseService.rack.update({
                where: { id: rackId },
                data: {
                    quantity: newQuantity,
                    lastHarvestAt: now,
                    harvestCount: newHarvestCount,
                    lastActivityAt: now,
                },
            });

            await this.logRackActivityHelper.logActivity(
                rackId,
                ActivityEventType.SEEDS_HARVESTED,
                `${quantity} seed(s) harvested from plant "${rack.currentPlant?.name ?? plantId}"`,
                {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId,
                    plantName: rack.currentPlant?.name,
                    quantityTaken: quantity,
                    remainingQuantity: newQuantity,
                    harvestCount: newHarvestCount,
                    harvestedAt: now.toISOString(),
                },
            );

            this.logger.log(
                `${quantity} seed(s) harvested from plant ${plantId} in rack ${rackId} — remaining: ${newQuantity}`,
                'RacksService',
            );

            return { message: 'Seeds harvested successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error harvesting seeds from plant ${dto.plantId} in rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to harvest seeds');
        }
    }

    /**
     * Assign a plant to a rack.
     *
     * Activity logic:
     * - Rack has NO current plant → PLANT_ADDED
     * - Rack has a DIFFERENT current plant → PLANT_CHANGED (old plant recorded as removed without harvest)
     *   Also logs PLANT_REMOVED for the outgoing plant.
     */
    async assignToRack(
        rackId: string,
        userId: string,
        dto: AssignPlantToRackDto,
    ): Promise<{ message: string }> {
        try {
            const plantId = dto.plantId;

            this.logger.log(`Assigning plant ${plantId} to rack ${rackId}`, 'RacksService');

            const plant = await this.databaseService.plant.findUnique({
                where: { id: plantId },
            });

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            if (!plant.isActive) {
                throw new BadRequestException('Cannot assign an inactive plant to a rack');
            }

            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
                include: { currentPlant: true },
            })) as Rack & { currentPlant: { name: string } | null };

            const plantedAt = dto.plantedAt ? new Date(dto.plantedAt) : new Date();
            const now = new Date();
            const hadPreviousPlant = rack.currentPlantId !== null;
            const isChangingPlant = hadPreviousPlant && rack.currentPlantId !== plantId;
            const isSamePlantReassignment = hadPreviousPlant && rack.currentPlantId === plantId;

            if (isSamePlantReassignment) {
                throw new BadRequestException(
                    'This plant is already assigned to that rack. To update quantity or planted date, please use the appropriate update endpoint.',
                );
            }

            await this.databaseService.$transaction(async (tx) => {
                if (isChangingPlant && rack.plantedAt) {
                    await tx.rackPlantingHistory.create({
                        data: {
                            rackId: rack.id,
                            plantId: rack.currentPlantId!,
                            quantity: rack.quantity,
                            plantedAt: rack.plantedAt,
                            harvestedAt: null,
                            harvestCount: 0,
                        },
                    });
                }

                await tx.rack.update({
                    where: { id: rack.id },
                    data: {
                        currentPlantId: plantId,
                        quantity: dto.quantity,
                        plantedAt,
                        lastActivityAt: now,
                    },
                });

                await tx.rackPlantingHistory.create({
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

            if (isChangingPlant) {
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_REMOVED,
                    `Plant removed from rack (replaced during crop rotation)`,
                    {
                        rackName: rack.name,
                        macAddress: rack.macAddress,
                        removedPlantId: rack.currentPlantId,
                        removedPlantName: rack.currentPlant?.name,
                        replacedByPlantId: plantId,
                        replacedByPlantName: plant.name,
                    },
                );

                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_CHANGED,
                    `Plant changed from previous to "${plant.name}"`,
                    {
                        rackName: rack.name,
                        macAddress: rack.macAddress,
                        previousPlantId: rack.currentPlantId,
                        previousPlantName: rack.currentPlant?.name,
                        newPlantId: plantId,
                        newPlantName: plant.name,
                        quantity: dto.quantity,
                    },
                );
            } else {
                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    ActivityEventType.PLANT_ADDED,
                    `Plant "${plant.name}" added to rack`,
                    {
                        rackName: rack.name,
                        macAddress: rack.macAddress,
                        plantId,
                        plantName: plant.name,
                        quantity: dto.quantity,
                        plantedAt: plantedAt.toISOString(),
                    },
                );
            }

            this.logger.log(
                `Plant ${plantId} successfully assigned to rack ${rackId}`,
                'RacksService',
            );

            return { message: 'Plant assigned to rack successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error assigning plant ${dto.plantId} to rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to assign plant to rack');
        }
    }

    /**
     * Remove a plant from a rack WITHOUT harvesting (failure/death case).
     * Logs PLANT_REMOVED activity.
     */
    async unassignFromRack(
        rackId: string,
        userId: string,
        dto: UnassignFromRackDto,
    ): Promise<{ message: string }> {
        try {
            const plantId = dto.plantId;

            this.logger.log(`Removing plant ${plantId} from rack ${rackId}`, 'RacksService');

            await this.verifyRackOwnership(rackId, userId);

            const rack = (await this.databaseService.rack.findUnique({
                where: { id: rackId },
            })) as Rack;

            if (rack.currentPlantId !== plantId) {
                throw new BadRequestException('This plant is not currently assigned to that rack');
            }

            const now = new Date();

            await this.databaseService.$transaction(async (tx) => {
                if (rack.plantedAt) {
                    await tx.rackPlantingHistory.updateMany({
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
                {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    removedPlantId: plantId,
                    replacedByPlantId: null,
                },
            );

            this.logger.log(`Plant ${plantId} removed from rack ${rackId}`, 'RacksService');

            return { message: 'Plant removed from rack successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error removing plant ${dto.plantId} from rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to remove plant from rack');
        }
    }

    // ─────────────────────────────────────────────
    // ACTIVITY LOGGING & DEVICE STATUS UPDATES
    // ─────────────────────────────────────────────

    // Unused methods for now, but could be useful for admin dashboards or user activity feeds in the future

    async getRecentActivities(rackId: string, userId: string, limit: number = 50) {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            const activities = await this.databaseService.activity.findMany({
                where: { rackId },
                orderBy: { timestamp: 'desc' },
                take: limit,
            });

            return activities;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error fetching activities for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch activities');
        }
    }

    async updateDeviceStatus(rackId: string, status: DeviceStatus): Promise<void> {
        try {
            await this.databaseService.rack.update({
                where: { id: rackId },
                data: { status },
            });

            this.logger.log(`Device status updated for rack ${rackId}: ${status}`, 'RacksService');
        } catch (error) {
            this.logger.error(
                `Error updating device status for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to update device status');
        }
    }

    async updateLastSeenAt(rackId: string): Promise<void> {
        try {
            await this.databaseService.rack.update({
                where: { id: rackId },
                data: { lastSeenAt: new Date() },
            });

            this.logger.log(`Last seen updated for rack ${rackId}`, 'RacksService');
        } catch (error) {
            this.logger.error(
                `Error updating last seen for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to update last seen time');
        }
    }
}
