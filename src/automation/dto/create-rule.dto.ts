import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsObject,
    ValidateNested,
    IsNumber,
    Min,
} from 'class-validator';
import { RuleActionsDto } from './rule-actions.dto';
import { RuleConditionsDto } from './rule-conditions.dto';

export class CreateAutomationRuleDto {
    @ApiProperty({
        description: 'Plant ID to associate the rule with',
        example: 'clx123abc456',
    })
    @IsNotEmpty()
    @IsString()
    plantId!: string;

    @ApiProperty({
        description: 'Rule name',
        example: 'Auto-water when dry',
        maxLength: 200,
    })
    @IsNotEmpty()
    @IsString()
    name!: string;

    @ApiPropertyOptional({
        description: 'Rule description',
        example: 'Automatically waters plants when soil moisture drops below 30%',
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Rule conditions (at least one must be specified)',
        type: RuleConditionsDto,
    })
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => RuleConditionsDto)
    conditions!: RuleConditionsDto;

    @ApiProperty({
        description: 'Rule actions (at least one must be specified)',
        type: RuleActionsDto,
    })
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => RuleActionsDto)
    actions!: RuleActionsDto;

    @ApiPropertyOptional({
        description: 'Cooldown period in minutes before rule can trigger again',
        example: 30,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cooldownMinutes?: number;
}
