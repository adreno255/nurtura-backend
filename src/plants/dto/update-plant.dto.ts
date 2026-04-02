import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, IsBoolean } from 'class-validator';
import { PlantCategory, SoilType } from '../../generated/prisma';

export class UpdatePlantDto {
    @ApiPropertyOptional({ example: 'Basil', maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ enum: PlantCategory, example: PlantCategory.HERBS })
    @IsOptional()
    @IsEnum(PlantCategory)
    category?: PlantCategory;

    @ApiPropertyOptional({ enum: SoilType, example: SoilType.PEATY })
    @IsOptional()
    @IsEnum(SoilType)
    recommendedSoil?: SoilType;

    @ApiPropertyOptional({ example: 'An aromatic herb used in Italian cuisine.', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
