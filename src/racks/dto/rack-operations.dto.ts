import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';

export class AssignPlantToRackDto {
    @ApiProperty({ example: 'clx000plant123', description: 'ID of the plant to assign' })
    @IsString()
    @IsNotEmpty()
    plantId!: string;

    @ApiProperty({ example: 10, description: 'Number of seedlings/plants to place in the rack' })
    @IsInt()
    @Min(1)
    quantity!: number;

    @ApiPropertyOptional({
        example: '2026-02-26T08:00:00.000Z',
        description: 'Date planted (defaults to now)',
    })
    @IsOptional()
    @IsDateString()
    plantedAt?: string;
}

export class HarvestFromRackDto {
    @ApiProperty({ example: 'clx000plant123', description: 'ID of the plant to harvest' })
    @IsString()
    @IsNotEmpty()
    plantId!: string;
}

export class UnassignFromRackDto {
    @ApiProperty({ example: 'clx000plant123', description: 'ID of the plant to unassign' })
    @IsString()
    @IsNotEmpty()
    plantId!: string;
}
