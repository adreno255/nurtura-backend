import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { DatabaseModule } from '../database/database.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
    imports: [ConfigModule, MyLoggerModule, DatabaseModule, GatewayModule],
    providers: [MqttService],
    exports: [MqttService],
})
export class MqttModule {}
