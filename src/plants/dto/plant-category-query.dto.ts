import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PlantCategory } from '../../generated/prisma';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PlantCategoryQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        enum: PlantCategory,
        example: PlantCategory.HERBS,
        description: 'Filter plants by category',
    })
    @IsOptional()
    @IsEnum(PlantCategory)
    category?: PlantCategory;

    @ApiPropertyOptional({ example: true, description: 'Filter by active status' })
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'boolean') return value;

        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;

        return undefined;
    })
    @IsBoolean()
    isActive?: boolean;
}
