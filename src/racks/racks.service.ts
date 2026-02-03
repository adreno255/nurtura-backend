import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { DeviceStatus } from '../generated/prisma/client';
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

@Injectable()
export class RacksService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    // CRUD Operations

    async create(userId: string, dto: CreateRackDto): Promise<RackCreatedResponse> {
        try {
            // Check if MAC address already exists
            const existingRack = await this.databaseService.rack.findUnique({
                where: { macAddress: dto.macAddress },
            });

            if (existingRack) {
                throw new ConflictException('MAC address already registered');
            }

            // Generate MQTT topic if not provided
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

    async findAll(userId: string, query: PaginationQueryDto): Promise<PaginatedResponse<Rack>> {
        try {
            const { skip, take } = PaginationHelper.getPrismaOptions(query);

            const [racks, totalItems] = await Promise.all([
                this.databaseService.rack.findMany({
                    where: { userId },
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                }),
                this.databaseService.rack.count({
                    where: { userId },
                }),
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

    async findById(rackId: string, userId: string): Promise<RackDetailsResponse> {
        try {
            const rack = await this.databaseService.rack.findFirst({
                where: {
                    id: rackId,
                    userId,
                },
            });

            if (!rack) {
                throw new NotFoundException('Rack not found or access denied');
            }

            this.logger.log(`Rack details fetched: ${rackId}`, 'RacksService');

            return {
                message: 'Rack details retrieved successfully',
                rack,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

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

    async update(rackId: string, userId: string, dto: UpdateRackDto): Promise<RackUpdatedResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            await this.databaseService.rack.update({
                where: { id: rackId },
                data: {
                    name: dto.name,
                    mqttTopic: dto.mqttTopic,
                    description: dto.description,
                },
            });

            this.logger.log(`Rack updated successfully: ${rackId}`, 'RacksService');

            return {
                message: 'Rack updated successfully',
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

    async delete(rackId: string, userId: string): Promise<RackDeletedResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            // Soft delete - set isActive to false
            await this.databaseService.rack.update({
                where: { id: rackId },
                data: { isActive: false },
            });

            this.logger.log(`Rack soft deleted: ${rackId}`, 'RacksService');

            return {
                message: 'Rack deleted successfully',
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

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
                throw new NotFoundException('Rack not found or access denied');
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

    // Current State Operations

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
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            const rack = await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    lastSeenAt: true,
                },
            });

            if (!rack) {
                throw new NotFoundException('Rack not found');
            }

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
                          timestamp: latestReading.timestamp,
                      }
                    : null,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

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

            const rack = await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: {
                    status: true,
                    lastSeenAt: true,
                },
            });

            if (!rack) {
                throw new NotFoundException('Rack not found');
            }

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

    // Control Commands (via MQTT) - Placeholder implementations
    /*
    async triggerWatering(
        rackId: string,
        userId: string,
        duration?: number,
    ): Promise<CommandResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            // Validate duration
            const wateringDuration = duration || 5000;
            if (wateringDuration < 1000 || wateringDuration > 60000) {
                throw new BadRequestException(
                    'Watering duration must be between 1000ms and 60000ms',
                );
            }

            // TODO: Publish MQTT command
            await this.publishCommand(rackId, 'water', { duration: wateringDuration });

            // Log activity
            await this.logActivity(
                rackId,
                ActivityEventType.WATERING_ON,
                `Manual watering triggered (${wateringDuration}ms)`,
                { duration: wateringDuration },
            );

            this.logger.log(
                `Watering command sent to rack ${rackId} (duration: ${wateringDuration}ms)`,
                'RacksService',
            );

            return {
                message: 'Watering command sent successfully',
                commandType: 'water',
                timestamp: new Date(),
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Error triggering watering for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to send watering command');
        }
    }

    async controlGrowLight(
        rackId: string,
        userId: string,
        action: 'on' | 'off',
    ): Promise<CommandResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            // TODO: Publish MQTT command
            await this.publishCommand(rackId, 'light', { action });

            // Log activity
            const eventType =
                action === 'on' ? ActivityEventType.LIGHT_ON : ActivityEventType.LIGHT_OFF;
            await this.logActivity(rackId, eventType, `Grow light ${action} (manual)`, { action });

            this.logger.log(`Grow light ${action} command sent to rack ${rackId}`, 'RacksService');

            return {
                message: `Grow light ${action} command sent successfully`,
                commandType: 'light',
                timestamp: new Date(),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error controlling grow light for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to send grow light command');
        }
    }

    async controlSensors(
        rackId: string,
        userId: string,
        action: 'on' | 'off',
    ): Promise<CommandResponse> {
        try {
            // Verify ownership
            await this.verifyRackOwnership(rackId, userId);

            // TODO: Publish MQTT command
            await this.publishCommand(rackId, 'sensors', { action });

            // Log activity
            const eventType =
                action === 'on' ? ActivityEventType.SENSORS_ON : ActivityEventType.SENSORS_OFF;
            await this.logActivity(rackId, eventType, `Sensors ${action} (manual)`, { action });

            this.logger.log(`Sensors ${action} command sent to rack ${rackId}`, 'RacksService');

            return {
                message: `Sensors ${action} command sent successfully`,
                commandType: 'sensors',
                timestamp: new Date(),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error controlling sensors for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            throw new InternalServerErrorException('Failed to send sensors command');
        }
    }

    async publishCommand(rackId: string, commandType: string, payload: any): Promise<void> {
        // TODO: Implement MQTT publish logic
        // This will be implemented when MQTT module is ready
        this.logger.log(
            `[MQTT Placeholder] Command: ${commandType}, Rack: ${rackId}, Payload: ${JSON.stringify(payload)}`,
            'RacksService',
        );
    }

    // Activity Logging

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

    async logActivity(
        rackId: string,
        eventType: ActivityEventType,
        details: string,
        metadata?: object,
    ) {
        try {
            const activity = await this.databaseService.activity.create({
                data: {
                    rackId,
                    eventType,
                    details,
                    metadata,
                },
            });

            this.logger.log(
                `Activity logged for rack ${rackId}: ${eventType} - ${details}`,
                'RacksService',
            );

            return activity;
        } catch (error) {
            this.logger.error(
                `Error logging activity for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'RacksService',
            );
            // Don't throw - logging failures shouldn't break the main operation
        }
    }
    */
}
