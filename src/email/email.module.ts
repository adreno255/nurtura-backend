import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { MyLoggerModule } from '../my-logger/my-logger.module';

@Module({
    imports: [ConfigModule, MyLoggerModule],
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule {}
