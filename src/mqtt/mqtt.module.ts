import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DatabaseModule } from '../database/database.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
    imports: [DatabaseModule, WebsocketModule],
    providers: [MqttService],
    exports: [MqttService],
})
export class MqttModule {}
