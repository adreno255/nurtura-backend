import { Controller, Post, Param, Query } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { Public } from '../common/decorators';

@Controller('dev/simulation')
export class SimulationController {
    constructor(private readonly simulationService: SimulationService) {}

    /**
     * POST /dev/simulation/:macAddress/normal?cycles=3
     * Runs the normal sensor scenario (no rules triggered).
     */
    @Post(':macAddress/normal')
    @Public() // No auth for dev-only endpoint
    async runNormal(
        @Param('macAddress') macAddress: string,
        @Query('cycles') cycles?: string,
    ): Promise<{ message: string }> {
        await this.simulationService.runNormalScenario(
            macAddress,
            cycles ? parseInt(cycles, 10) : 3,
        );
        return { message: 'Normal simulation started' };
    }

    /**
     * POST /dev/simulation/:macAddress/watering
     * Runs the watering trigger scenario (Phase 1 → 2 → 3).
     */
    @Post(':macAddress/watering')
    @Public() // No auth for dev-only endpoint
    runWatering(@Param('macAddress') macAddress: string): { message: string } {
        // Run in background — don't await since it takes ~10+ minutes
        void this.simulationService.runWateringScenario(macAddress);
        return { message: 'Watering simulation started in background' };
    }

    /**
     * POST /dev/simulation/:macAddress/initial
     * Sends a single sensor reading with ideal conditions to initialize the plant profile and rules.
     */
    @Post(':macAddress/initial')
    @Public() // No auth for dev-only endpoint
    sendInitialSensorData(@Param('macAddress') macAddress: string): { message: string } {
        // Run in background — don't await since it takes ~10+ minutes
        void this.simulationService.sendInitialSensorData(macAddress);
        return { message: 'Initial sensor data sent' };
    }

    /**
     * POST /dev/simulation/:macAddress/lighting
     * Runs a lighting scenario where light levels fluctuate to test grow light scheduling and rules.
     */
    @Post(':macAddress/lighting')
    @Public() // No auth for dev-only endpoint
    runLightingScenario(@Param('macAddress') macAddress: string): { message: string } {
        // Run in background — don't await since it takes ~10+ minutes
        void this.simulationService.runLightingScenario(macAddress);
        return { message: 'Lighting simulation started in background' };
    }

    /**
     * POST /dev/simulation/:macAddress/all
     * Runs all scenarios in sequence: initial sensor data → watering scenario → lighting scenario.
     */
    @Post(':macAddress/all')
    @Public() // No auth for dev-only endpoint
    runAllScenarios(@Param('macAddress') macAddress: string): { message: string } {
        // Run in background — don't await since it takes ~10+ minutes
        void this.simulationService.runAllScenarios(macAddress);
        return { message: 'All simulations started in background' };
    }
}
