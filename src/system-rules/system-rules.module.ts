import { Module } from '@nestjs/common';
import { SystemRulesService } from './system-rules.service';
import { AutomationModule } from '../automation/automation.module';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule, AutomationModule],
    providers: [SystemRulesService],
    exports: [SystemRulesService],
})
export class SystemRulesModule {}
