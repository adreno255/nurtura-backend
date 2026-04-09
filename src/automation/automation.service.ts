import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorData, RuleConditions, RuleActions } from './interfaces/automation.interface';
import { type Prisma, ActivityEventType, NotificationType, Rack } from '../generated/prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { PaginationHelper } from '../common/utils/pagination.helper';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
    AutomatedEventDto,
    CreateAutomationRuleDto,
    GrowLightActionDto,
    UpdateAutomationRuleDto,
    WateringActionDto,
} from './dto';
import { CreateNotificationPayload } from '../notifications/interfaces/notification.interface';

@Injectable()
export class AutomationService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly eventEmitter: EventEmitter2,
        private readonly logRackActivityHelper: LogRackActivityHelper,
        private readonly logger: MyLoggerService,
    ) {}

    /**
     * Evaluates automation rules for a rack based on sensor data.
     * Called by SensorsService after saving sensor data.
     *
     * Rules are plant-scoped: we resolve the rack's current plant,
     * then fetch all enabled rules associated with that plant.
     *
     * Trigger behavior:
     * - MQTT command is always sent when conditions are met.
     * - triggerCount, activity log, and notification only fire on the FIRST
     *   trigger (i.e. when the last recorded action differs — start → new start
     *   is skipped, stop → start is not).
     * - A stop command always logs and notifies (since the last action was a start).
     *
     * @param rackId - Rack ID
     * @param sensorData - Latest sensor reading
     */
    async evaluateRules(rackId: string, sensorData: SensorData): Promise<void> {
        this.logger.log(`Evaluating automation rules for rack: ${rackId}`, 'AutomationService');

        try {
            const rack = await this.databaseService.rack.findUnique({
                where: { id: rackId },
                select: {
                    userId: true,
                    macAddress: true,
                    name: true,
                    currentPlantId: true,
                },
            });

            if (!rack) {
                this.logger.warn(
                    `Rack not found during rule evaluation: ${rackId}`,
                    'AutomationService',
                );
                return;
            }

            if (!rack.currentPlantId) {
                this.logger.log(
                    `Rack ${rackId} has no current plant — skipping rule evaluation`,
                    'AutomationService',
                );
                return;
            }

            const rules = await this.databaseService.automationRule.findMany({
                where: {
                    plantId: rack.currentPlantId,
                    isEnabled: true,
                },
            });

            if (rules.length === 0) {
                this.logger.warn(
                    `No automation rules found for plant: ${rack.currentPlantId} (rack: ${rackId})`,
                    'AutomationService',
                );
                return;
            }

            this.logger.log(
                `Found ${rules.length} enabled automation rules for plant: ${rack.currentPlantId} (rack: ${rackId})`,
                'AutomationService',
            );

            for (const rule of rules) {
                const conditions = rule.conditions as RuleConditions;
                const shouldTrigger = this.evaluateConditions(conditions, sensorData);

                if (shouldTrigger) {
                    this.logger.log(
                        `Rule "${rule.name}" triggered for rack: ${rackId}`,
                        'AutomationService',
                    );

                    const actions = rule.actions as RuleActions;

                    // executeActions returns true only when at least one action
                    // was non-duplicate (i.e. first start or a stop after a start)
                    const isFirstTrigger = await this.executeActions(
                        rack.macAddress,
                        actions,
                        rackId,
                        rack,
                        rule.id,
                        rule.name,
                    );

                    // Only count and timestamp on a genuinely new trigger
                    if (isFirstTrigger) {
                        await this.databaseService.automationRule.update({
                            where: { id: rule.id },
                            data: {
                                lastTriggeredAt: new Date(),
                                triggerCount: rule.triggerCount + 1,
                            },
                        });
                    }

                    this.logger.log(
                        `Automation rule "${rule.name}" executed successfully`,
                        'AutomationService',
                    );
                }
            }
        } catch (error) {
            this.logger.error(
                `Failed to evaluate rules for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );
        }
    }

    /**
     * Evaluates whether rule conditions are met based light_on sensor data.
     * All conditions use AND logic — every specified condition must be satisfied.
     */
    private evaluateConditions(conditions: RuleConditions, sensorData: SensorData): boolean {
        if (conditions.moisture) {
            if (
                conditions.moisture.lessThan !== undefined &&
                sensorData.moisture >= conditions.moisture.lessThan
            ) {
                return false;
            }
            if (
                conditions.moisture.greaterThan !== undefined &&
                sensorData.moisture <= conditions.moisture.greaterThan
            ) {
                return false;
            }
        }

        if (conditions.temperature) {
            if (
                conditions.temperature.lessThan !== undefined &&
                sensorData.temperature >= conditions.temperature.lessThan
            ) {
                return false;
            }
            if (
                conditions.temperature.greaterThan !== undefined &&
                sensorData.temperature <= conditions.temperature.greaterThan
            ) {
                return false;
            }
        }

        if (conditions.humidity) {
            if (
                conditions.humidity.lessThan !== undefined &&
                sensorData.humidity >= conditions.humidity.lessThan
            ) {
                return false;
            }
            if (
                conditions.humidity.greaterThan !== undefined &&
                sensorData.humidity <= conditions.humidity.greaterThan
            ) {
                return false;
            }
        }

        if (conditions.lightLevel) {
            if (
                conditions.lightLevel.lessThan !== undefined &&
                sensorData.lightLevel >= conditions.lightLevel.lessThan
            ) {
                return false;
            }
            if (
                conditions.lightLevel.greaterThan !== undefined &&
                sensorData.lightLevel <= conditions.lightLevel.greaterThan
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Executes automation actions by publishing MQTT commands via EventEmitter.
     *
     * Always sends the MQTT command regardless of duplicate state.
     * Only logs activity and emits a notification on the first occurrence
     * (i.e. when the last recorded event differs from the current action).
     *
     * @returns true if at least one action was non-duplicate (triggers triggerCount update)
     */
    private async executeActions(
        macAddress: string,
        actions: RuleActions,
        rackId: string,
        rack: Partial<Rack>,
        ruleId: string,
        ruleName: string,
    ): Promise<boolean> {
        const executedActions: string[] = [];
        let hasNewAction = false;

        try {
            if (actions.watering) {
                const wateringCommand: WateringActionDto = {
                    action: actions.watering.action,
                };

                const targetEventType =
                    actions.watering.action === 'watering_start'
                        ? ActivityEventType.WATERING_START
                        : ActivityEventType.WATERING_STOP;

                const lastWateringActivity = await this.databaseService.activity.findFirst({
                    where: {
                        rackId,
                        eventType: {
                            in: [ActivityEventType.WATERING_START, ActivityEventType.WATERING_STOP],
                        },
                    },
                    orderBy: { timestamp: 'desc' },
                });

                const isWateringDuplicate = lastWateringActivity?.eventType === targetEventType;

                // Guard: don't send a stop if there's no prior start to stop
                const isOrphanedStop =
                    actions.watering.action !== 'watering_start' &&
                    lastWateringActivity?.eventType !== ActivityEventType.WATERING_START;

                if (isOrphanedStop) {
                    this.logger.log(
                        `Skipping watering stop — no prior watering_start recorded for rack ${rackId}`,
                        'AutomationService',
                    );
                } else {
                    // Always send the MQTT command
                    this.eventEmitter.emit(
                        'publishCommand',
                        macAddress,
                        'watering',
                        wateringCommand,
                    );
                    executedActions.push(`watering:${actions.watering.action}`);

                    if (!isWateringDuplicate) {
                        hasNewAction = true;

                        await this.logRackActivityHelper.logActivity(
                            rackId,
                            targetEventType,
                            `Watering ${actions.watering.action} triggered by automation rule "${ruleName}"`,
                            {
                                rackName: rack.name,
                                macAddress: rack.macAddress,
                                source: 'automation',
                                ruleId,
                                ruleName,
                            } as Prisma.InputJsonValue,
                        );

                        this.eventEmitter.emit('createNotification', {
                            userId: rack.userId!,
                            rackId,
                            type: NotificationType.AUTOMATION,
                            title: `Watering ${actions.watering.action === 'watering_start' ? 'Started' : 'Stopped'}`,
                            message: `Rule "${ruleName}" ${actions.watering.action === 'watering_start' ? 'activated the water pump' : 'stopped the water pump'}.`,
                            metadata: {
                                screen: '/(tabs)/(activity)/plant-care',
                                ruleId,
                                ruleName,
                                action: actions.watering.action,
                            },
                        } satisfies CreateNotificationPayload);
                    } else {
                        this.logger.log(
                            `Skipping duplicate watering activity/notification for action "${actions.watering.action}" on rack ${rackId} — MQTT command still sent`,
                            'AutomationService',
                        );
                    }
                }
            }

            if (actions.growLight) {
                const lightingCommand: GrowLightActionDto = {
                    action: actions.growLight.action,
                };

                const targetEventType =
                    actions.growLight.action === 'light_on'
                        ? ActivityEventType.LIGHT_ON
                        : ActivityEventType.LIGHT_OFF;

                const lastLightActivity = await this.databaseService.activity.findFirst({
                    where: {
                        rackId,
                        eventType: {
                            in: [ActivityEventType.LIGHT_ON, ActivityEventType.LIGHT_OFF],
                        },
                    },
                    orderBy: { timestamp: 'desc' },
                });

                const isLightDuplicate = lastLightActivity?.eventType === targetEventType;

                // Guard: don't send a stop if there's no prior start to stop
                const isOrphanedStop =
                    actions.growLight.action !== 'light_on' &&
                    lastLightActivity?.eventType !== ActivityEventType.LIGHT_ON;

                if (isOrphanedStop) {
                    this.logger.log(
                        `Skipping grow light off — no prior light_on recorded for rack ${rackId}`,
                        'AutomationService',
                    );
                } else {
                    // Always send the MQTT command
                    this.eventEmitter.emit(
                        'publishCommand',
                        macAddress,
                        'lighting',
                        lightingCommand,
                    );
                    executedActions.push(`growLight:${actions.growLight.action}`);

                    if (!isLightDuplicate) {
                        hasNewAction = true;

                        await this.logRackActivityHelper.logActivity(
                            rackId,
                            targetEventType,
                            `Grow light ${actions.growLight.action} triggered by automation rule "${ruleName}"`,
                            {
                                rackName: rack.name,
                                macAddress: rack.macAddress,
                                source: 'automation',
                                ruleId,
                                ruleName,
                            } as Prisma.InputJsonValue,
                        );

                        this.eventEmitter.emit('createNotification', {
                            userId: rack.userId!,
                            rackId,
                            type: NotificationType.AUTOMATION,
                            title: `Grow Light ${actions.growLight.action === 'light_on' ? 'Turned On' : 'Turned Off'}`,
                            message: `Rule "${ruleName}" turned the grow light ${actions.growLight.action === 'light_on' ? 'on' : 'off'}.`,
                            metadata: {
                                screen: '/(tabs)/(activity)/plant-care',
                                ruleId,
                                ruleName,
                                action: actions.growLight.action,
                            },
                        } satisfies CreateNotificationPayload);
                    } else {
                        this.logger.log(
                            `Skipping duplicate grow light activity/notification for action "${actions.growLight.action}" on rack ${rackId} — MQTT command still sent`,
                            'AutomationService',
                        );
                    }
                }
            }

            const automatedEvents: AutomatedEventDto = {
                rackId,
                ruleName,
                executedActions,
                timestamp: new Date(),
            };

            this.eventEmitter.emit('broadcastAutomationEvent', rackId, automatedEvents);

            this.logger.log(
                `Executed actions for rule "${ruleName}": ${executedActions.join(', ')}`,
                'AutomationService',
            );

            return hasNewAction;
        } catch (error) {
            this.logger.error(
                `Failed to execute actions for rule "${ruleName}"`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );
            throw error;
        }
    }

    /**
     * Creates a new automation rule for a plant.
     * Ownership is verified by checking the plant exists and the user owns
     * at least one active rack currently growing that plant.
     */
    async create(userId: string, createRuleDto: CreateAutomationRuleDto) {
        try {
            // Verify the plant exists and the user owns a rack with this plant
            const plant = await this.databaseService.plant.findFirst({
                where: {
                    id: createRuleDto.plantId,
                    isActive: true,
                    racks: {
                        some: {
                            userId,
                            isActive: true,
                        },
                    },
                },
            });

            if (!plant) {
                throw new NotFoundException('Plant not found');
            }

            // Validate conditions and actions
            this.validateConditions(createRuleDto.conditions);
            this.validateActions(createRuleDto.actions);

            // Create the rule
            const rule = await this.databaseService.automationRule.create({
                data: {
                    plantId: createRuleDto.plantId,
                    name: createRuleDto.name,
                    description: createRuleDto.description,
                    conditions: createRuleDto.conditions as Prisma.InputJsonValue,
                    actions: createRuleDto.actions as Prisma.InputJsonValue,
                    isEnabled: true,
                },
            });

            this.logger.log(
                `Automation rule created: ${rule.name} (${rule.id}) for plant: ${plant.name}`,
                'AutomationService',
            );

            return {
                message: 'Automation rule created successfully',
                rule: {
                    id: rule.id,
                    name: rule.name,
                    description: rule.description,
                    conditions: rule.conditions,
                    actions: rule.actions,
                    isEnabled: rule.isEnabled,
                },
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Failed to create automation rule`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );

            throw new InternalServerErrorException('Failed to create automation rule');
        }
    }

    /**
     * Gets all automation rules for a plant (paginated).
     * Ownership is verified by checking the user owns a rack currently growing the plant.
     */
    async findAll(plantId: string, userId: string, query?: PaginationQueryDto) {
        try {
            // Verify the plant exists and the user owns a rack with this plant
            const plant = await this.databaseService.plant.findFirst({
                where: {
                    id: plantId,
                    isActive: true,
                    racks: {
                        some: {
                            userId,
                            isActive: true,
                        },
                    },
                },
            });

            if (!plant) {
                throw new NotFoundException('Plant not found');
            }

            const { skip, take } = PaginationHelper.getPrismaOptions(
                query ?? ({} as PaginationQueryDto),
            );

            const [rules, totalItems] = await Promise.all([
                this.databaseService.automationRule.findMany({
                    where: { plantId },
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                }),
                this.databaseService.automationRule.count({ where: { plantId } }),
            ]);

            this.logger.log(
                `Retrieved ${rules.length} automation rules for plant: ${plantId} (page ${query?.page ?? 1})`,
                'AutomationService',
            );

            return PaginationHelper.createResponse(
                rules,
                totalItems,
                query ?? ({} as PaginationQueryDto),
            );
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Failed to get automation rules for plant: ${plantId}`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );

            throw new InternalServerErrorException('Failed to retrieve automation rules');
        }
    }

    /**
     * Updates an automation rule.
     * Ownership is verified by checking the user owns a rack currently growing
     * the plant associated with the rule.
     */
    async update(ruleId: string, userId: string, updateData: UpdateAutomationRuleDto) {
        try {
            // Verify rule ownership through plant → racks
            const rule = await this.databaseService.automationRule.findUnique({
                where: { id: ruleId },
                include: {
                    plant: {
                        select: {
                            name: true,
                            racks: {
                                where: { userId, isActive: true },
                                select: { id: true },
                            },
                        },
                    },
                },
            });

            if (!rule || rule.plant.racks.length === 0) {
                throw new NotFoundException('Automation rule not found');
            }

            // Validate conditions and actions if provided
            if (updateData.conditions) {
                this.validateConditions(updateData.conditions);
            }
            if (updateData.actions) {
                this.validateActions(updateData.actions);
            }

            const updatedRule = await this.databaseService.automationRule.update({
                where: { id: ruleId },
                data: {
                    ...(updateData.name && { name: updateData.name }),
                    ...(updateData.description !== undefined && {
                        description: updateData.description,
                    }),
                    ...(updateData.conditions && {
                        conditions: updateData.conditions as Prisma.InputJsonValue,
                    }),
                    ...(updateData.actions && {
                        actions: updateData.actions as Prisma.InputJsonValue,
                    }),
                    ...(updateData.isEnabled !== undefined && {
                        isEnabled: updateData.isEnabled,
                    }),
                },
            });

            this.logger.log(
                `Automation rule updated: ${updatedRule.name} (${updatedRule.id})`,
                'AutomationService',
            );

            return {
                message: 'Automation rule updated successfully',
                rule: updatedRule,
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Failed to update automation rule: ${ruleId}`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );

            throw new InternalServerErrorException('Failed to update automation rule');
        }
    }

    /**
     * Deletes an automation rule.
     * Ownership is verified by checking the user owns a rack currently growing
     * the plant associated with the rule.
     */
    async delete(ruleId: string, userId: string) {
        try {
            // Verify rule ownership through plant → racks
            const rule = await this.databaseService.automationRule.findUnique({
                where: { id: ruleId },
                include: {
                    plant: {
                        select: {
                            name: true,
                            racks: {
                                where: { userId, isActive: true },
                                select: { id: true },
                            },
                        },
                    },
                },
            });

            if (!rule || rule.plant.racks.length === 0) {
                throw new NotFoundException('Automation rule not found');
            }

            await this.databaseService.automationRule.delete({
                where: { id: ruleId },
            });

            this.logger.log(
                `Automation rule deleted: ${rule.name} (${rule.id})`,
                'AutomationService',
            );

            return {
                message: 'Automation rule deleted successfully',
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Failed to delete automation rule: ${ruleId}`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );

            throw new InternalServerErrorException('Failed to delete automation rule');
        }
    }

    /**
     * Validates rule conditions — at least one must be specified with valid thresholds.
     */
    private validateConditions(conditions: RuleConditions): void {
        const hasConditions =
            conditions.moisture ||
            conditions.temperature ||
            conditions.humidity ||
            conditions.lightLevel;

        if (!hasConditions) {
            throw new BadRequestException('At least one condition must be specified');
        }

        if (conditions.moisture) {
            if (
                conditions.moisture.lessThan !== undefined &&
                (conditions.moisture.lessThan < 0 || conditions.moisture.lessThan > 100)
            ) {
                throw new BadRequestException('Moisture threshold must be between 0 and 100');
            }
            if (
                conditions.moisture.greaterThan !== undefined &&
                (conditions.moisture.greaterThan < 0 || conditions.moisture.greaterThan > 100)
            ) {
                throw new BadRequestException('Moisture threshold must be between 0 and 100');
            }
        }

        if (conditions.temperature) {
            if (
                conditions.temperature.lessThan !== undefined &&
                (conditions.temperature.lessThan < -50 || conditions.temperature.lessThan > 100)
            ) {
                throw new BadRequestException('Temperature threshold must be between -50 and 100');
            }
            if (
                conditions.temperature.greaterThan !== undefined &&
                (conditions.temperature.greaterThan < -50 ||
                    conditions.temperature.greaterThan > 100)
            ) {
                throw new BadRequestException('Temperature threshold must be between -50 and 100');
            }
        }

        if (conditions.humidity) {
            if (
                conditions.humidity.lessThan !== undefined &&
                (conditions.humidity.lessThan < 0 || conditions.humidity.lessThan > 100)
            ) {
                throw new BadRequestException('Humidity threshold must be between 0 and 100');
            }
            if (
                conditions.humidity.greaterThan !== undefined &&
                (conditions.humidity.greaterThan < 0 || conditions.humidity.greaterThan > 100)
            ) {
                throw new BadRequestException('Humidity threshold must be between 0 and 100');
            }
        }

        if (conditions.lightLevel) {
            if (
                conditions.lightLevel.lessThan !== undefined &&
                conditions.lightLevel.lessThan < 0
            ) {
                throw new BadRequestException('Light level threshold must be non-negative');
            }
            if (
                conditions.lightLevel.greaterThan !== undefined &&
                conditions.lightLevel.greaterThan < 0
            ) {
                throw new BadRequestException('Light level threshold must be non-negative');
            }
        }
    }

    /**
     * Validates rule actions — at least one must be specified with valid values.
     */
    private validateActions(actions: RuleActions): void {
        const hasActions = actions.watering || actions.growLight;

        if (!hasActions) {
            throw new BadRequestException('At least one action must be specified');
        }

        if (actions.watering) {
            if (!['watering_start', 'stop'].includes(actions.watering.action)) {
                throw new BadRequestException('Watering action must be "watering_start" or "stop"');
            }
        }

        if (actions.growLight) {
            if (!['light_on', 'off'].includes(actions.growLight.action)) {
                throw new BadRequestException('Grow light action must be "light_on" or "off"');
            }
        }
    }
}
