import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { DatabaseModule } from '../database/database.module';
import { RacksModule } from '../racks/racks.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
    imports: [DatabaseModule, RacksModule, AutomationModule],
    controllers: [SensorsController],
    providers: [SensorsService],
    exports: [SensorsService],
})
export class SensorsModule {}
