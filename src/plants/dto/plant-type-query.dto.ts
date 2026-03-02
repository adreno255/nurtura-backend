import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PlantType } from '../../generated/prisma';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PlantTypeQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        enum: PlantType,
        example: PlantType.HERBS,
        description: 'Filter plants by type',
    })
    @IsOptional()
    @IsEnum(PlantType)
    type?: PlantType;

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
