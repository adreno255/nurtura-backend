import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttService } from '../mqtt/mqtt.service';
import { MyLoggerService } from '../my-logger/my-logger.service';

interface SensorPayload {
    t: number; // temperature
    h: number; // humidity
    m: number; // moisture
    l: number; // lightLevel
    wu?: number; // waterUsed (mL)
    tm?: string; // timestamp
}

@Injectable()
export class SimulationService {
    constructor(
        private readonly mqttService: MqttService,
        private readonly configService: ConfigService,
        private readonly logger: MyLoggerService,
    ) {}

    private isRunning = false;

    private guardNotRunning(): void {
        if (this.isRunning) {
            throw new ConflictException(
                'A simulation is already running for this instance. Wait for it to complete before starting another.',
            );
        }
    }

    private guardDevOnly(): void {
        if (this.configService.get<string>('NODE_ENV') === 'production') {
            throw new ForbiddenException('Simulation is not available in production');
        }
    }

    async runNormalScenario(macAddress: string, cycles: number = 3): Promise<void> {
        this.guardDevOnly();
        this.guardNotRunning();

        this.logger.log(
            `[Simulation] Starting NORMAL scenario for ${macAddress} — ${cycles} cycles`,
            'SimulationService',
        );

        for (let i = 0; i < cycles; i++) {
            const payload: SensorPayload = {
                t: parseFloat((30 + Math.random() * 3).toFixed(1)), // 30–33°C
                h: parseFloat((40 + Math.random() * 2).toFixed(1)), // 40–42%
                m: parseFloat((70 + Math.random() * 10).toFixed(1)), // 70–80% (post-lighting, not below 60)
                l: parseFloat((15000 + Math.random() * 17000).toFixed(1)), // 15000–31999 lux
                tm: new Date().toISOString(),
            };

            this.logger.log(
                `[Simulation] NORMAL cycle ${i + 1}/${cycles}: ${JSON.stringify(payload)}`,
                'SimulationService',
            );

            await this.mqttService.publishSimulated(macAddress, 'sensors', payload);

            await this.delay(2 * 30 * 1000);
        }

        this.logger.log(
            `[Simulation] NORMAL scenario complete for ${macAddress}`,
            'SimulationService',
        );
    }

    async sendInitialSensorData(macAddress: string): Promise<void> {
        this.guardDevOnly();
        this.guardNotRunning();
        this.logger.log(
            `[Simulation] Sending initial sensor data for ${macAddress}`,
            'SimulationService',
        );

        const payload: SensorPayload = {
            t: parseFloat((30 + Math.random() * 3).toFixed(1)), // 30–33°C
            h: parseFloat((40 + Math.random() * 2).toFixed(1)), // 40–42%
            m: parseFloat((61.2).toFixed(1)), // 61–80%
            l: parseFloat((15000 + Math.random() * 17000).toFixed(1)), // 15000–31999 lux
            tm: new Date().toISOString(),
        };

        await this.mqttService.publishSimulated(macAddress, 'sensors', payload);
        await this.delay(1 * 30 * 1000);

        this.logger.log(
            `[Simulation] Initial sensor data sent for ${macAddress}: ${JSON.stringify(payload)}`,
            'SimulationService',
        );
    }

