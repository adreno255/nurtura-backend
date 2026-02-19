import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsNumber,
    Min,
    Max,
    IsObject,
    ValidateNested,
    IsString,
    IsArray,
    IsDate,
} from 'class-validator';

export class WateringActionDto {
    @ApiProperty({
        description: 'Watering action',
        enum: ['start', 'stop'],
        example: 'start',
    })
    @IsNotEmpty()
    @IsEnum(['start', 'stop'])
    action!: 'start' | 'stop';

    @ApiPropertyOptional({
        description: 'Watering duration in milliseconds (required for "start" action)',
        example: 5000,
        minimum: 1000,
        maximum: 60000,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    duration?: number;
}

export class GrowLightActionDto {
    @ApiProperty({
        description: 'Grow light action',
        enum: ['on', 'off'],
        example: 'on',
    })
    @IsNotEmpty()
    @IsEnum(['on', 'off'])
    action!: 'on' | 'off';
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
