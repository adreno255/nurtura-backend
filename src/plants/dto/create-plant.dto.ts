import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { PlantCategory, SoilType } from '../../generated/prisma';

export class CreatePlantDto {
    @ApiProperty({ example: 'Lettuce', maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional({ enum: PlantCategory, example: PlantCategory.LEAFY_GREENS })
    @IsOptional()
    @IsEnum(PlantCategory)
    category?: PlantCategory;

    @ApiPropertyOptional({ enum: SoilType, example: SoilType.LOAMY })
    @IsOptional()
    @IsEnum(SoilType)
    recommendedSoil?: SoilType;

    @ApiPropertyOptional({ example: 'A crispy leafy green perfect for salads.', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;
}
