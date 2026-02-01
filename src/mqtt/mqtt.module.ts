import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DatabaseModule } from '../database/database.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
    imports: [DatabaseModule, GatewayModule],
    providers: [MqttService],
    exports: [MqttService],
})
export class MqttModule {}
