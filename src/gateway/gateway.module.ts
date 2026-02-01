import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { SensorGateway } from './sensors.gateway';
import { SensorsModule } from '../sensors/sensors.module';

@Module({
    imports: [FirebaseModule, DatabaseModule, SensorsModule],
    providers: [SensorGateway],
    exports: [SensorGateway],
})
export class GatewayModule {}
