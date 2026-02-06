import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [AutomationController],
    providers: [AutomationService],
    exports: [AutomationService],
})
export class AutomationModule {}
