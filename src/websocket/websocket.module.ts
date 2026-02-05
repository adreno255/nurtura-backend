import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { SensorsModule } from '../sensors/sensors.module';
import { RacksModule } from '../racks/racks.module';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule, FirebaseModule, SensorsModule, RacksModule],
    providers: [WebsocketGateway, WebsocketService],
    exports: [WebsocketService],
})
export class WebsocketModule {}
