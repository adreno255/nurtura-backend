import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { NotificationType, Rack } from '../generated/prisma/client';
import { CreateNotificationPayload } from '../notifications/interfaces/notification.interface';
import { SensorData } from '../automation/interfaces/automation.interface';
import { AutomationService } from '../automation/automation.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SystemRulesService {
    private static readonly HIGH_TEMP_THRESHOLD = 37;
    private static readonly LIGHT_ON_HOUR = 8; // 08:00
    private static readonly LIGHT_OFF_HOUR = 0; // 00:00 (midnight)

    constructor(
        private readonly eventEmitter: EventEmitter2,
        private readonly automationService: AutomationService,
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    async evaluate(rack: Rack & { userId: string }, sensorData: SensorData): Promise<void> {
        await this.evaluateLightPriority(rack, sensorData);
        this.evaluateHighTemperature(rack, sensorData);
    }

    /**
     * Light control evaluated in strict priority order.
     * Each priority returns early so lower priorities are skipped once a rule fires.
     *
     * Priority 1: moisture < 20 → light_off (system, all plants)
     * Priority 2: lightLevel > plant max threshold → light_off (system, plant-specific threshold)
     * Priority 3: time-based schedule → light_on / light_off (baseline)
     */
    private async evaluateLightPriority(
        rack: Rack & { userId: string },
        sensorData: SensorData,
    ): Promise<void> {
        // Priority 1: critical moisture override
        if (sensorData.moisture < 20) {
            this.logger.log(
                `[P1] Critical moisture (${sensorData.moisture}%) on rack ${rack.id} — forcing light_off`,
                'SystemRulesService',
            );
            await this.automationService.applySystemLightAction(
                rack,
                'light_off',
                'system:moisture_override',
            );
            return;
        }

        // Priority 2: excess light override (plant-specific max threshold)
        if (rack.currentPlantId) {
            const plant = await this.databaseService.plant.findUnique({
                where: { id: rack.currentPlantId },
                select: { maxLightLevel: true },
            });

            if (
                plant &&
                plant.maxLightLevel !== null &&
                sensorData.lightLevel > plant.maxLightLevel
            ) {
                this.logger.log(
                    `[P2] Light level (${sensorData.lightLevel} lux) exceeds plant max (${plant.maxLightLevel} lux) on rack ${rack.id} — forcing light_off`,
                    'SystemRulesService',
                );
                await this.automationService.applySystemLightAction(
                    rack,
                    'light_off',
                    'system:excess_light',
                );
                return;
            }
        }

        // Priority 3: schedule-based (baseline)
        const hour = new Date().getHours();
        const isLightOnWindow = hour >= SystemRulesService.LIGHT_ON_HOUR;
        const action = isLightOnWindow ? 'light_on' : 'light_off';

        this.logger.log(
            `[P3] Schedule-based light action for rack ${rack.id}: ${action} (hour: ${hour})`,
            'SystemRulesService',
        );
        await this.automationService.applySystemLightAction(rack, action, 'system:schedule');
    }

    private evaluateHighTemperature(rack: Rack & { userId: string }, sensorData: SensorData): void {
        if (sensorData.temperature <= SystemRulesService.HIGH_TEMP_THRESHOLD) return;

        this.logger.warn(
            `High temperature (${sensorData.temperature}°C) detected on rack ${rack.id}`,
            'SystemRulesService',
        );

        this.eventEmitter.emit('createNotification', {
            userId: rack.userId,
            rackId: rack.id,
            type: NotificationType.ERROR,
            title: 'High Temperature Detected',
            message: `The temperature reading from your ${rack.name} rack has exceeded the safe threshold. Please check your plants and adjust the environment accordingly.`,
            metadata: {
                screen: `/(tabs)/(racks)/${rack.id}`,
                temperature: sensorData.temperature,
            },
        } satisfies CreateNotificationPayload);
    }
}
