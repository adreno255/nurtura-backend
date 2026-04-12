import { Test, type TestingModule } from '@nestjs/testing';
import { SystemRulesService } from './system-rules.service';
import { AutomationService } from '../automation/automation.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '../generated/prisma/client';
import {
    createMockAutomationService,
    createMockLogger,
    createMockEventEmitter,
    createMockDatabaseService,
} from '../../test/mocks';
import { systemRulesMockRack } from '../../test/fixtures/racks.fixtures';
import {
    safeSensorData,
    criticalMoistureSensorData,
    systemHighTempSensorData,
    excessLightSensorData,
} from '../../test/fixtures/sensors.fixtures';

// ─────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────

describe('SystemRulesService', () => {
    let service: SystemRulesService;
    let mockAutomationService: ReturnType<typeof createMockAutomationService>;
    let mockDatabaseService: ReturnType<typeof createMockDatabaseService>;
    let mockLoggerService: ReturnType<typeof createMockLogger>;
    let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockAutomationService = createMockAutomationService();
        mockDatabaseService = createMockDatabaseService();
        mockLoggerService = createMockLogger();
        mockEventEmitter = createMockEventEmitter();

        // Default: plant has no max light threshold
        mockDatabaseService.plant.findUnique.mockResolvedValue({ maxLightLevel: null });

        // Default: applySystemLightAction resolves with no error
        mockAutomationService.applySystemLightAction = jest.fn().mockResolvedValue(undefined);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SystemRulesService,
                { provide: AutomationService, useValue: mockAutomationService },
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<SystemRulesService>(SystemRulesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // evaluate (orchestration)
    // ─────────────────────────────────────────────

    describe('evaluate', () => {
        it('should run light priority evaluation and temperature check', async () => {
            await service.evaluate(systemRulesMockRack, safeSensorData);

            // Both sub-evaluations ran: light action was applied, no error notification emitted
            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledTimes(1);
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should emit a high-temperature notification when temperature is above threshold', async () => {
            await service.evaluate(systemRulesMockRack, systemHighTempSensorData);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({ type: NotificationType.ERROR }),
            );
        });
    });

    // ─────────────────────────────────────────────
    // evaluateLightPriority — Priority 1: critical moisture
    // ─────────────────────────────────────────────

    describe('evaluateLightPriority — P1: critical moisture override', () => {
        it('should force light_off when moisture is below 20', async () => {
            await service.evaluate(systemRulesMockRack, criticalMoistureSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:moisture_override',
            );
        });

        it('should return early after P1 — P2 and P3 are skipped', async () => {
            await service.evaluate(systemRulesMockRack, criticalMoistureSensorData);

            // applySystemLightAction called exactly once (P1), not again for P3
            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledTimes(1);
            // Plant DB query should not be reached
            expect(mockDatabaseService.plant.findUnique).not.toHaveBeenCalled();
        });

        it('should log the P1 action', async () => {
            await service.evaluate(systemRulesMockRack, criticalMoistureSensorData);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('[P1]'),
                'SystemRulesService',
            );
        });

        it('should NOT trigger P1 when moisture is exactly 20 (boundary)', async () => {
            await service.evaluate(systemRulesMockRack, { ...safeSensorData, moisture: 20 });

            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:moisture_override',
            );
        });
    });

    // ─────────────────────────────────────────────
    // evaluateLightPriority — Priority 2: excess light override
    // ─────────────────────────────────────────────

    describe('evaluateLightPriority — P2: excess light override', () => {
        beforeEach(() => {
            // Plant has a max light threshold of 800 lux
            mockDatabaseService.plant.findUnique.mockResolvedValue({ maxLightLevel: 800 });
        });

        it('should force light_off when lightLevel exceeds plant maxLightLevel', async () => {
            await service.evaluate(systemRulesMockRack, excessLightSensorData); // lightLevel: 900

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:excess_light',
            );
        });

        it('should return early after P2 — P3 schedule is skipped', async () => {
            await service.evaluate(systemRulesMockRack, excessLightSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledTimes(1);
        });

        it('should log the P2 action', async () => {
            await service.evaluate(systemRulesMockRack, excessLightSensorData);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('[P2]'),
                'SystemRulesService',
            );
        });

        it('should NOT trigger P2 when lightLevel equals maxLightLevel (boundary)', async () => {
            await service.evaluate(systemRulesMockRack, { ...safeSensorData, lightLevel: 800 });

            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:excess_light',
            );
        });

        it('should skip P2 when plant has no maxLightLevel', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({ maxLightLevel: null });

            await service.evaluate(systemRulesMockRack, excessLightSensorData);

            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:excess_light',
            );
        });

        it('should skip P2 when plant is not found in DB', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue(null);

            await service.evaluate(systemRulesMockRack, excessLightSensorData);

            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:excess_light',
            );
        });

        it('should skip P2 entirely when rack has no currentPlantId', async () => {
            const rackWithoutPlant = { ...systemRulesMockRack, currentPlantId: null };

            await service.evaluate(rackWithoutPlant, excessLightSensorData);

            expect(mockDatabaseService.plant.findUnique).not.toHaveBeenCalled();
            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                expect.anything(),
                'light_off',
                'system:excess_light',
            );
        });
    });

    // ─────────────────────────────────────────────
    // evaluateLightPriority — Priority 3: schedule-based
    // ─────────────────────────────────────────────

    describe('evaluateLightPriority — P3: schedule-based', () => {
        it('should apply light_on during the light-on window (hour >= 8 and hour < 23)', async () => {
            jest.spyOn(global, 'Date').mockImplementation(
                () => ({ getHours: () => 10 }) as unknown as Date,
            );

            await service.evaluate(systemRulesMockRack, safeSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_on',
                'system:schedule',
            );
        });

        it('should apply light_off before the light-on window (hour < 8)', async () => {
            jest.spyOn(global, 'Date').mockImplementation(
                () => ({ getHours: () => 6 }) as unknown as Date,
            );

            await service.evaluate(systemRulesMockRack, safeSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:schedule',
            );
        });

        it('should apply light_on at exactly hour 8 (lower boundary)', async () => {
            jest.spyOn(global, 'Date').mockImplementation(
                () => ({ getHours: () => 8 }) as unknown as Date,
            );

            await service.evaluate(systemRulesMockRack, safeSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_on',
                'system:schedule',
            );
        });

        it('should apply light_off at exactly hour 23 (upper boundary)', async () => {
            jest.spyOn(global, 'Date').mockImplementation(
                () => ({ getHours: () => 23 }) as unknown as Date,
            );

            await service.evaluate(systemRulesMockRack, safeSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:schedule',
            );
        });

        it('should log the P3 schedule action', async () => {
            jest.spyOn(global, 'Date').mockImplementation(
                () => ({ getHours: () => 10 }) as unknown as Date,
            );

            await service.evaluate(systemRulesMockRack, safeSensorData);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('[P3]'),
                'SystemRulesService',
            );
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });
    });

    // ─────────────────────────────────────────────
    // evaluateHighTemperature
    // ─────────────────────────────────────────────

    describe('evaluateHighTemperature', () => {
        it('should emit createNotification when temperature exceeds 37°C', async () => {
            await service.evaluate(systemRulesMockRack, systemHighTempSensorData); // temperature: 38

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    userId: systemRulesMockRack.userId,
                    rackId: systemRulesMockRack.id,
                    type: NotificationType.ERROR,
                    title: 'High Temperature Detected',
                }),
            );
        });

        it('should include temperature and rack metadata in the notification', async () => {
            await service.evaluate(systemRulesMockRack, systemHighTempSensorData);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        temperature: systemHighTempSensorData.temperature,
                        rackName: systemRulesMockRack.name,
                        macAddress: systemRulesMockRack.macAddress,
                    }) as object,
                }),
            );
        });

        it('should NOT emit a notification when temperature is exactly 37°C (boundary)', async () => {
            await service.evaluate(systemRulesMockRack, { ...safeSensorData, temperature: 37 });
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should NOT emit a notification when temperature is below 37°C', async () => {
            await service.evaluate(systemRulesMockRack, safeSensorData); // temperature: 25
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should log a warning when high temperature is detected', async () => {
            await service.evaluate(systemRulesMockRack, systemHighTempSensorData);

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('High temperature'),
                'SystemRulesService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // priority interaction
    // ─────────────────────────────────────────────

    describe('priority interaction', () => {
        it('should apply P1 even when temperature is also high', async () => {
            const combinedData = { ...criticalMoistureSensorData, temperature: 38 };

            await service.evaluate(systemRulesMockRack, combinedData);

            // Light action is the P1 moisture override
            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:moisture_override',
            );
            // Temperature notification still fires (independent evaluation)
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({ type: NotificationType.ERROR }),
            );
        });

        it('should apply P2 over P3 when excess light is detected', async () => {
            mockDatabaseService.plant.findUnique.mockResolvedValue({ maxLightLevel: 800 });

            await service.evaluate(systemRulesMockRack, excessLightSensorData);

            expect(mockAutomationService.applySystemLightAction).toHaveBeenCalledWith(
                systemRulesMockRack,
                'light_off',
                'system:excess_light',
            );
            expect(mockAutomationService.applySystemLightAction).not.toHaveBeenCalledWith(
                systemRulesMockRack,
                expect.any(String),
                'system:schedule',
            );
        });
    });
});
