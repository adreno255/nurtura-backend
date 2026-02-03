import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { SensorsModule } from '../sensors/sensors.module';

@Module({
    imports: [MyLoggerModule, FirebaseModule, SensorsModule],
    providers: [WebsocketGateway, WebsocketService],
    exports: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
