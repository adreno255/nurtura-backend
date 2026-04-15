import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
    imports: [MqttModule],
    controllers: [SimulationController],
    providers: [SimulationService],
})
export class SimulationModule {}
