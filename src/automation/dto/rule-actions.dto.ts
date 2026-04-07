import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsObject,
    ValidateNested,
    IsString,
    IsArray,
    IsDate,
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
        description: 'Rack ID associated with the event',
        example: 'clx123abc456',
    })
    @IsNotEmpty()
    @IsString()
    rackId!: string;

    @ApiProperty({
        description: 'Name of the rule that triggered the event',
        example: 'Auto-water when dry',
    })
    @IsNotEmpty()
    @IsString()
    ruleName!: string;

    @ApiProperty({
        description: 'Array of actions that were executed as part of the automation',
        example: ['watering: start for 5000ms', 'growLight: on'],
    })
    @IsArray()
    @IsNotEmpty({ each: true })
    @IsString({ each: true })
    executedActions!: string[];

    @ApiProperty({
        description: 'Event timestamp',
        example: '2024-06-01T12:00:00Z',
    })
    @IsNotEmpty()
    @IsDate()
    timestamp!: Date;
}
