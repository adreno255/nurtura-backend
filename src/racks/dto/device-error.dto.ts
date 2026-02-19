import { Expose, Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsEnum,
    IsObject,
    ValidateNested,
    IsDefined,
} from 'class-validator';

// Define Enums for validation
export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum SensorType {
    TEMPERATURE = 'TEMPERATURE',
    HUMIDITY = 'HUMIDITY',
    MOISTURE = 'MOISTURE',
    LIGHT = 'LIGHT',
}

class ErrorDetailsDto {
    @Expose({ name: 'ac' })
    @IsOptional()
    @IsNumber()
    attemptCount?: number;

    @Expose({ name: 'lsr' })
    @IsOptional()
    @IsNumber()
    lastSuccessfulRead?: number;

    @Expose({ name: 'ed' })
    @IsOptional()
    errorData?: any;
}

/**
 * DTO for device error messages
 * Topic: nurtura/rack/{macAddress}/errors
 */

export class DeviceErrorDto {
    @Expose({ name: 'c' })
    @IsString()
    @IsDefined()
    code: string;

    @Expose({ name: 'm' })
    @IsString()
    @IsDefined()
    message: string;

    @Expose({ name: 's' })
    @IsEnum(ErrorSeverity)
    severity: ErrorSeverity;

    @Expose({ name: 'tm' })
    @IsOptional()
    @IsNumber()
    timestamp?: number;

    @Expose({ name: 'st' })
    @IsOptional()
    @IsEnum(SensorType)
    sensorType?: SensorType;

    @Expose({ name: 'd' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ErrorDetailsDto)
    details?: ErrorDetailsDto;
}
