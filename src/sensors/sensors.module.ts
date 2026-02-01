import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule, MyLoggerModule, CommonModule],
    providers: [SensorsService],
    controllers: [SensorsController],
    exports: [SensorsService],
})
export class SensorsModule {}
