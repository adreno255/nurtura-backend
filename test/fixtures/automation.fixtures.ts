/**
 * Automation Test Fixtures
 * Reusable test data for automation-related tests
 * Updated to use plant-scoped automation rules
 */

import {
    type CreateAutomationRuleDto,
    type UpdateAutomationRuleDto,
} from '../../src/automation/dto';
import {
    type RuleConditions,
    type RuleActions,
} from '../../src/automation/interfaces/automation.interface';

/**
 * Common test IDs
 */
export const testAutomationIds = {
    ruleId: 'rule-789',
    plantId: 'plant-456',
    rackId: 'rack-123',
    userId: 'user-123',
};

/**
 * Rule conditions
 */
export const moistureLessThanCondition: RuleConditions = {
    moisture: {
        lessThan: 30,
    },
};

export const moistureGreaterThanCondition: RuleConditions = {
    moisture: {
        greaterThan: 70,
    },
};

export const temperatureLessThanCondition: RuleConditions = {
    temperature: {
        lessThan: 20,
    },
};

export const temperatureGreaterThanCondition: RuleConditions = {
    temperature: {
        greaterThan: 30,
    },
};

export const humidityLessThanCondition: RuleConditions = {
    humidity: {
        lessThan: 40,
    },
};

export const humidityGreaterThanCondition: RuleConditions = {
    humidity: {
        greaterThan: 80,
    },
};

export const lightLevelLessThanCondition: RuleConditions = {
    lightLevel: {
        lessThan: 500,
    },
};

export const lightLevelGreaterThanCondition: RuleConditions = {
    lightLevel: {
        greaterThan: 1000,
    },
};

export const multipleConditions: RuleConditions = {
    moisture: {
        lessThan: 30,
    },
    temperature: {
        greaterThan: 20,
    },
};

export const rangeCondition: RuleConditions = {
    moisture: {
        lessThan: 80,
        greaterThan: 20,
    },
};

/**
 * Rule actions
 */
export const wateringStartAction: RuleActions = {
    watering: {
        action: 'watering_start',
    },
};

export const wateringStopAction: RuleActions = {
    watering: {
        action: 'watering_stop',
    },
};

export const growLightOnAction: RuleActions = {
    growLight: {
        action: 'light_on',
    },
};

export const growLightOffAction: RuleActions = {
    growLight: {
        action: 'light_off',
    },
};

export const multipleActions: RuleActions = {
    watering: {
        action: 'watering_start',
    },
    growLight: {
        action: 'light_on',
    },
};

/**
 * Complete automation rules
 */
export const mockAutomationRule = {
    id: testAutomationIds.ruleId,
    plantId: testAutomationIds.plantId,
    name: 'Auto-water when dry',
    description: 'Automatically waters plants when soil moisture drops below 30%',
    conditions: moistureLessThanCondition,
    actions: wateringStartAction,
    isEnabled: true,
    lastTriggeredAt: null,
    triggerCount: 0,
    createdAt: new Date('2025-01-20T10:00:00.000Z'),
    updatedAt: new Date('2025-01-20T10:00:00.000Z'),
};

export const mockAutomationRuleWithCooldown = {
    ...mockAutomationRule,
    lastTriggeredAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    triggerCount: 1,
};

export const mockAutomationRuleExpiredCooldown = {
    ...mockAutomationRule,
    lastTriggeredAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
    triggerCount: 1,
};

export const mockDisabledAutomationRule = {
    ...mockAutomationRule,
    id: 'rule-disabled-123',
    isEnabled: false,
};

export const mockLightingAutomationRule = {
    ...mockAutomationRule,
    id: 'rule-light-123',
    name: 'Turn on lights when dark',
    description: 'Turns on grow lights when light level drops below 500 lux',
    conditions: lightLevelLessThanCondition,
    actions: growLightOnAction,
};

export const mockTemperatureAutomationRule = {
    ...mockAutomationRule,
    id: 'rule-temp-123',
    name: 'Alert high temperature',
    description: 'Sends alert when temperature exceeds 30°C',
    conditions: temperatureGreaterThanCondition,
    actions: growLightOffAction, // Turn off light to reduce heat
};

/**
 * DTOs for CRUD operations
 */
export const validCreateAutomationRuleDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Auto-water when dry',
    description: 'Automatically waters plants when soil moisture drops below 30%',
    conditions: moistureLessThanCondition,
    actions: wateringStartAction,
};

export const minimalCreateAutomationRuleDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Simple watering rule',
    conditions: moistureLessThanCondition,
    actions: wateringStartAction,
};

export const lightingCreateRuleDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Auto-lighting',
    description: 'Turns on lights when dark',
    conditions: lightLevelLessThanCondition,
    actions: growLightOnAction,
};

export const multiConditionRuleDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Complex rule',
    description: 'Multiple conditions and actions',
    conditions: multipleConditions,
    actions: multipleActions,
};

export const validUpdateAutomationRuleDto: UpdateAutomationRuleDto = {
    name: 'Updated rule name',
    description: 'Updated description',
    isEnabled: false,
};

