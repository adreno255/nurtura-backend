import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for watering command
 * Topic: nurtura/rack/{macAddress}/commands/watering
 */
export class WateringCommandDto {
    @ApiProperty({
        description: 'Action to perform',
        example: 'start',
    })
    @IsString()
    action!: 'start' | 'stop';

    @ApiPropertyOptional({
        example: 5000,
        description: 'Duration in milliseconds (default: 5000ms / 5 seconds)',
        minimum: 1000,
        maximum: 60000,
        default: 5000,
    })
    @IsNumber()
    @IsOptional()
    @Min(1000, { message: 'Duration must be at least 1000ms (1 second)' })
    @Max(60000, { message: 'Duration must not exceed 60000ms (60 seconds)' })
    duration?: number = 5000;
}
