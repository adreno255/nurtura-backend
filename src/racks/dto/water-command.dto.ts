import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WaterCommandDto {
    @ApiPropertyOptional({
        example: 5000,
        description: 'Duration in milliseconds (default: 5000ms / 5 seconds)',
        minimum: 1000,
        maximum: 60000,
        default: 5000,
    })
    @IsInt()
    @IsOptional()
    @Min(1000, { message: 'Duration must be at least 1000ms (1 second)' })
    @Max(60000, { message: 'Duration must not exceed 60000ms (60 seconds)' })
    duration?: number = 5000;
}
