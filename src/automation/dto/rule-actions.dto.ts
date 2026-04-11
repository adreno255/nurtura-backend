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
        description: 'Type of event that triggered the automation',
        example: 'WATERING_START',
    })
    @IsNotEmpty()
    @IsString()
    eventType?: string;

    @ApiProperty({
        description: 'Activity record containing event details and context',
        example: {
            id: 'activity-123',
            rackId: 'clx789xyz123',
            eventType: 'WATERING_START',
            timestamp: '2025-02-05T14:45:00.000Z',
        },
    })
    @IsObject()
    activity?: object;
}
