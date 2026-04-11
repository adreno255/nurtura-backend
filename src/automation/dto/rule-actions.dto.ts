import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsObject,
    ValidateNested,
    IsString,
} from 'class-validator';

export class WateringActionDto {
    @ApiProperty({
        description: 'Watering action',
        enum: ['watering_start', 'watering_stop'],
        example: 'watering_start',
    })
    @IsNotEmpty()
    @IsEnum(['watering_start', 'watering_stop'])
    action!: 'watering_start' | 'watering_stop';
}

export class GrowLightActionDto {
    @ApiProperty({
        description: 'Grow light action',
        enum: ['light_on', 'light_off'],
        example: 'light_on',
    })
    @IsNotEmpty()
    @IsEnum(['light_on', 'light_off'])
    action!: 'light_on' | 'light_off';
}

export class SensorActionDto {
    @ApiProperty({
        description: 'Sensor action',
        enum: ['sensor_start', 'sensor_stop'],
        example: 'sensor_start',
    })
    @IsNotEmpty()
    @IsEnum(['sensor_start', 'sensor_stop'])
    action!: 'sensor_start' | 'sensor_stop';
}

export class RuleActionsDto {
    @ApiPropertyOptional({
        description: 'Watering action configuration',
        type: WateringActionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => WateringActionDto)
    watering?: WateringActionDto;

    @ApiPropertyOptional({
        description: 'Grow light action configuration',
        type: GrowLightActionDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => GrowLightActionDto)
    growLight?: GrowLightActionDto;
}

export class AutomatedEventDto {
    @ApiProperty({
        description: 'Event that triggered the automation',
        example: 'WATERING_START',
    })
    @IsNotEmpty()
    @IsString()
    event?: string;

    @ApiProperty({
        description: 'Metadata associated with the automated event',
        example: {
            rackName: 'Rack 1',
            ruleId: '123e4567-e89b-12d3-a456-426614174000',
        },
    })
    @IsObject()
    metadata?: object;
}
