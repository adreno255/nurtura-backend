import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { LogRackActivityHelper } from '../common/utils/log-rack-activity.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityEventType } from '../generated/prisma';
import {
    createMockDatabaseService,
    createMockLogger,
    createMockLogRackActivityHelper,
    createMockEventEmitter,
} from '../../test/mocks';
import {
    testAutomationIds,
    mockAutomationRule,
    mockAutomationRules,
    mockAutomationRuleWithCooldown,
    mockAutomationRuleExpiredCooldown,
    mockAutomationRuleWithPlant,
    mockAutomationRuleWithDifferentUser,
    validCreateAutomationRuleDto,
    validUpdateAutomationRuleDto,
    disableRuleDto,
    invalidNoConditionsDto,
    invalidNoActionsDto,
    invalidMoistureThresholdDto,
    invalidTemperatureThresholdDto,
    invalidWateringActionDto,
    invalidWateringDurationDto,
    invalidGrowLightActionDto,
    moistureLessThanCondition,
    multipleActions,
    wateringStopAction,
    growLightOnAction,
    growLightOffAction,
    mockRackForAutomation,
    mockRackWithoutPlant,
    mockPlantForAutomation,
    lowMoistureSensorData,
    highMoistureSensorData,
    lowTemperatureSensorData,
    highTemperatureSensorData,
    lowHumiditySensorData,
    lowLightSensorData,
} from '../../test/fixtures';

