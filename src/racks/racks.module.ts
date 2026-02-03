import { Module } from '@nestjs/common';
import { RacksController } from './racks.controller';
import { RacksService } from './racks.service';
import { DatabaseModule } from '../database/database.module';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [DatabaseModule, MyLoggerModule, CommonModule],
    controllers: [RacksController],
    providers: [RacksService],
    exports: [RacksService],
})
export class RacksModule {}
