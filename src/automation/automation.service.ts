import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
    OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorData, RuleConditions, RuleActions } from './interfaces/automation.interface';
import {
    type Prisma,
    ActivityEventType,
    NotificationType,
    WateringState,
    LightState,
} from '../generated/prisma/client';
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
import {
    RackActuatorState,
    RackWithCurrentPlant,
    RackWithUserAndCurrentPlant,
} from '../racks/interfaces/rack.interface';

@Injectable()
export class AutomationService implements OnModuleInit {
    // In-memory state map: rackId → actuator states
    private readonly rackStateMap = new Map<string, RackActuatorState>();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly eventEmitter: EventEmitter2,
        private readonly logRackActivityHelper: LogRackActivityHelper,
        private readonly logger: MyLoggerService,
    ) {}

    // ─────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────

    async onModuleInit(): Promise<void> {
        await this.hydrateRackStates();
    }

    /**
     * Loads actuator state for all active racks from the DB into memory.
     * Called once on startup so the backend doesn't cold-start with blank state.
     */
    private async hydrateRackStates(): Promise<void> {
        this.logger.log('Hydrating rack actuator states from database...', 'AutomationService');

        try {
            const racks = await this.databaseService.rack.findMany({
                where: { isActive: true },
                select: { id: true, wateringState: true, lightState: true },
            });

            for (const rack of racks) {
                this.rackStateMap.set(rack.id, {
                    watering: rack.wateringState,
                    light: rack.lightState,
                });
            }

            this.logger.log(
                `Hydrated actuator state for ${racks.length} active rack(s)`,
                'AutomationService',
            );
        } catch (error) {
            this.logger.error(
                'Failed to hydrate rack states on startup',
                error instanceof Error ? error.message : String(error),
                'AutomationService',
            );
            // Non-fatal: on-demand hydration in executeActions will cover individual racks
        }
    }

    /**
     * Loads and caches actuator state for a single rack from the DB.
     * Used as a fallback when a rack is missing from the in-memory map
     * (e.g. newly registered device or missed during startup hydration).
     */
    private async hydrateRackState(rackId: string): Promise<RackActuatorState | null> {
        const rack = await this.databaseService.rack.findUnique({
            where: { id: rackId },
            select: { wateringState: true, lightState: true },
        });

        if (!rack) return null;

        const state: RackActuatorState = {
            watering: rack.wateringState,
            light: rack.lightState,
        };

        this.rackStateMap.set(rackId, state);
        return state;
    }

    /**
     * Returns the in-memory state for a rack, hydrating from DB if not yet cached.
     */
    private async getRackState(rackId: string): Promise<RackActuatorState | null> {
        return this.rackStateMap.get(rackId) ?? (await this.hydrateRackState(rackId));
    }

    // ─────────────────────────────────────────────
    // AUTOMATION EVALUATION & EXECUTION
    // ─────────────────────────────────────────────

    /**
     * Evaluates automation rules for a rack based on sensor data.
     * Called by SensorsService after saving sensor data.
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
                    currentPlant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
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
                where: { plantId: rack.currentPlantId, isEnabled: true },
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
                    const isFirstTrigger = await this.executeActions(
                        rack.macAddress,
                        actions,
                        rackId,
                        rack,
                        rule.id,
                        rule.name,
                    );

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
     * Evaluates whether rule conditions are met based on sensor data.
     * All conditions use AND logic — every specified condition must be satisfied.
     */
    private evaluateConditions(conditions: RuleConditions, sensorData: SensorData): boolean {
        if (conditions.moisture) {
            if (
                conditions.moisture.lessThan !== undefined &&
                sensorData.moisture >= conditions.moisture.lessThan
            )
                return false;
            if (
                conditions.moisture.greaterThan !== undefined &&
                sensorData.moisture <= conditions.moisture.greaterThan
            )
                return false;
        }

        if (conditions.temperature) {
            if (
                conditions.temperature.lessThan !== undefined &&
                sensorData.temperature >= conditions.temperature.lessThan
            )
                return false;
            if (
                conditions.temperature.greaterThan !== undefined &&
                sensorData.temperature <= conditions.temperature.greaterThan
            )
                return false;
        }

        if (conditions.humidity) {
            if (
                conditions.humidity.lessThan !== undefined &&
                sensorData.humidity >= conditions.humidity.lessThan
            )
                return false;
            if (
                conditions.humidity.greaterThan !== undefined &&
                sensorData.humidity <= conditions.humidity.greaterThan
            )
                return false;
        }

        if (conditions.lightLevel) {
            if (
                conditions.lightLevel.lessThan !== undefined &&
                sensorData.lightLevel >= conditions.lightLevel.lessThan
            )
                return false;
            if (
                conditions.lightLevel.greaterThan !== undefined &&
                sensorData.lightLevel <= conditions.lightLevel.greaterThan
            )
                return false;
        }

        return true;
    }

    /**
     * Executes automation actions by publishing MQTT commands via EventEmitter.
     * @returns true if at least one action was non-duplicate (triggers triggerCount update)
     */
    private async executeActions(
        macAddress: string,
        actions: RuleActions,
        rackId: string,
        rack: RackWithCurrentPlant,
        ruleId: string,
        ruleName: string,
    ): Promise<boolean> {
        const executedActions: string[] = [];
        let hasNewAction = false;

        try {
            const state = await this.getRackState(rackId);

            if (!state) {
                this.logger.warn(
                    `Rack ${rackId} not found — skipping action execution`,
                    'AutomationService',
                );
                return false;
            }

            if (actions.watering) {
                const isStart = actions.watering.action === 'watering_start';
                const targetState = isStart ? WateringState.RUNNING : WateringState.STOPPED;
                const isDuplicate = state.watering === targetState;

                if (isDuplicate) {
                    this.logger.log(
                        `Skipping watering "${actions.watering.action}" — rack ${rackId} already in state ${state.watering}`,
                        'AutomationService',
                    );
                } else {
                    const wateringCommand: WateringActionDto = { action: actions.watering.action };
                    this.eventEmitter.emit(
                        'publishCommand',
                        macAddress,
                        'watering',
                        wateringCommand,
                    );
                    executedActions.push(`${actions.watering.action}`);
                    hasNewAction = true;

                    state.watering = targetState;

                    // Compute cycle waterUsed only on stop
                    const waterUsed = !isStart
                        ? await this.computeWaterUsedForCycle(rackId)
                        : undefined;

                    const wateringMetadata = {
                        rackName: rack.name,
                        macAddress: rack.macAddress,
                        source: 'automation',
                        plantId: rack.currentPlant?.id,
                        plantName: rack.currentPlant?.name,
                        ruleId,
                        ruleName,
                        ...(!isStart && { waterUsedMl: waterUsed }),
                    };

                    const wateringActivity = await this.logRackActivityHelper.logActivity(
                        rackId,
                        isStart
                            ? ActivityEventType.WATERING_START
                            : ActivityEventType.WATERING_STOP,
                        `Watering ${actions.watering.action} triggered by automation rule "${ruleName}"`,
                        wateringMetadata as Prisma.InputJsonValue,
                    );

                    this.eventEmitter.emit('broadcastAutomationEvent', rackId, {
                        eventType: isStart ? 'WATERING_START' : 'WATERING_STOP',
                        activity: wateringActivity,
                    } satisfies AutomatedEventDto);

                    this.eventEmitter.emit('createNotification', {
                        userId: rack.userId ?? '',
                        rackId,
                        type: NotificationType.AUTOMATION,
                        title: isStart ? 'Watering Started' : 'Watering Stopped',
                        message: isStart
                            ? `Rule "${ruleName}" activated the water pump.`
                            : `Rule "${ruleName}" stopped the water pump.`,
                        metadata: {
                            screen: '/(tabs)/(activity)/plant-care',
                            plantId: rack.currentPlant?.id,
                            plantName: rack.currentPlant?.name,
                            ruleId,
                            ruleName,
                            action: actions.watering.action,
                        },
                    } satisfies CreateNotificationPayload);

                    // Persist new state to DB
                    await this.databaseService.rack.update({
                        where: { id: rackId },
                        data: {
                            wateringState: targetState,
                            lastActivityAt: new Date(),
                            ...(isStart && { lastWateredAt: new Date() }),
                        },
                    });
                }
            }

            if (actions.growLight) {
                const isOn = actions.growLight.action === 'light_on';
                const targetState = isOn ? LightState.ON : LightState.OFF;
                const isDuplicate = state.light === targetState;

                if (isDuplicate) {
                    this.logger.log(
                        `Skipping grow light "${actions.growLight.action}" — rack ${rackId} already in state ${state.light}`,
                        'AutomationService',
                    );
                } else {
                    const lightingCommand: GrowLightActionDto = {
                        action: actions.growLight.action,
                    };
                    this.eventEmitter.emit(
                        'publishCommand',
                        macAddress,
                        'lighting',
                        lightingCommand,
                    );
                    executedActions.push(`growLight:${actions.growLight.action}`);
                    hasNewAction = true;

                    state.light = targetState;

                    // Compute cycle duration only on light_off
                    const lightDuration = !isOn
                        ? await this.computeLightDurationForCycle(rackId)
                        : undefined;

                    const lightMetadata = {
                        rackName: rack.name,
                        macAddress: rack.macAddress,
                        source: 'automation',
                        plantId: rack.currentPlant?.id,
                        plantName: rack.currentPlant?.name,
                        ruleId,
                        ruleName,
                        ...(!isOn && { durationSeconds: lightDuration }),
                    };

                    const lightActivity = await this.logRackActivityHelper.logActivity(
                        rackId,
                        isOn ? ActivityEventType.LIGHT_ON : ActivityEventType.LIGHT_OFF,
                        `Grow light ${actions.growLight.action} triggered by automation rule "${ruleName}"`,
                        lightMetadata as Prisma.InputJsonValue,
                    );

                    this.eventEmitter.emit('broadcastAutomationEvent', rackId, {
                        eventType: isOn ? 'LIGHT_ON' : 'LIGHT_OFF',
                        activity: lightActivity,
                    } satisfies AutomatedEventDto);

                    this.eventEmitter.emit('createNotification', {
                        userId: rack.userId ?? '',
                        rackId,
                        type: NotificationType.AUTOMATION,
                        title: isOn ? 'Grow Light Turned On' : 'Grow Light Turned Off',
                        message: `Rule "${ruleName}" turned the grow light ${isOn ? 'on' : 'off'}.`,
                        metadata: {
                            screen: '/(tabs)/(activity)/plant-care',
                            plantId: rack.currentPlant?.id,
                            plantName: rack.currentPlant?.name,
                            ruleId,
                            ruleName,
                            action: actions.growLight.action,
                        },
                    } satisfies CreateNotificationPayload);

                    // Persist new state to DB
                    await this.databaseService.rack.update({
                        where: { id: rackId },
                        data: {
                            lightState: targetState,
                            lastActivityAt: new Date(),
                            ...(isOn && { lastLightOnAt: new Date() }),
                        },
                    });
                }
            }

            this.logger.log(
                `Executed actions for rule "${ruleName}": ${executedActions.join(', ') || 'none (all duplicates)'}`,
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
     * Applies a system-level light action (schedule or override).
     * Uses the same in-memory state map as executeActions to prevent conflicts.
     * Called by SystemRulesService — not triggered by automation rules.
     *
     * @param source - Identifier for logging (e.g. 'system:schedule', 'system:moisture_override')
     */
    async applySystemLightAction(
        rack: RackWithUserAndCurrentPlant,
        action: 'light_on' | 'light_off',
        source: string,
    ): Promise<void> {
        const state = await this.getRackState(rack.id);

        if (!state) {
            this.logger.warn(
                `Rack ${rack.id} not found in state map — skipping system light action`,
                'AutomationService',
            );
            return;
        }

        const isOn = action === 'light_on';
        const targetState = isOn ? LightState.ON : LightState.OFF;

        if (state.light === targetState) {
            this.logger.log(
                `System light action skipped — rack ${rack.id} already in state ${state.light} (source: ${source})`,
                'AutomationService',
            );
            return;
        }

        const lightingCommand: GrowLightActionDto = { action };
        this.eventEmitter.emit('publishCommand', rack.macAddress, 'lighting', lightingCommand);

        state.light = targetState;

        const lightDuration = !isOn ? await this.computeLightDurationForCycle(rack.id) : undefined;

        const lightMetadata = {
            rackName: rack.name,
            macAddress: rack.macAddress,
            source,
            plantId: rack.currentPlant?.id,
            plantName: rack.currentPlant?.name,
            ...(!isOn && { durationSeconds: lightDuration }),
        };

        const lightActivity = await this.logRackActivityHelper.logActivity(
            rack.id,
            isOn ? ActivityEventType.LIGHT_ON : ActivityEventType.LIGHT_OFF,
            `Grow light ${action} triggered by system rule (${source})`,
            lightMetadata as Prisma.InputJsonValue,
        );

        this.eventEmitter.emit('broadcastAutomationEvent', rack.id, {
            eventType: isOn ? 'LIGHT_ON' : 'LIGHT_OFF',
            activity: lightActivity,
        } satisfies AutomatedEventDto);

        this.eventEmitter.emit('createNotification', {
            userId: rack.userId,
            rackId: rack.id,
            type: NotificationType.AUTOMATION,
            title: isOn ? 'Grow Light Turned On' : 'Grow Light Turned Off',
            message: isOn
                ? `Grow light turned on automatically (${source}).`
                : `Grow light turned off automatically (${source}).`,
            metadata: {
                screen: '/(tabs)/(activity)/plant-care',
                plantId: rack.currentPlant?.id,
                plantName: rack.currentPlant?.name,
                source,
                action,
            },
        } satisfies CreateNotificationPayload);

        await this.databaseService.rack.update({
            where: { id: rack.id },
            data: {
                lightState: targetState,
                lastActivityAt: new Date(),
                ...(isOn && { lastLightOnAt: new Date() }),
            },
        });
    }

    /**
     * Calculates total waterUsed (mL) from sensor readings between
     * the last WATERING_START and now.
     */
    private async computeWaterUsedForCycle(rackId: string): Promise<number> {
        const lastStart = await this.databaseService.activity.findFirst({
            where: { rackId, eventType: ActivityEventType.WATERING_START },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true },
        });

        if (!lastStart) return 0;

        const result = await this.databaseService.sensorReading.aggregate({
            where: {
                rackId,
                timestamp: { gte: lastStart.timestamp },
                waterUsed: { not: null },
            },
            _sum: { waterUsed: true },
        });

        return result._sum.waterUsed ?? 0;
    }

    /**
     * Calculates grow light ON duration in seconds between
     * the last LIGHT_ON and now.
     */
    private async computeLightDurationForCycle(rackId: string): Promise<number> {
        const lastLightOn = await this.databaseService.activity.findFirst({
            where: { rackId, eventType: ActivityEventType.LIGHT_ON },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true },
        });

        if (!lastLightOn) return 0;

        return Math.floor((Date.now() - lastLightOn.timestamp.getTime()) / 1000);
    }

    // ─────────────────────────────────────────────
    // CRUD FOR AUTOMATION RULES
    // ─────────────────────────────────────────────

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
            if (!['watering_start', 'watering_stop'].includes(actions.watering.action)) {
                throw new BadRequestException(
                    'Watering action must be "watering_start" or "watering_stop"',
                );
            }
        }

        if (actions.growLight) {
            if (!['light_on', 'light_off'].includes(actions.growLight.action)) {
                throw new BadRequestException(
                    'Grow light action must be "light_on" or "light_off"',
                );
            }
        }
    }
}
