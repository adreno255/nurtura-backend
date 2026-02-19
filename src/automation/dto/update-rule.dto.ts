import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsOptional,
    IsString,
    IsObject,
    ValidateNested,
    IsNumber,
    Min,
    IsBoolean,
} from 'class-validator';
import { RuleActionsDto } from './rule-actions.dto';
import { RuleConditionsDto } from './rule-conditions.dto';

export class UpdateAutomationRuleDto {
    @ApiPropertyOptional({
        description: 'Rule name',
        example: 'Updated rule name',
        maxLength: 200,
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'Rule description',
        example: 'Updated description',
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        description: 'Rule conditions',
        type: RuleConditionsDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => RuleConditionsDto)
    conditions?: RuleConditionsDto;

    @ApiPropertyOptional({
        description: 'Rule actions',
        type: RuleActionsDto,
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => RuleActionsDto)
    actions?: RuleActionsDto;

    @ApiPropertyOptional({
        description: 'Cooldown period in minutes',
        example: 30,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cooldownMinutes?: number;

    @ApiPropertyOptional({
        description: 'Enable or disable the rule',
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;
}
