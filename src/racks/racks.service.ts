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
    RackExistsResponse,
    AssignPlantToRackResponse,
    AssignPlantToRackCheckResponse,
} from './interfaces/rack.interface';
import { type PaginatedResponse } from '../common/interfaces/pagination.interface';
import { type Rack } from '../generated/prisma/client';
import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    DeviceErrorDto,
    DeviceStatusDto,
    PlantCareActivityQueryDto,
    PlantCareEventFilter,
    RecoveryCode,
} from './dto';
import { Activity, NotificationType, Prisma } from '../generated/prisma';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { ActivityQueryDto } from './dto/activity-query.dto';
import {
    AssignPlantToRackDto,
    HarvestPlantDto,
    HarvestLeavesDto,
    HarvestSeedsDto,
    UnassignFromRackDto,
} from './dto/rack-operations.dto';
import { CreateNotificationPayload } from '../notifications/interfaces/notification.interface';

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

    async rackExists(macAddress: string, userId: string): Promise<RackExistsResponse> {
        try {
            const rack = await this.databaseService.rack.findUnique({
                where: { macAddress, userId },
            });

            if (!rack) {
                return { exists: false };
            }

            return { exists: true, rack };
        } catch (error) {
            this.logger.error(
                `Error checking rack existence: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to check rack existence');
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
                if (!existingRack.isActive) {
                    await this.databaseService.rack.update({
                        where: { id: existingRack.id },
                        data: {
                            name: dto.name,
                            isActive: true,
                        },
                    });

                    // Resume sensor data from recovered rack
                    await this.emitSensorCommand(existingRack.macAddress, 'sensor_start');

                    return {
                        message: 'Archived rack recovered succefully.',
                        rackId: existingRack.id,
                    };
                }
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

            // Start sensor data stream from newly registered rack
            await this.emitSensorCommand(rack.macAddress, 'sensor_start');

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

            // Stop sensor data from archived rack to avoid wasting MQTT messages
            await this.emitSensorCommand(rack.macAddress, 'sensor_stop');

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

        const rack = await this.databaseService.rack.findUnique({
            where: { macAddress },
            include: {
                user: { select: { id: true, email: true } },
            },
        });

        if (!rack) {
            this.logger.warn(
                `Received status update from unregistered device: ${macAddress}`,
                'RacksService',
            );
            throw new BadRequestException(
                `Device with MAC address ${macAddress} is not registered`,
            );
        }

        const statusData = await MqttMessageParser.parseAndValidate(
            rack,
            message,
            DeviceStatusDto,
            macAddress,
            this.eventEmitter,
        );

        const newStatus: DeviceStatus = statusData.online
            ? DeviceStatus.ONLINE
            : DeviceStatus.OFFLINE;
        const oldStatus = rack.status;
        const statusChanged = oldStatus !== newStatus;

        try {
            await this.databaseService.rack.update({
                where: { id: rack.id },
                data: {
                    status: newStatus,
                    lastSeenAt: new Date(),
                    ...(statusData.online && { lastActivityAt: new Date() }),
                },
            });

            this.logger.log(
                `Rack ${rack.name} (${rack.id}) status updated: ${oldStatus} → ${newStatus}`,
                'RacksService',
            );

            this.eventEmitter.emit('broadcastDeviceStatus', rack.id, newStatus);

            this.logger.log(
                `Status update broadcasted to WebSocket clients for rack: ${rack.id}`,
                'RacksService',
            );

            if (statusChanged) {
                const isOnline = newStatus === DeviceStatus.ONLINE;

                await this.logRackActivityHelper.logActivity(
                    rack.id,
                    isOnline ? ActivityEventType.DEVICE_ONLINE : ActivityEventType.DEVICE_OFFLINE,
                    `Device status changed from ${oldStatus} to ${newStatus}`,
                    statusData as unknown as Prisma.InputJsonValue,
                );

                this.logger.log(
                    `Activity logged for rack ${rack.id}: ${oldStatus} → ${newStatus}`,
                    'RacksService',
                );

                this.eventEmitter.emit('createNotification', {
                    userId: rack.userId,
                    rackId: rack.id,
                    type: NotificationType.INFO,
                    title: isOnline ? 'Rack Connected' : 'Rack Disconnected',
                    message: isOnline
                        ? `"${rack.name}" has been connected. Last seen at ${rack.lastSeenAt?.toLocaleString()}.`
                        : `"${rack.name}" has been disconnected. Last seen at ${rack.lastSeenAt?.toLocaleString()}.`,
                    metadata: {
                        screen: `/(tabs)/(racks)/${rack.id}`,
                        ...statusData,
                    },
                } satisfies CreateNotificationPayload);
            }
        } catch (error) {
            this.logger.error(
                `Failed to process device status for: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to process device status');
        }
    }

    async processDeviceError(macAddress: string, message: string): Promise<void> {
        this.logger.warn(`Processing device error/recovery from: ${macAddress}`, 'RacksService');

        const rack = await this.databaseService.rack.findUnique({
            where: { macAddress },
            include: {
                user: { select: { id: true, email: true } },
            },
        });

        if (!rack) {
            this.logger.warn(
                `Received error from unregistered device: ${macAddress}`,
                'RacksService',
            );
            throw new BadRequestException(
                `Device with MAC address ${macAddress} is not registered`,
            );
        }

        const errorData = await MqttMessageParser.parseAndValidate(
            rack,
            message,
            DeviceErrorDto,
            macAddress,
            this.eventEmitter,
        );

        const isRecovery = Object.values(RecoveryCode).includes(errorData.code as RecoveryCode);

        try {
            if (isRecovery) {
                await this.handleDeviceRecovery(rack, errorData);
            } else {
                await this.handleDeviceError(rack, errorData);
            }
        } catch (error) {
            this.logger.error(
                `Failed to process device error/recovery for: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to process device error');
        }
    }

    private async handleDeviceError(
        rack: Rack & { user: { id: string; email: string } },
        errorData: DeviceErrorDto,
    ): Promise<void> {
        // Guard: don't process errors from an OFFLINE rack —
        // receiving MQTT proves it's reachable, so set it to ERROR directly
        if (rack.status === DeviceStatus.ERROR) {
            this.logger.warn(
                `Rack ${rack.name} (${rack.id}) already in ERROR state — suppressing duplicate error notification`,
                'RacksService',
            );
            return;
        }

        await this.databaseService.rack.update({
            where: { id: rack.id },
            data: {
                status: DeviceStatus.ERROR,
                lastSeenAt: new Date(),
            },
        });

        this.logger.warn(
            `Rack ${rack.name} (${rack.id}) marked as ERROR due to: ${errorData.code}`,
            'RacksService',
        );

        this.eventEmitter.emit('broadcastDeviceStatus', rack.id, DeviceStatus.ERROR);

        this.eventEmitter.emit('createNotification', {
            userId: rack.userId,
            rackId: rack.id,
            type: NotificationType.ERROR,
            title: 'Component Malfunction Detected',
            message: `An error with code "${errorData.code}" occurred on rack "${rack.name}".`,
            metadata: {
                screen: `/(tabs)/(racks)/${rack.id}`,
                ...errorData,
            },
        } satisfies CreateNotificationPayload);
    }

    private async handleDeviceRecovery(
        rack: Rack & { user: { id: string; email: string } },
        errorData: DeviceErrorDto,
    ): Promise<void> {
        // Guard: only recover from ERROR — ignore if already ONLINE or OFFLINE
        if (rack.status !== DeviceStatus.ERROR) {
            this.logger.log(
                `Recovery code "${errorData.code}" received for rack ${rack.name} (${rack.id}) but status is ${rack.status} — no action needed`,
                'RacksService',
            );
            return;
        }

        await this.databaseService.rack.update({
            where: { id: rack.id },
            data: {
                status: DeviceStatus.ONLINE,
                lastSeenAt: new Date(),
            },
        });

        this.logger.log(
            `Rack ${rack.name} (${rack.id}) recovered from ERROR → ONLINE via code: ${errorData.code}`,
            'RacksService',
        );

        this.eventEmitter.emit('broadcastDeviceStatus', rack.id, DeviceStatus.ONLINE);

        this.eventEmitter.emit('createNotification', {
            userId: rack.userId,
            rackId: rack.id,
            type: NotificationType.INFO,
            title: 'Component Recovered',
            message: `Rack "${rack.name}" has recovered and is back online.`,
            metadata: {
                screen: `/(tabs)/(racks)/${rack.id}`,
                ...errorData,
            },
        } satisfies CreateNotificationPayload);
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
     * Event types: WATERING_START, WATERING_STOP, LIGHT_ON, LIGHT_OFF.
     * Includes associated rack and current plant info.
     * Returns paginated results + `amount` count within the date range.
     */
    async getPlantCareActivities(
        userId: string,
        query: PlantCareActivityQueryDto,
    ): Promise<PaginatedResponse<Activity>> {
        try {
            const queryRackIds = await this.resolveAuthorizedRackIds(userId, query.rackId);

            const eventTypeMap = {
                [PlantCareEventFilter.WATERING]: [
                    ActivityEventType.WATERING_START,
                    ActivityEventType.WATERING_STOP,
                ],
                [PlantCareEventFilter.LIGHT]: [
                    ActivityEventType.LIGHT_ON,
                    ActivityEventType.LIGHT_OFF,
                ],
            };

            const eventTypes = query.event
                ? eventTypeMap[query.event]
                : [
                      ActivityEventType.WATERING_START,
                      ActivityEventType.WATERING_STOP,
                      ActivityEventType.LIGHT_ON,
                      ActivityEventType.LIGHT_OFF,
                  ];

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
                eventType: { in: eventTypes },
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
                'RacksService',
            );

            return PaginationHelper.createResponse(activities, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching plant care activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
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

            const activityWhere = {
                rackId: { in: queryRackIds },
                eventType: {
                    in: [
                        ActivityEventType.LEAVES_HARVESTED,
                        ActivityEventType.PLANT_HARVESTED,
                        ActivityEventType.SEEDS_HARVESTED,
                    ],
                },
                ...dateFilter,
            };

            const rackWhere = {
                id: { in: queryRackIds },
            };

            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [activities, totalItems, aggregation] = await Promise.all([
                this.databaseService.activity.findMany({
                    where: activityWhere,
                    orderBy: { timestamp: 'desc' },
                    skip,
                    take,
                }),
                this.databaseService.activity.count({ where: activityWhere }),
                this.databaseService.rack.aggregate({
                    where: rackWhere,
                    _sum: { harvestCount: true },
                }),
            ]);

            const totalHarvestCount = aggregation._sum.harvestCount ?? 0;

            this.logger.log(
                `Retrieved ${activities.length} harvest activities for user ${userId} (total count: ${totalHarvestCount})`,
                'RacksService',
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
                'RacksService',
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
                    in: [ActivityEventType.PLANT_ADDED, ActivityEventType.PLANT_REMOVED],
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
                'RacksService',
            );

            return PaginationHelper.createResponse(activities, totalItems, query);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Error fetching planting activities for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch planting activities');
        }
    }

    async getRackCount(userId: string): Promise<{ count: number }> {
        try {
            const count = await this.databaseService.rack.count({
                where: { userId, isActive: true },
            });

            this.logger.log(`Rack count retrieved for user ${userId}: ${count}`, 'RacksService');

            return { count };
        } catch (error) {
            this.logger.error(
                `Error fetching rack count for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch rack count');
        }
    }

    async getPlantedQuantity(userId: string): Promise<{ totalQuantity: number }> {
        try {
            const racks = await this.databaseService.rack.findMany({
                where: { userId, isActive: true, currentPlantId: { not: null } },
                select: { quantity: true },
            });

            const totalQuantity = racks.reduce((sum, rack) => sum + rack.quantity, 0);

            this.logger.log(
                `Total planted quantity retrieved for user ${userId}: ${totalQuantity}`,
                'RacksService',
            );

            return { totalQuantity };
        } catch (error) {
            this.logger.error(
                `Error fetching planted quantity for user ${userId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to fetch planted quantity');
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

            this.logger.log(`Harvesting plant ${plantId} from rack ${rackId}`, 'RacksService');

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
                'RacksService',
            );

            return { message: 'Plant harvested successfully' };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error harvesting plant ${dto.plantId} from rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
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
     * Pre-assignment check — validates all conditions and returns a temperature
     * warning if the current rack environment exceeds the plant's max temperature.
     * Does NOT write anything to the database.
     * Frontend should call this first and prompt the user to confirm before calling assignToRack.
     */
    async checkAssignToRack(
        rackId: string,
        userId: string,
        dto: AssignPlantToRackDto,
    ): Promise<AssignPlantToRackCheckResponse> {
        try {
            const plantId = dto.plantId;

            const [plant, rack] = await Promise.all([
                this.databaseService.plant.findUnique({ where: { id: plantId } }),
                this.databaseService.rack.findFirst({ where: { id: rackId, userId } }),
            ]);

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            if (!plant.isActive) {
                throw new BadRequestException('Cannot assign an inactive plant to a rack');
            }

            if (!rack) {
                throw new NotFoundException(`Rack ${rackId} not found or access denied`);
            }

            if (rack.currentPlantId !== null) {
                throw new BadRequestException(
                    'This rack already has a plant assigned. Please remove the current plant before assigning a new one.',
                );
            }

            const latestReading = await this.databaseService.sensorReading.findFirst({
                where: { rackId },
                orderBy: { timestamp: 'desc' },
                select: { temperature: true },
            });

            const hasWarning =
                latestReading !== null &&
                plant.maxTemperature !== null &&
                latestReading.temperature > plant.maxTemperature;

            return {
                hasWarning,
                latestTemperatureReading: latestReading?.temperature ?? null,
                maxTemperatureThreshold: plant.maxTemperature,
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException)
                throw error;

            this.logger.error(
                `Error checking plant assignment for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to check plant assignment');
        }
    }

    /**
     * Actual assignment — called after user confirms on the frontend.
     * Skips the temperature check since the user already acknowledged it.
     */
    async assignToRack(
        rackId: string,
        userId: string,
        dto: AssignPlantToRackDto,
    ): Promise<AssignPlantToRackResponse> {
        try {
            const plantId = dto.plantId;

            this.logger.log(`Assigning plant ${plantId} to rack ${rackId}`, 'RacksService');

            const [plant, rack] = await Promise.all([
                this.databaseService.plant.findUnique({ where: { id: plantId } }),
                this.databaseService.rack.findFirst({ where: { id: rackId, userId } }),
            ]);

            if (!plant) {
                throw new NotFoundException(`Plant with ID ${plantId} not found`);
            }

            if (!plant.isActive) {
                throw new BadRequestException('Cannot assign an inactive plant to a rack');
            }

            if (!rack) {
                throw new NotFoundException(`Rack ${rackId} not found or access denied`);
            }

            if (rack.currentPlantId !== null) {
                throw new BadRequestException(
                    'This rack already has a plant assigned. Please remove the current plant before assigning a new one.',
                );
            }

            const plantedAt = dto.plantedAt ? new Date(dto.plantedAt) : new Date();
            const now = new Date();

            await this.databaseService.$transaction(async (tx) => {
                await tx.rack.update({
                    where: { id: rackId },
                    data: {
                        currentPlantId: plantId,
                        quantity: dto.quantity,
                        plantedAt,
                        lastActivityAt: now,
                    },
                });

                await tx.rackPlantingHistory.create({
                    data: {
                        rackId,
                        plantId,
                        quantity: dto.quantity,
                        plantedAt,
                        harvestedAt: null,
                        harvestCount: 0,
                    },
                });
            });

            await this.logRackActivityHelper.logActivity(
                rackId,
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

    /**
     * Emit a sensor start/stop command via MQTT for the given rack's MAC address.
     * Non-critical — logs errors but never throws, so it won't fail the parent operation.
     */
    private async emitSensorCommand(
        macAddress: string,
        action: 'sensor_start' | 'sensor_stop',
    ): Promise<void> {
        try {
            await this.eventEmitter.emitAsync('publishCommand', macAddress, 'sensors', { action });
            this.logger.log(
                `Sensor command "${action}" emitted for device ${macAddress}`,
                'RacksService',
            );
        } catch (error) {
            this.logger.error(
                `Failed to emit sensor command "${action}" for device ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
        }
    }
}
