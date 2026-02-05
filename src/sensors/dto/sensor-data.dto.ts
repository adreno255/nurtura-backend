import { Expose } from 'class-transformer';
import { IsNumber, Min, Max, IsOptional } from 'class-validator';

/**
 * DTO for sensor data received from ESP32 devices
 * Topic: nurtura/rack/{macAddress}/sensors
 */
export class SensorDataDto {
    @Expose({ name: 't' })
    @IsNumber()
    @Min(-10)
    @Max(60)
    temperature: number;

    @Expose({ name: 'h' })
    @IsNumber()
    @Min(0)
    @Max(100)
    humidity: number;

    @Expose({ name: 'm' })
    @IsNumber()
    @Min(0)
    @Max(100)
    moisture: number;

    @Expose({ name: 'l' })
    @IsNumber()
    @Min(0)
    lightLevel: number;

    @Expose({ name: 'wu' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    waterUsed: number;

    @Expose({ name: 'tm' })
    @IsOptional()
    @IsNumber()
    timestamp?: number;
}
