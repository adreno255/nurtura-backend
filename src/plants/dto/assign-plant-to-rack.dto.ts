import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';

export class AssignPlantToRackDto {
    @ApiProperty({ example: 'clx1abc123', description: 'ID of the rack to assign the plant to' })
    @IsString()
    @IsNotEmpty()
    rackId!: string;

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
