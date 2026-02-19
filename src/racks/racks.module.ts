import { Module } from '@nestjs/common';
import { RacksController } from './racks.controller';
import { RacksService } from './racks.service';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [RacksController],
    providers: [RacksService],
    exports: [RacksService],
})
export class RacksModule {}
