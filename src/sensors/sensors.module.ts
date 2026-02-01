import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [SensorsService],
    controllers: [SensorsController],
    exports: [SensorsService],
})
export class SensorsModule {}
