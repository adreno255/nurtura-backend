import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';

@Injectable()
export class SensorsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    // Get latest sensor reading for a rack
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

            return reading;
        } catch (error) {
            this.logger.error(
                `Error fetching latest reading for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );
            throw error;
        }
    }

    // Get sensor reading history
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

    // Get aggregated hourly data
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
                `Error fetching aggregated data for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'SensorsService',
            );
            throw error;
        }
    }

    // Get statistics for a rack
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

    // Verify user owns the rack
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
                'SensorsService',
            );
            throw error;
        }
    }

    // Helper: Calculate statistics
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
}
