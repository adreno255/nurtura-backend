import { Expose, Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsObject,
    ValidateNested,
    IsDefined,
    IsIn,
    IsEnum,
} from 'class-validator';

export enum ErrorCode {
    SENSOR_FAILURE = 'SENSOR_FAILURE',
    SENSOR_TIMEOUT = 'SENSOR_TIMEOUT',
    SENSOR_NOT_FOUND = 'SENSOR_NOT_FOUND',
    SENSOR_OUT_OF_RANGE = 'SENSOR_OUT_OF_RANGE',
    PUMP_FAILURE = 'PUMP_FAILURE',
    PUMP_TIMEOUT = 'PUMP_TIMEOUT',
    PUMP_NO_WATER = 'PUMP_NO_WATER',
    PUMP_FALSE_START = 'PUMP_FALSE_START',
    LIGHT_FAILURE = 'LIGHT_FAILURE',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum RecoveryCode {
    SENSOR_RECOVERED = 'SENSOR_RECOVERED',
    PUMP_RECOVERED = 'PUMP_RECOVERED',
    LIGHT_RECOVERED = 'LIGHT_RECOVERED',
    UNKNOWN_RECOVERY = 'UNKNOWN_RECOVERY',
}

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

// Combined valid values for runtime validation
const AllDeviceCodes = [...Object.values(ErrorCode), ...Object.values(RecoveryCode)];

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

export class DeviceErrorDto {
    @Expose({ name: 'c' })
    @IsDefined()
    @IsIn(AllDeviceCodes) // ← correctly validates against both enums
    code!: ErrorCode | RecoveryCode;

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
