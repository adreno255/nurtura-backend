import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { DatabaseModule } from '../database/database.module';
import { RacksModule } from '../racks/racks.module';
import { AutomationModule } from '../automation/automation.module';
import { SystemRulesModule } from '../system-rules/system-rules.module';

@Module({
    imports: [DatabaseModule, RacksModule, AutomationModule, SystemRulesModule],
    controllers: [SensorsController],
    providers: [SensorsService],
    exports: [SensorsService],
})
export class SensorsModule {}
