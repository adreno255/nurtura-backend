import { IsOptional, IsDateString, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ActivityQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Filter activities from this date (ISO 8601)',
        example: '2025-09-29T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'Filter activities up to this date (ISO 8601)',
        example: '2025-10-02T23:59:59.999Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]) as string[])
    rackId?: string[];
}
