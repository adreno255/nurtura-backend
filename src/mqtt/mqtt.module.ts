import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DatabaseModule } from '../database/database.module';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Module({
    imports: [DatabaseModule, WebsocketGateway],
    providers: [MqttService],
    exports: [MqttService],
})
export class MqttModule {}
