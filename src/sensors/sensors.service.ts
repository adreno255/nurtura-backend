import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { DeviceStatus, Prisma } from '../generated/prisma';
import { SensorDataDto } from './dto/sensor-data.dto';
import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationService } from '../automation/automation.service';

@Injectable()
export class SensorsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly automationService: AutomationService,
        private readonly eventEmitter: EventEmitter2,
        private readonly logger: MyLoggerService,
    ) {}

    /**
     * Get latest sensor reading for a rack
     *
     * @param rackId - Rack ID
     * @returns Latest sensor reading or null
     */
    async getLatestReading(rackId: string) {
        try {
            const reading = await this.databaseService.sensorReading.findFirst({
                where: { rackId },
                orderBy: { timestamp: 'desc' },
            });

            if (!reading) {
                this.logger.warn(`No sensor readings found for rack: ${rackId}`, 'SensorsService');
                return null;
            }

            this.logger.log(
                `Latest sensor reading retrieved for rack: ${rackId}`,
                'SensorsService',
            );

            return reading;
        } catch (error) {
            this.logger.error(
                `Failed to get latest reading for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );

            throw new InternalServerErrorException('Failed to retrieve latest sensor reading');
        }
    }

    /**
     * Get sensor readings for a rack within a time range
     *
     * @param rackId - Rack ID
     * @param startDate - Start date for the query
     * @param endDate - End date for the query
     * @param limit - Maximum number of readings to return
     * @returns Array of sensor readings
     */
    async getReadings(rackId: string, startDate?: Date, endDate?: Date, limit = 100) {
        try {
            const where: Prisma.SensorReadingWhereInput = {
                rackId,
                ...(startDate || endDate
                    ? {
                          timestamp: {
                              ...(startDate ? { gte: startDate } : {}),
                              ...(endDate ? { lte: endDate } : {}),
                          },
                      }
                    : {}),
            };

            const readings = await this.databaseService.sensorReading.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take: limit,
                select: {
                    id: true,
                    temperature: true,
                    humidity: true,
                    moisture: true,
                    lightLevel: true,
                    timestamp: true,
                },
            });

            this.logger.log(
                `Retrieved ${readings.length} sensor readings for rack: ${rackId}`,
                'SensorsService',
            );

            return readings;
        } catch (error) {
            this.logger.error(
                `Failed to get readings for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );

            throw new InternalServerErrorException('Failed to retrieve sensor readings');
        }
    }

    /**
     * Get aggregated sensor data for a rack
     *
     * @param rackId - Rack ID
     * @param hours - Number of hours to aggregate (default: 24)
     * @returns Aggregated sensor data
     */
    async getAggregatedData(rackId: string, hours: number = 24) {
        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000);

            const aggregatedData = await this.databaseService.aggregatedSensorReading.findMany({
                where: {
                    rackId,
                    hour: {
                        gte: since,
                    },
                },
                orderBy: { hour: 'asc' },
            });

            this.logger.log(
                `Retrieved ${aggregatedData.length} aggregated readings for rack ${rackId}`,
                'SensorsService',
            );

            return aggregatedData;
        } catch (error) {
            this.logger.error(
                `Error fetching aggregated sensor data for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );
            throw error;
        }
    }

    /**
     * Get sensor history for a rack
     *
     * @param rackId - Rack ID
     * @param hours - Number of hours to aggregate (default: 24)
     * @returns Sensor data history
     */
    async getHistory(rackId: string, hours: number = 24) {
        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000);

            const readings = await this.databaseService.sensorReading.findMany({
                where: {
                    rackId,
                    timestamp: {
                        gte: since,
                    },
                },
                orderBy: { timestamp: 'asc' },
            });

            this.logger.log(
                `Retrieved ${readings.length} sensor readings for rack ${rackId} (last ${hours}h)`,
                'SensorsService',
            );

            return readings;
        } catch (error) {
            this.logger.error(
                `Error fetching history for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );
            throw error;
        }
    }

    /**
     * Helper function to get statistics for a rack
     *
     * @param rackId - Rack ID
     * @param hours - Number of hours to aggregate (default: 24)
     * @returns Sensor data statistics
     */
    async getStatistics(rackId: string, hours: number = 24) {
        try {
            const readings = await this.getHistory(rackId, hours);

            if (readings.length === 0) {
                return null;
            }

            const stats = {
                temperature: this.calculateStats(readings.map((r) => r.temperature)),
                humidity: this.calculateStats(readings.map((r) => r.humidity)),
                moisture: this.calculateStats(readings.map((r) => r.moisture)),
                lightLevel: this.calculateStats(readings.map((r) => r.lightLevel)),
                totalReadings: readings.length,
                periodHours: hours,
            };

            return stats;
        } catch (error) {
            this.logger.error(
                `Error calculating statistics for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );
            throw error;
        }
    }

    /**
     * Helper function to calculate statistics for a rack
     *
     * @param values - Array of sensor values
     * @returns Statistics object
     */
    private calculateStats(values: number[]) {
        if (values.length === 0) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);

        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / values.length,
            median: sorted[Math.floor(sorted.length / 2)],
            count: values.length,
        };
    }

    /**
     * Processes sensor data received from ESP32 devices via MQTT
     * Called by MqttService when a message arrives on nurtura/rack/{macAddress}/sensors
     *
     * @param macAddress - Device MAC address (e.g., AA:BB:CC:DD:EE:FF)
     * @param message - Raw JSON message from MQTT
     */
    async processSensorData(macAddress: string, message: string): Promise<void> {
        this.logger.log(`Processing sensor data from device: ${macAddress}`, 'SensorsService');

        // Step 1: Parse and validate the JSON message
        const sensorData = await MqttMessageParser.parseAndValidate(
            message,
            SensorDataDto,
            macAddress,
        );

        // Step 2: Find the rack by MAC address
        const rack = await this.databaseService.rack.findUnique({
            where: { macAddress },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });

        if (!rack) {
            this.logger.warn(
                `Received sensor data from unregistered device: ${macAddress}`,
                'SensorsService',
            );
            throw new BadRequestException(
                `Device with MAC address ${macAddress} is not registered`,
            );
        }

        // Step 3: Save sensor reading to database
        try {
            const sensorReading = await this.databaseService.sensorReading.create({
                data: {
                    rackId: rack.id,
                    temperature: sensorData.temperature,
                    humidity: sensorData.humidity,
                    moisture: sensorData.moisture,
                    lightLevel: sensorData.lightLevel,
                    timestamp: sensorData.timestamp ? new Date(sensorData.timestamp) : new Date(),
                    rawData: sensorData as unknown as Prisma.InputJsonValue,
                },
            });

            this.logger.log(
                `Sensor reading saved for rack ${rack.name} (${rack.id}): ` +
                    `T=${sensorData.temperature}°C, H=${sensorData.humidity}%, ` +
                    `M=${sensorData.moisture}%, L=${sensorData.lightLevel}`,
                'SensorsService',
            );

            // Step 4: Update rack's last activity timestamp
            await this.databaseService.rack.update({
                where: { id: rack.id },
                data: {
                    lastActivityAt: new Date(),
                    lastSeenAt: new Date(),
                    status: DeviceStatus.ONLINE,
                },
            });

            // Step 5: Broadcast sensor data to connected clients via WebSocket
            this.eventEmitter.emit('broadcastSensorData', rack.id, sensorReading);

            this.logger.log(`Processing complete for rack: ${rack.id}`, 'SensorsService');

            // Step 6: Pass to AutomationService for rule evaluation
            await this.automationService.evaluateRules(rack.id, sensorData);
        } catch (error) {
            this.logger.error(
                `Failed to process sensor data for device: ${macAddress}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );

            throw new InternalServerErrorException('Failed to process sensor data');
        }
    }
}
