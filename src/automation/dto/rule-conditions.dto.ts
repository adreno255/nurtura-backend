import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsNumber, Min, Max, IsObject, ValidateNested } from 'class-validator';

class MoistureConditionDto {
    @ApiPropertyOptional({
        description: 'Trigger when moisture is less than this value',
        example: 30,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    lessThan?: number;

    @ApiPropertyOptional({
        description: 'Trigger when moisture is greater than this value',
        example: 70,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    greaterThan?: number;
}

class TemperatureConditionDto {
    @ApiPropertyOptional({
        description: 'Trigger when temperature is less than this value (°C)',
        example: 15,
        minimum: -50,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(-50)
    @Max(100)
    lessThan?: number;

    @ApiPropertyOptional({
        description: 'Trigger when temperature is greater than this value (°C)',
        example: 35,
        minimum: -50,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(-50)
    @Max(100)
    greaterThan?: number;
}

class HumidityConditionDto {
    @ApiPropertyOptional({
        description: 'Trigger when humidity is less than this value (%)',
        example: 40,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    lessThan?: number;

    @ApiPropertyOptional({
        description: 'Trigger when humidity is greater than this value (%)',
        example: 80,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    greaterThan?: number;
}

class LightLevelConditionDto {
    @ApiPropertyOptional({
        description: 'Trigger when light level is less than this value (lux)',
        example: 500,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lessThan?: number;

    @ApiPropertyOptional({
        description: 'Trigger when light level is greater than this value (lux)',
        example: 1000,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    greaterThan?: number;
}

export class RuleConditionsDto {
    @ApiPropertyOptional({
        description: 'Soil moisture conditions',
        type: MoistureConditionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => MoistureConditionDto)
    moisture?: MoistureConditionDto;

    @ApiPropertyOptional({
        description: 'Temperature conditions',
        type: TemperatureConditionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => TemperatureConditionDto)
    temperature?: TemperatureConditionDto;

    @ApiPropertyOptional({
        description: 'Humidity conditions',
        type: HumidityConditionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => HumidityConditionDto)
    humidity?: HumidityConditionDto;

    @ApiPropertyOptional({
        description: 'Light level conditions',
        type: LightLevelConditionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => LightLevelConditionDto)
    lightLevel?: LightLevelConditionDto;
}
