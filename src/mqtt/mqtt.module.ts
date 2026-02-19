import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { SensorsModule } from '../sensors/sensors.module';
import { RacksModule } from '../racks/racks.module';

@Module({
    imports: [SensorsModule, RacksModule],
    providers: [MqttService],
    exports: [MqttService],
})
export class MqttModule {}
