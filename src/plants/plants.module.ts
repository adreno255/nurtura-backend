import { Module } from '@nestjs/common';
import { PlantsService } from './plants.service';
import { PlantsController } from './plants.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [PlantsController],
    providers: [PlantsService],
    exports: [PlantsService],
})
export class PlantsModule {}
