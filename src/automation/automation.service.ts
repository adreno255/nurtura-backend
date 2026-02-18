import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorData, RuleConditions, RuleActions } from './interfaces/automation.interface';
import { type Prisma, ActivityEventType } from '../generated/prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import {
    AutomatedEventDto,
    CreateAutomationRuleDto,
    GrowLightActionDto,
    UpdateAutomationRuleDto,
    WateringActionDto,
} from './dto';

@Injectable()
export class AutomationService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly eventEmitter: EventEmitter2,
        private readonly logRackActivityHelper: LogRackActivityHelper,
        private readonly logger: MyLoggerService,
    ) {}

    /**
     * Evaluates automation rules for a rack based on sensor data
     * Called by SensorsService after saving sensor data
     *
     * @param rackId - Rack ID
     * @param sensorData - Latest sensor reading
     */
    async evaluateRules(rackId: string, sensorData: SensorData): Promise<void> {
        this.logger.log(`Evaluating automation rules for rack: ${rackId}`, 'AutomationService');

        try {
            // Get all enabled automation rules for this rack
            const rules = await this.databaseService.automationRule.findMany({
                where: {
                    rackId,
                    isEnabled: true,
                },
                include: {
                    rack: {
                        select: {
                            macAddress: true,
                            name: true,
                        },
                    },
                },
            });

            if (rules.length === 0) {
                this.logger.warn(
                    `No automation rules found for rack: ${rackId}`,
                    'AutomationService',
                );
                return;
            }

            this.logger.log(
                `Found ${rules.length} enabled automation rules for rack: ${rackId}`,
                'AutomationService',
            );

            // Evaluate each rule
            for (const rule of rules) {
                // Check cooldown period
                if (rule.cooldownMinutes && rule.lastTriggeredAt) {
                    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
                    const timeSinceLastTrigger = Date.now() - rule.lastTriggeredAt.getTime();

                    if (timeSinceLastTrigger < cooldownMs) {
                        this.logger.debug(
                            `Rule "${rule.name}" is in cooldown period (${Math.round((cooldownMs - timeSinceLastTrigger) / 1000)}s remaining)`,
                            'AutomationService',
                        );
                        continue;
                    }
                }

                // Evaluate conditions
                const conditions = rule.conditions as RuleConditions;
                const shouldTrigger = this.evaluateConditions(conditions, sensorData);

                if (shouldTrigger) {
                    this.logger.log(
                        `Rule "${rule.name}" triggered for rack: ${rackId}`,
                        'AutomationService',
                    );

                    // Execute actions
                    const actions = rule.actions as RuleActions;
                    await this.executeActions(rule.rack.macAddress, actions, rackId, rule.name);

                    // Update rule trigger information
                    await this.databaseService.automationRule.update({
                        where: { id: rule.id },
                        data: {
                            lastTriggeredAt: new Date(),
                            triggerCount: rule.triggerCount + 1,
                        },
                    });

                    // Log activity
                    await this.logRackActivityHelper.logActivity(
                        rackId,
                        ActivityEventType.AUTOMATION_TRIGGERED,
                        `Automation rule "${rule.name}" triggered`,
                        {
                            ruleId: rule.id,
                            ruleName: rule.name,
                            conditions,
                            actions,
                            sensorData,
                        } as unknown as Prisma.InputJsonValue,
                    );

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
            // Don't throw - automation failures shouldn't break sensor data processing
        }
    }

    /**
     * Evaluates whether rule conditions are met based on sensor data
     */
    private evaluateConditions(conditions: RuleConditions, sensorData: SensorData): boolean {
        // All conditions must be true (AND logic)
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
     * Executes automation actions by publishing MQTT commands
     */
    private async executeActions(
        macAddress: string,
        actions: RuleActions,
        rackId: string,
        ruleName: string,
    ): Promise<void> {
        const executedActions: string[] = [];

        try {
            // Execute watering action
            if (actions.watering) {
                const wateringCommand: WateringActionDto = {
                    action: actions.watering.action,
                    ...(actions.watering.duration && { duration: actions.watering.duration }),
                };

                this.eventEmitter.emit('publishCommand', macAddress, 'watering', wateringCommand);

                executedActions.push(
                    `watering:${actions.watering.action} for ${actions.watering.duration ?? 'default'}ms`,
                );

                // Log watering activity
                await this.logRackActivityHelper.logActivity(
                    rackId,
                    actions.watering.action === 'start'
                        ? ActivityEventType.WATERING_ON
                        : ActivityEventType.WATERING_OFF,
                    `Watering ${actions.watering.action} triggered by automation rule "${ruleName}"`,
                    {
                        source: 'automation',
                        ruleName,
                        duration: actions.watering.duration,
                    } as Prisma.InputJsonValue,
                );
            }

            // Execute grow light action
            if (actions.growLight) {
                const lightingCommand: GrowLightActionDto = {
                    action: actions.growLight.action,
                };

                this.eventEmitter.emit('publishCommand', macAddress, 'lighting', lightingCommand);

                executedActions.push(`growLight:${actions.growLight.action}`);

                // Log lighting activity
                await this.logRackActivityHelper.logActivity(
                    rackId,
                    actions.growLight.action === 'on'
                        ? ActivityEventType.LIGHT_ON
                        : ActivityEventType.LIGHT_OFF,
                    `Grow light ${actions.growLight.action} triggered by automation rule "${ruleName}"`,
                    {
                        source: 'automation',
                        ruleName,
                    } as Prisma.InputJsonValue,
                );
            }

            const automatedEvents: AutomatedEventDto = {
                rackId,
                ruleName,
                executedActions,
                timestamp: new Date(),
            };

            // Broadcast automation execution to WebSocket clients
            this.eventEmitter.emit('broadcastAutomationEvent', automatedEvents);

            this.logger.log(
                `Executed actions for rule "${ruleName}": ${executedActions.join(', ')}`,
                'AutomationService',
            );
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
     * Create a new automation rule
     */
    async create(userId: string, createRuleDto: CreateAutomationRuleDto) {
        try {
            // Verify rack ownership
            const rack = await this.databaseService.rack.findFirst({
                where: {
                    id: createRuleDto.rackId,
                    userId,
                    isActive: true,
                },
            });

            if (!rack) {
                throw new NotFoundException('Rack not found');
            }

            // Validate conditions and actions
            this.validateConditions(createRuleDto.conditions);
            this.validateActions(createRuleDto.actions);

            // Create the rule
            const rule = await this.databaseService.automationRule.create({
                data: {
                    rackId: createRuleDto.rackId,
                    name: createRuleDto.name,
                    description: createRuleDto.description,
                    conditions: createRuleDto.conditions as Prisma.InputJsonValue,
                    actions: createRuleDto.actions as Prisma.InputJsonValue,
                    cooldownMinutes: createRuleDto.cooldownMinutes,
                    isEnabled: true,
                },
            });

            this.logger.log(
                `Automation rule created: ${rule.name} (${rule.id}) for rack: ${rack.name}`,
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
                    cooldownMinutes: rule.cooldownMinutes,
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
     * Get all automation rules for a rack
     */
    async findAll(rackId: string, userId: string) {
        try {
            // Verify rack ownership
            const rack = await this.databaseService.rack.findFirst({
                where: {
                    id: rackId,
                    userId,
                    isActive: true,
                },
            });

            if (!rack) {
                throw new NotFoundException('Rack not found');
            }

            const rules = await this.databaseService.automationRule.findMany({
                where: { rackId },
                orderBy: { createdAt: 'desc' },
            });

            this.logger.log(
                `Retrieved ${rules.length} automation rules for rack: ${rackId}`,
                'AutomationService',
            );

            return rules;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Failed to get automation rules for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );

            throw new InternalServerErrorException('Failed to retrieve automation rules');
        }
    }

    /**
     * Update an automation rule
     */
    async update(ruleId: string, userId: string, updateData: UpdateAutomationRuleDto) {
        try {
            // Verify rule ownership through rack
            const rule = await this.databaseService.automationRule.findUnique({
                where: { id: ruleId },
                include: {
                    rack: {
                        select: {
                            userId: true,
                            name: true,
                        },
                    },
                },
            });

            if (!rule || rule.rack.userId !== userId) {
                throw new NotFoundException('Automation rule not found');
            }

            // Validate conditions and actions if provided
            if (updateData.conditions) {
                this.validateConditions(updateData.conditions);
            }
            if (updateData.actions) {
                this.validateActions(updateData.actions);
            }

            // Update the rule
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
                    ...(updateData.cooldownMinutes !== undefined && {
                        cooldownMinutes: updateData.cooldownMinutes,
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
     * Delete an automation rule
     */
    async delete(ruleId: string, userId: string) {
        try {
            // Verify rule ownership through rack
            const rule = await this.databaseService.automationRule.findUnique({
                where: { id: ruleId },
                include: {
                    rack: {
                        select: {
                            userId: true,
                            name: true,
                        },
                    },
                },
            });

            if (!rule || rule.rack.userId !== userId) {
                throw new NotFoundException('Automation rule not found');
            }

            // Delete the rule
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
     * Validate rule conditions
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

        // Validate moisture conditions
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

        // Validate temperature conditions
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

        // Validate humidity conditions
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

        // Validate light level conditions
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
     * Validate rule actions
     */
    private validateActions(actions: RuleActions): void {
        const hasActions = actions.watering || actions.growLight;

        if (!hasActions) {
            throw new BadRequestException('At least one action must be specified');
        }

        // Validate watering action
        if (actions.watering) {
            if (!['start', 'stop'].includes(actions.watering.action)) {
                throw new BadRequestException('Watering action must be "start" or "stop"');
            }
            if (
                actions.watering.duration !== undefined &&
                (actions.watering.duration < 1000 || actions.watering.duration > 60000)
            ) {
                throw new BadRequestException(
                    'Watering duration must be between 1000 and 60000 milliseconds',
                );
            }
        }

        // Validate grow light action
        if (actions.growLight) {
            if (!['on', 'off'].includes(actions.growLight.action)) {
                throw new BadRequestException('Grow light action must be "on" or "off"');
            }
        }
    }
}
