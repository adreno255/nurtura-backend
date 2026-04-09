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

export enum ErrorCode {
    // Sensor Errors
    SENSOR_FAILURE = 'SENSOR_FAILURE',
    SENSOR_TIMEOUT = 'SENSOR_TIMEOUT',
    SENSOR_NOT_FOUND = 'SENSOR_NOT_FOUND',
    SENSOR_OUT_OF_RANGE = 'SENSOR_OUT_OF_RANGE',

    // Water Pump Errors
    PUMP_FAILURE = 'PUMP_FAILURE',
    PUMP_TIMEOUT = 'PUMP_TIMEOUT',
    PUMP_NO_WATER = 'PUMP_NO_WATER',
    PUMP_FALSE_START = 'PUMP_FALSE_START',

    // Grow Light Errors
    LIGHT_FAILURE = 'LIGHT_FAILURE',

    // Unknown
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Define Enums for validation
export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum HardwareType {
    TEMPERATURE = 'TEMPERATURE',
    HUMIDITY = 'HUMIDITY',
    MOISTURE = 'MOISTURE',
    LIGHT = 'LIGHT',
    GROW_LIGHT = 'GROW_LIGHT',
    WATER_PUMP = 'WATER_PUMP',
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
    @IsEnum(ErrorCode)
    @IsDefined()
    code!: ErrorCode;

    @Expose({ name: 'm' })
    @IsString()
    @IsDefined()
    message!: string;

    @Expose({ name: 's' })
    @IsEnum(ErrorSeverity)
    severity!: ErrorSeverity;

    @Expose({ name: 'tm' })
    @IsOptional()
    @IsString()
    timestamp?: string;

    @Expose({ name: 'ht' })
    @IsOptional()
    @IsEnum(HardwareType)
    hardwareType?: HardwareType;

    @Expose({ name: 'd' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ErrorDetailsDto)
    details?: ErrorDetailsDto;
}