    async runWateringScenario(macAddress: string): Promise<void> {
        this.guardDevOnly();
        this.guardNotRunning();

        this.logger.log(
            `[Simulation] Starting WATERING scenario for ${macAddress}`,
            'SimulationService',
        );

        // Phase 1: Moisture drops below 60 — watering_start should trigger
        this.logger.log(
            '[Simulation] Phase 1: Moisture drop — watering_start trigger',
            'SimulationService',
        );

        const wateringCycles = 6; // ~30 seconds of active watering at 5 sec interval

        for (let i = 0; i < wateringCycles; i++) {
            // Moisture gradually rises during watering (simulates soil absorbing water)
            const moisture = parseFloat((58 + i * (24 / 5)).toFixed(1));

            const payload: SensorPayload = {
                t: parseFloat((30 + Math.random() * 3).toFixed(1)), // 30–33°C
                h: parseFloat((40 + Math.random() * 2).toFixed(1)), // 40–42%
                m: moisture, // unchanged
                l: parseFloat((15000 + Math.random() * 17000).toFixed(1)), // 15000–31999 lux
                wu: parseFloat((12 + Math.random() * 5).toFixed(2)),
                tm: new Date().toISOString(),
            };

            this.logger.log(
                `[Simulation] Phase 1 cycle ${i + 1}/${wateringCycles}: moisture=${moisture}%, wu=${payload.wu}mL`,
                'SimulationService',
            );

            await this.mqttService.publishSimulated(macAddress, 'sensors', payload);
            await this.delay(5 * 1000); // 5 seconds during active watering
        }

        // Phase 2: Moisture now above 80 — watering_stop should trigger
        this.logger.log(
            '[Simulation] Phase 2: Moisture recovered — watering_stop trigger',
            'SimulationService',
        );

        for (let i = 0; i < 1; i++) {
            await this.mqttService.publishSimulated(macAddress, 'sensors', {
                t: parseFloat((30 + Math.random() * 3).toFixed(1)), // 30–33°C
                h: parseFloat((40 + Math.random() * 2).toFixed(1)), // 40–42%
                m: parseFloat((82 + Math.random() * 5).toFixed(1)), // 82–87% (unchanged)
                l: parseFloat((15000 + Math.random() * 17000).toFixed(1)), // 15000–31999 lux
                tm: new Date().toISOString(),
            } satisfies SensorPayload);

            this.logger.log(`[Simulation] Phase 2 cycle ${i + 1}/1 published`, 'SimulationService');

            // Wait 30 seconds before ending simulation to allow time for rules to process the stop trigger
            await this.delay(1 * 30 * 1000);
        }

        this.logger.log(
            `[Simulation] WATERING scenario complete for ${macAddress}`,
            'SimulationService',
        );
    }

    async runLightingScenario(macAddress: string): Promise<void> {
        this.guardDevOnly();
        this.guardNotRunning();

        this.logger.log(
            `[Simulation] Starting LIGHTING scenario for ${macAddress}`,
            'SimulationService',
        );

        const cycles = 2; // Reduced to 2 cycles

        for (let i = 0; i < cycles; i++) {
            // Generates values between 32001.0 and 35000.0
            const lightLevel = parseFloat((32001 + Math.random() * 2999).toFixed(1));

            const payload: SensorPayload = {
                t: parseFloat((30 + Math.random() * 3).toFixed(1)), // 30–33°C
                h: parseFloat((40 + Math.random() * 2).toFixed(1)), // 40–42%
                m: parseFloat((82 + Math.random() * 5).toFixed(1)), // 82–87% (post-watering)
                l: lightLevel, // 32001–35000 (unchanged)
                tm: new Date().toISOString(),
            };

            await this.mqttService.publishSimulated(macAddress, 'sensors', payload);

            this.logger.log(
                `[Simulation] LIGHTING cycle ${i + 1}/${cycles}: lightLevel=${lightLevel} lux`,
                'SimulationService',
            );

            // Wait 30 seconds between readings to allow time for grow light scheduling and rules to react
            await this.delay(1 * 30 * 1000);
        }

        this.logger.log(
            `[Simulation] LIGHTING scenario complete for ${macAddress}`,
            'SimulationService',
        );
    }

    async runAllScenarios(macAddress: string): Promise<void> {
        this.logger.debug(
            `[Simulation] Starting ALL scenarios for ${macAddress}`,
            'SimulationService',
        );

        await this.sendInitialSensorData(macAddress);
        await this.runWateringScenario(macAddress);
        await this.runLightingScenario(macAddress);
        await this.runNormalScenario(macAddress, 2);

        this.logger.debug(
            `[Simulation] ALL scenarios complete for ${macAddress}`,
            'SimulationService',
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
