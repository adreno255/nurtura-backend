import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { SensorsModule } from '../sensors/sensors.module';
import { RacksModule } from '../racks/racks.module';

@Module({
    imports: [FirebaseModule, SensorsModule, RacksModule],
    providers: [WebsocketGateway, WebsocketService],
    exports: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
