import { Module } from '@nestjs/common';
import { PlantsService } from './plants.service';
import { PlantsController } from './plants.controller';
import { DatabaseModule } from '../database/database.module';
import { RacksModule } from '../racks/racks.module';

@Module({
    imports: [DatabaseModule, RacksModule],
    controllers: [PlantsController],
    providers: [PlantsService],
    exports: [PlantsService],
})
export class PlantsModule {}