describe('AutomationService', () => {
    let service: AutomationService;

    const mockDatabaseService = createMockDatabaseService();
    const mockLoggerService = createMockLogger();
    const mockLogRackActivityHelper = createMockLogRackActivityHelper();
    const mockEventEmitter = createMockEventEmitter();

    const testRuleId = testAutomationIds.ruleId;
    const testRackId = testAutomationIds.rackId;
    const testPlantId = testAutomationIds.plantId;
    const testUserId = testAutomationIds.userId;

    const mockRackSelectResult = {
        macAddress: mockRackForAutomation.macAddress,
        name: mockRackForAutomation.name,
        currentPlantId: mockRackForAutomation.currentPlantId,
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AutomationService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
                { provide: LogRackActivityHelper, useValue: mockLogRackActivityHelper },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<AutomationService>(AutomationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // evaluateRules
    // ─────────────────────────────────────────────

    describe('evaluateRules', () => {
        it('should return early and warn when rack is not found', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('Rack not found'),
                'AutomationService',
            );
            expect(mockDatabaseService.automationRule.findMany).not.toHaveBeenCalled();
        });

        it('should return early and log when rack has no current plant', async () => {
            // mockRackWithoutPlant has currentPlantId: null
            mockDatabaseService.rack.findUnique.mockResolvedValue({
                macAddress: mockRackWithoutPlant.macAddress,
                name: mockRackWithoutPlant.name,
                currentPlantId: mockRackWithoutPlant.currentPlantId,
            });

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('no current plant'),
                'AutomationService',
            );
            expect(mockDatabaseService.automationRule.findMany).not.toHaveBeenCalled();
        });

        it('should fetch enabled rules filtered by currentPlantId', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([]);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockDatabaseService.automationRule.findMany).toHaveBeenCalledWith({
                where: {
                    plantId: testPlantId,
                    isEnabled: true,
                },
            });
        });

        it('should return early and warn when no enabled rules found for plant', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([]);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('No automation rules found'),
                'AutomationService',
            );
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should trigger a rule when conditions are met', async () => {
            // mockAutomationRule uses moistureLessThanCondition (lessThan: 30); lowMoistureSensorData has moisture: 20
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([
                { ...mockAutomationRule, lastTriggeredAt: null, cooldownMinutes: null },
            ]);
            mockDatabaseService.automationRule.update.mockResolvedValue(mockAutomationRule);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                mockRackSelectResult.macAddress,
                'watering',
                expect.objectContaining({ action: 'start' }),
            );
        });

        it('should NOT trigger a rule when conditions are not met', async () => {
            // highMoistureSensorData has moisture: 75 — does not satisfy lessThan: 30
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([
                { ...mockAutomationRule, lastTriggeredAt: null, cooldownMinutes: null },
            ]);

            await service.evaluateRules(testRackId, highMoistureSensorData);

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should skip a rule still within its cooldown period', async () => {
            // mockAutomationRuleWithCooldown: lastTriggeredAt 10 min ago, cooldownMinutes: 30
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([
                mockAutomationRuleWithCooldown,
            ]);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger a rule whose cooldown has expired', async () => {
            // mockAutomationRuleExpiredCooldown: lastTriggeredAt 35 min ago, cooldownMinutes: 30
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([
                mockAutomationRuleExpiredCooldown,
            ]);
            mockDatabaseService.automationRule.update.mockResolvedValue(
                mockAutomationRuleExpiredCooldown,
            );

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                'watering',
                expect.any(Object),
            );
        });

        it('should update triggerCount and lastTriggeredAt after triggering', async () => {
            const rule = { ...mockAutomationRule, lastTriggeredAt: null, cooldownMinutes: null };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([rule]);
            mockDatabaseService.automationRule.update.mockResolvedValue(rule);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockDatabaseService.automationRule.update).toHaveBeenCalledWith({
                where: { id: rule.id },
                data: expect.objectContaining({
                    lastTriggeredAt: expect.any(Date) as Date,
                    triggerCount: rule.triggerCount + 1,
                }) as object,
            });
        });

        it('should log AUTOMATION_TRIGGERED activity after a rule fires', async () => {
            const rule = { ...mockAutomationRule, lastTriggeredAt: null, cooldownMinutes: null };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([rule]);
            mockDatabaseService.automationRule.update.mockResolvedValue(rule);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.AUTOMATION_TRIGGERED,
                expect.stringContaining(rule.name),
                expect.objectContaining({ ruleId: rule.id }),
            );
        });

        it('should emit broadcastAutomationEvent after executing actions', async () => {
            const rule = { ...mockAutomationRule, lastTriggeredAt: null, cooldownMinutes: null };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([rule]);
            mockDatabaseService.automationRule.update.mockResolvedValue(rule);

            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastAutomationEvent',
                expect.objectContaining({
                    rackId: testRackId,
                    ruleName: rule.name,
                    executedActions: expect.any(Array) as string[],
                }),
            );
        });

        it('should not throw when an error occurs — automation failures are non-fatal', async () => {
            mockDatabaseService.rack.findUnique.mockRejectedValue(new Error('DB connection error'));

            await expect(
                service.evaluateRules(testRackId, lowMoistureSensorData),
            ).resolves.not.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to evaluate rules'),
                expect.any(String),
                'AutomationService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // evaluateConditions (tested indirectly via evaluateRules)
    // ─────────────────────────────────────────────

    describe('evaluateConditions (via evaluateRules)', () => {
        /** Registers a rule with the given conditions and mocks the rack/rule DB calls. */
        const setup = (conditions: object) => {
            const rule = {
                ...mockAutomationRule,
                conditions,
                lastTriggeredAt: null,
                cooldownMinutes: null,
            };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([rule]);
            mockDatabaseService.automationRule.update.mockResolvedValue(rule);
        };

        it('should trigger when moisture is below lessThan threshold', async () => {
            setup({ moisture: { lessThan: 30 } });
            // lowMoistureSensorData.moisture = 20 < 30 ✓
            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should NOT trigger when moisture equals the lessThan threshold (strict)', async () => {
            setup({ moisture: { lessThan: 30 } });
            // moisture === 30 is NOT less-than, so the condition is not met
            await service.evaluateRules(testRackId, { ...lowMoistureSensorData, moisture: 30 });

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when moisture is above greaterThan threshold', async () => {
            setup({ moisture: { greaterThan: 70 } });
            // highMoistureSensorData.moisture = 75 > 70 ✓
            await service.evaluateRules(testRackId, highMoistureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when temperature is below lessThan threshold', async () => {
            setup({ temperature: { lessThan: 20 } });
            // lowTemperatureSensorData.temperature = 15 < 20 ✓
            await service.evaluateRules(testRackId, lowTemperatureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when temperature is above greaterThan threshold', async () => {
            setup({ temperature: { greaterThan: 30 } });
            // highTemperatureSensorData.temperature = 35 > 30 ✓
            await service.evaluateRules(testRackId, highTemperatureSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when humidity is below lessThan threshold', async () => {
            setup({ humidity: { lessThan: 40 } });
            // lowHumiditySensorData.humidity = 35 < 40 ✓
            await service.evaluateRules(testRackId, lowHumiditySensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when lightLevel is below lessThan threshold', async () => {
            setup({ lightLevel: { lessThan: 500 } });
            // lowLightSensorData.lightLevel = 300 < 500 ✓
            await service.evaluateRules(testRackId, lowLightSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should use AND logic — all conditions must pass to trigger', async () => {
            // moisture < 30 AND temperature > 30
            setup({ moisture: { lessThan: 30 }, temperature: { greaterThan: 30 } });
            // lowMoistureSensorData: moisture 20 ✓, temperature 25 ✗ — should NOT fire
            await service.evaluateRules(testRackId, lowMoistureSensorData);

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should trigger when every condition in AND logic is met', async () => {
            // moisture < 30 AND temperature > 30 — both satisfied below
            setup({ moisture: { lessThan: 30 }, temperature: { greaterThan: 30 } });
            await service.evaluateRules(testRackId, {
                ...lowMoistureSensorData, // moisture: 20 ✓
                temperature: 35, // temperature: 35 > 30 ✓
            });

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
            );
        });
    });

    // ─────────────────────────────────────────────
    // executeActions (tested indirectly via evaluateRules)
    // ─────────────────────────────────────────────

    describe('executeActions (via evaluateRules)', () => {
        /**
         * Mocks a triggered rule with the given actions and runs evaluateRules.
         * Uses moistureLessThanCondition + lowMoistureSensorData to guarantee firing.
         */
        const triggerRuleWithActions = async (actions: object) => {
            const rule = {
                ...mockAutomationRule,
                conditions: moistureLessThanCondition,
                actions,
                lastTriggeredAt: null,
                cooldownMinutes: null,
            };
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRackSelectResult);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([rule]);
            mockDatabaseService.automationRule.update.mockResolvedValue(rule);

            await service.evaluateRules(testRackId, lowMoistureSensorData);
        };

        it('should emit publishCommand for watering start', async () => {
            // mockAutomationRule.actions = wateringStartAction = { watering: { action: 'start', duration: 5000 } }
            await triggerRuleWithActions(mockAutomationRule.actions);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                mockRackSelectResult.macAddress,
                'watering',
                expect.objectContaining({ action: 'start', duration: 5000 }),
            );
        });

        it('should emit publishCommand for watering stop', async () => {
            // wateringStopAction = { watering: { action: 'stop' } }
            await triggerRuleWithActions(wateringStopAction);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                mockRackSelectResult.macAddress,
                'watering',
                expect.objectContaining({ action: 'stop' }),
            );
        });

        it('should log WATERING_ON activity for watering start', async () => {
            await triggerRuleWithActions(mockAutomationRule.actions);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.WATERING_ON,
                expect.stringContaining('Watering start'),
                expect.any(Object),
            );
        });

        it('should log WATERING_OFF activity for watering stop', async () => {
            await triggerRuleWithActions(wateringStopAction);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.WATERING_OFF,
                expect.stringContaining('Watering stop'),
                expect.any(Object),
            );
        });

        it('should emit publishCommand for grow light on', async () => {
            // growLightOnAction = { growLight: { action: 'on' } }
            await triggerRuleWithActions(growLightOnAction);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                mockRackSelectResult.macAddress,
                'lighting',
                expect.objectContaining({ action: 'on' }),
            );
        });

        it('should emit publishCommand for grow light off', async () => {
            // growLightOffAction = { growLight: { action: 'off' } }
            await triggerRuleWithActions(growLightOffAction);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                mockRackSelectResult.macAddress,
                'lighting',
                expect.objectContaining({ action: 'off' }),
            );
        });

        it('should log LIGHT_ON activity for grow light on', async () => {
            await triggerRuleWithActions(growLightOnAction);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.LIGHT_ON,
                expect.stringContaining('Grow light on'),
                expect.any(Object),
            );
        });

        it('should log LIGHT_OFF activity for grow light off', async () => {
            await triggerRuleWithActions(growLightOffAction);

            expect(mockLogRackActivityHelper.logActivity).toHaveBeenCalledWith(
                testRackId,
                ActivityEventType.LIGHT_OFF,
                expect.stringContaining('Grow light off'),
                expect.any(Object),
            );
        });

        it('should emit both watering and lighting commands for multipleActions', async () => {
            // multipleActions = { watering: { action: 'start', duration: 5000 }, growLight: { action: 'on' } }
            await triggerRuleWithActions(multipleActions);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                'watering',
                expect.any(Object),
            );
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'publishCommand',
                expect.any(String),
                'lighting',
                expect.any(Object),
            );
        });
    });

    // ─────────────────────────────────────────────
    // create
    // ─────────────────────────────────────────────

    describe('create', () => {
        it('should create an automation rule successfully', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.create.mockResolvedValue(mockAutomationRule);

            const result = await service.create(testUserId, validCreateAutomationRuleDto);

            expect(result.message).toBe('Automation rule created successfully');
            expect(result.rule).toBeDefined();
        });

        it('should verify plant ownership via plant → racks', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.create.mockResolvedValue(mockAutomationRule);

            await service.create(testUserId, validCreateAutomationRuleDto);

            expect(mockDatabaseService.plant.findFirst).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    id: validCreateAutomationRuleDto.plantId,
                    isActive: true,
                    racks: { some: { userId: testUserId, isActive: true } },
                }) as object,
            });
        });

        it('should throw NotFoundException when plant is not found or user has no access', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(null);

            await expect(service.create(testUserId, validCreateAutomationRuleDto)).rejects.toThrow(
                new NotFoundException('Plant not found'),
            );
        });

        it('should throw BadRequestException when conditions are empty', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidNoConditionsDto.conditions = {}
            await expect(service.create(testUserId, invalidNoConditionsDto)).rejects.toThrow(
                new BadRequestException('At least one condition must be specified'),
            );
        });

        it('should throw BadRequestException when actions are empty', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidNoActionsDto.actions = {}
            await expect(service.create(testUserId, invalidNoActionsDto)).rejects.toThrow(
                new BadRequestException('At least one action must be specified'),
            );
        });

        it('should throw BadRequestException for moisture threshold out of range', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidMoistureThresholdDto.conditions = { moisture: { lessThan: 150 } }
            await expect(service.create(testUserId, invalidMoistureThresholdDto)).rejects.toThrow(
                new BadRequestException('Moisture threshold must be between 0 and 100'),
            );
        });

        it('should throw BadRequestException for temperature threshold out of range', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidTemperatureThresholdDto.conditions = { temperature: { greaterThan: 150 } }
            await expect(
                service.create(testUserId, invalidTemperatureThresholdDto),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for invalid watering action', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidWateringActionDto.actions = { watering: { action: 'invalid' } }
            await expect(service.create(testUserId, invalidWateringActionDto)).rejects.toThrow(
                new BadRequestException('Watering action must be "start" or "stop"'),
            );
        });

        it('should throw BadRequestException for watering duration out of range', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidWateringDurationDto.actions = { watering: { action: 'start', duration: 100000 } }
            await expect(service.create(testUserId, invalidWateringDurationDto)).rejects.toThrow(
                new BadRequestException(
                    'Watering duration must be between 1000 and 60000 milliseconds',
                ),
            );
        });

        it('should throw BadRequestException for invalid grow light action', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);

            // invalidGrowLightActionDto.actions = { growLight: { action: 'toggle' } }
            await expect(service.create(testUserId, invalidGrowLightActionDto)).rejects.toThrow(
                new BadRequestException('Grow light action must be "on" or "off"'),
            );
        });

        it('should log rule creation with name and plant name', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.create.mockResolvedValue(mockAutomationRule);

            await service.create(testUserId, validCreateAutomationRuleDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Automation rule created: ${mockAutomationRule.name}`),
                'AutomationService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.create.mockRejectedValue(new Error('DB error'));

            await expect(service.create(testUserId, validCreateAutomationRuleDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // findAll
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        const query = { page: 1, limit: 10 };

        it('should return paginated rules for a plant', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.findMany.mockResolvedValue(mockAutomationRules);
            mockDatabaseService.automationRule.count.mockResolvedValue(mockAutomationRules.length);

            const result = await service.findAll(testPlantId, testUserId, query);

            expect(result.data).toEqual(mockAutomationRules);
            expect(result.meta.totalItems).toBe(mockAutomationRules.length);
        });

        it('should verify plant ownership before fetching rules', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.findMany.mockResolvedValue([]);
            mockDatabaseService.automationRule.count.mockResolvedValue(0);

            await service.findAll(testPlantId, testUserId, query);

            expect(mockDatabaseService.plant.findFirst).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    id: testPlantId,
                    isActive: true,
                    racks: { some: { userId: testUserId, isActive: true } },
                }) as object,
            });
        });

        it('should filter rules by plantId', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.findMany.mockResolvedValue(mockAutomationRules);
            mockDatabaseService.automationRule.count.mockResolvedValue(mockAutomationRules.length);

            await service.findAll(testPlantId, testUserId, query);

            expect(mockDatabaseService.automationRule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { plantId: testPlantId } }),
            );
        });

        it('should order rules by createdAt descending', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.findMany.mockResolvedValue(mockAutomationRules);
            mockDatabaseService.automationRule.count.mockResolvedValue(mockAutomationRules.length);

            await service.findAll(testPlantId, testUserId, query);

            expect(mockDatabaseService.automationRule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
            );
        });

        it('should throw NotFoundException when plant not found or user has no access', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(null);

            await expect(service.findAll(testPlantId, testUserId, query)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.plant.findFirst.mockResolvedValue(mockPlantForAutomation);
            mockDatabaseService.automationRule.findMany.mockRejectedValue(new Error('DB error'));

            await expect(service.findAll(testPlantId, testUserId, query)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    // ─────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────

    describe('update', () => {
        const updatedRule = { ...mockAutomationRule, ...validUpdateAutomationRuleDto };

        it('should update an automation rule successfully', async () => {
            // mockAutomationRuleWithPlant has plant.racks: [{ id: testAutomationIds.rackId }]
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.update.mockResolvedValue(updatedRule);

            const result = await service.update(
                testRuleId,
                testUserId,
                validUpdateAutomationRuleDto,
            );

            expect(result.message).toBe('Automation rule updated successfully');
            expect(result.rule).toEqual(updatedRule);
        });

        it('should verify ownership via automationRule → plant → racks', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.update.mockResolvedValue(updatedRule);

            await service.update(testRuleId, testUserId, validUpdateAutomationRuleDto);

            expect(mockDatabaseService.automationRule.findUnique).toHaveBeenCalledWith({
                where: { id: testRuleId },
                include: expect.objectContaining({
                    plant: expect.objectContaining({
                        select: expect.objectContaining({
                            racks: expect.objectContaining({
                                where: expect.objectContaining({ userId: testUserId }) as object,
                            }) as object,
                        }) as object,
                    }) as object,
                }) as object,
            });
        });

        it('should throw NotFoundException when rule is not found', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(null);

            await expect(
                service.update(testRuleId, testUserId, validUpdateAutomationRuleDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException when user owns no rack for this plant', async () => {
            // mockAutomationRuleWithDifferentUser has plant.racks: []
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithDifferentUser,
            );

            await expect(
                service.update(testRuleId, testUserId, validUpdateAutomationRuleDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should validate updated conditions when provided', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );

            // invalidMoistureThresholdDto.conditions = { moisture: { lessThan: 150 } }
            await expect(
                service.update(testRuleId, testUserId, {
                    conditions: invalidMoistureThresholdDto.conditions,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should validate updated actions when provided', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );

            // invalidWateringActionDto.actions = { watering: { action: 'invalid' } }
            await expect(
                service.update(testRuleId, testUserId, {
                    actions: invalidWateringActionDto.actions,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should skip validation when neither conditions nor actions are in the payload', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.update.mockResolvedValue(updatedRule);

            await expect(
                service.update(testRuleId, testUserId, { name: 'New name' }),
            ).resolves.toBeDefined();
        });

        it('should disable a rule via disableRuleDto', async () => {
            // disableRuleDto = { isEnabled: false }
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.update.mockResolvedValue({
                ...mockAutomationRule,
                isEnabled: false,
            });

            await service.update(testRuleId, testUserId, disableRuleDto);

            expect(mockDatabaseService.automationRule.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ isEnabled: false }) as object,
                }),
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.update.mockRejectedValue(new Error('DB error'));

            await expect(
                service.update(testRuleId, testUserId, validUpdateAutomationRuleDto),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ─────────────────────────────────────────────
    // delete
    // ─────────────────────────────────────────────

    describe('delete', () => {
        it('should delete an automation rule successfully', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.delete.mockResolvedValue(mockAutomationRule);

            const result = await service.delete(testRuleId, testUserId);

            expect(result).toEqual({ message: 'Automation rule deleted successfully' });
            expect(mockDatabaseService.automationRule.delete).toHaveBeenCalledWith({
                where: { id: testRuleId },
            });
        });

        it('should verify ownership via automationRule → plant → racks before deleting', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.delete.mockResolvedValue(mockAutomationRule);

            await service.delete(testRuleId, testUserId);

            expect(mockDatabaseService.automationRule.findUnique).toHaveBeenCalledWith({
                where: { id: testRuleId },
                include: expect.objectContaining({
                    plant: expect.objectContaining({
                        select: expect.objectContaining({
                            racks: expect.objectContaining({
                                where: expect.objectContaining({ userId: testUserId }) as object,
                            }) as object,
                        }) as object,
                    }) as object,
                }) as object,
            });
        });

        it('should throw NotFoundException when rule does not exist', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(null);

            await expect(service.delete(testRuleId, testUserId)).rejects.toThrow(
                new NotFoundException('Automation rule not found'),
            );
        });

        it('should throw NotFoundException when user owns no rack for the plant', async () => {
            // mockAutomationRuleWithDifferentUser has plant.racks: []
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithDifferentUser,
            );

            await expect(service.delete(testRuleId, testUserId)).rejects.toThrow(NotFoundException);
        });

        it('should log rule name and id on successful deletion', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.delete.mockResolvedValue(mockAutomationRule);

            await service.delete(testRuleId, testUserId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Automation rule deleted: ${mockAutomationRule.name}`),
                'AutomationService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            mockDatabaseService.automationRule.delete.mockRejectedValue(new Error('DB error'));

            await expect(service.delete(testRuleId, testUserId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log the error message on database failure', async () => {
            mockDatabaseService.automationRule.findUnique.mockResolvedValue(
                mockAutomationRuleWithPlant,
            );
            const dbError = new Error('DB connection failed');
            mockDatabaseService.automationRule.delete.mockRejectedValue(dbError);

            await expect(service.delete(testRuleId, testUserId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to delete automation rule: ${testRuleId}`),
                dbError.message,
                'AutomationService',
            );
        });
    });
});
