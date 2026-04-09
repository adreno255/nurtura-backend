import { Expose } from 'class-transformer';
import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

/**
 * DTO for sensor data received from ESP32 devices
 * Topic: nurtura/rack/{macAddress}/sensors
 */
export class SensorDataDto {
    @Expose({ name: 't' })
    @IsNumber()
    @Min(-10 * 60, { message: 'Temperature is too low (min -10°C)' })
    @Max(60, { message: 'Temperature is too high (max 60°C)' })
    temperature!: number;

    @Expose({ name: 'h' })
    @IsNumber()
    @Min(0, { message: 'Humidity is too low (min 0%)' })
    @Max(100, { message: 'Humidity is too high (max 100%)' })
    humidity!: number;

    @Expose({ name: 'm' })
    @IsNumber()
    @Min(0, { message: 'Moisture is too low (min 0%)' })
    @Max(100, { message: 'Moisture is too high (max 100%)' })
    moisture!: number;

    @Expose({ name: 'l' })
    @IsNumber()
    @Min(0, { message: 'Light level is too low (min 0)' })
    lightLevel!: number;

    @Expose({ name: 'wu' })
    @IsOptional()
    @IsNumber()
    @Min(0, { message: 'Water used is too low (min 0 ml)' })
    waterUsed?: number;

    @Expose({ name: 'tm' })
    @IsOptional()
    @IsString()
    timestamp?: string;
}
