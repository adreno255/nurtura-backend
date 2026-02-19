import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsIP, Max, Min } from 'class-validator';

/**
 * DTO for device status updates
 * Topic: nurtura/rack/{macAddress}/status
 */
export class DeviceStatusDto {
    @Expose({ name: 'o' })
    @IsBoolean()
    online: boolean;

    @Expose({ name: 'tm' })
    @IsOptional()
    @IsNumber()
    timestamp?: number;

    @Expose({ name: 'v' })
    @IsOptional()
    @IsString()
    firmwareVersion?: string;

    @Expose({ name: 'ip' })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @Expose({ name: 'mac' })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @Expose({ name: 's' })
    @IsOptional()
    @IsNumber()
    @Min(-110)
    @Max(0) // Typical WiFi dBm range
    signalStrength?: number;

    @Expose({ name: 'u' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    uptime?: number;

    @Expose({ name: 'fm' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    freeMemory?: number;
}