export const updateConditionsDto: UpdateAutomationRuleDto = {
    conditions: temperatureGreaterThanCondition,
};

export const updateActionsDto: UpdateAutomationRuleDto = {
    actions: growLightOffAction,
};

export const disableRuleDto: UpdateAutomationRuleDto = {
    isEnabled: false,
};

export const enableRuleDto: UpdateAutomationRuleDto = {
    isEnabled: true,
};

/**
 * Invalid DTOs for validation testing
 */
export const invalidNoConditionsDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid rule',
    conditions: {} as object,
    actions: wateringStartAction,
};

export const invalidNoActionsDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid rule',
    conditions: moistureLessThanCondition,
    actions: {} as object,
};

export const invalidMoistureThresholdDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid moisture',
    conditions: {
        moisture: { lessThan: 150 }, // Invalid: > 100
    },
    actions: wateringStartAction,
};

export const invalidTemperatureThresholdDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid temperature',
    conditions: {
        temperature: { greaterThan: 150 }, // Invalid: > 100
    },
    actions: wateringStartAction,
};

export const invalidHumidityThresholdDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid humidity',
    conditions: {
        humidity: { lessThan: -10 }, // Invalid: < 0
    },
    actions: wateringStartAction,
};

export const invalidLightLevelThresholdDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid light level',
    conditions: {
        lightLevel: { greaterThan: -100 }, // Invalid: < 0
    },
    actions: wateringStartAction,
};

export const invalidWateringActionDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid watering action',
    conditions: moistureLessThanCondition,
    actions: {
        watering: { action: 'invalid' as unknown as 'watering_start' | 'watering_stop' },
    },
};

export const invalidWateringDurationDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid watering duration',
    conditions: moistureLessThanCondition,
    actions: {
        watering: {
            action: 'watering_start',
        },
    },
};

export const invalidGrowLightActionDto: CreateAutomationRuleDto = {
    plantId: testAutomationIds.plantId,
    name: 'Invalid grow light action',
    conditions: lightLevelLessThanCondition,
    actions: {
        growLight: { action: 'toggle' as unknown as 'light_on' | 'light_off' },
    },
};

/**
 * Mock automation rule with plant relationship
 */
export const mockAutomationRuleWithPlant = {
    ...mockAutomationRule,
    plant: {
        name: 'Tomato Plant',
        racks: [{ id: testAutomationIds.rackId }],
    },
};

export const mockAutomationRuleWithDifferentUser = {
    ...mockAutomationRule,
    plant: {
        name: 'Other Plant',
        racks: [], // No racks owned by user
    },
};

/**
 * Collections of rules
 */
export const mockAutomationRules = [
    mockAutomationRule,
    mockLightingAutomationRule,
    mockTemperatureAutomationRule,
];

export const mockEnabledRules = mockAutomationRules.filter((rule) => rule.isEnabled);

export const mockDisabledRules = [mockDisabledAutomationRule];

/**
 * Automation event data
 */
export const mockAutomationEvent = {
    rackId: testAutomationIds.rackId,
    ruleName: mockAutomationRule.name,
    executedActions: ['watering:start for 5000ms'],
    timestamp: new Date('2025-02-01T10:00:00.000Z'),
};

export const mockLightingAutomationEvent = {
    rackId: testAutomationIds.rackId,
    ruleName: mockLightingAutomationRule.name,
    executedActions: ['growLight:on'],
    timestamp: new Date('2025-02-01T10:00:00.000Z'),
};

export const mockMultipleActionsEvent = {
    rackId: testAutomationIds.rackId,
    ruleName: 'Multi-action rule',
    executedActions: ['watering:start for 5000ms', 'growLight:on'],
    timestamp: new Date('2025-02-01T10:00:00.000Z'),
};

/**
 * MQTT command payloads
 */
export const wateringCommandPayload = {
    action: 'start',
    duration: 5000,
};

export const lightingCommandPayload = {
    action: 'on',
};

/**
 * Mock rack for automation tests (with currentPlantId)
 */
export const mockRackForAutomation = {
    id: testAutomationIds.rackId,
    userId: testAutomationIds.userId,
    name: 'Test Rack',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    currentPlantId: testAutomationIds.plantId,
    isActive: true,
    createdAt: new Date('2025-01-15T08:00:00.000Z'),
    updatedAt: new Date('2025-02-01T10:30:00.000Z'),
};

/**
 * Mock rack without current plant
 */
export const mockRackWithoutPlant = {
    ...mockRackForAutomation,
    currentPlantId: null,
};

/**
 * Mock plant for automation tests
 */
export const mockPlantForAutomation = {
    id: testAutomationIds.plantId,
    name: 'Tomato Plant',
    type: 'Vegetable',
    isActive: true,
    racks: [
        {
            id: testAutomationIds.rackId,
            userId: testAutomationIds.userId,
            isActive: true,
        },
    ],
};

/**
 * Mock plant without user's racks
 */
export const mockPlantWithoutUserRacks = {
    ...mockPlantForAutomation,
    racks: [],
};
