import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        example: 'Juan',
        description: 'First name of the user',
    })
    @IsString()
    @IsNotEmpty({ message: 'First name is required' })
    @MaxLength(100)
    firstName!: string;

    @ApiPropertyOptional({
        example: 'Santos',
        description: 'Middle name of the user',
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    middleName?: string;

    @ApiProperty({
        example: 'Dela Cruz',
        description: 'Last name of the user',
    })
    @IsString()
    @IsNotEmpty({ message: 'Last name is required' })
    @MaxLength(100)
    lastName!: string;

    @ApiPropertyOptional({
        example: 'Jr.',
        description: 'Suffix (Jr., Sr., III, etc.)',
    })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    suffix?: string;

    @ApiProperty({
        example: 'Block 5',
        description: 'Block number',
    })
    @IsString()
    @IsNotEmpty({ message: 'Block is required' })
    block!: string;

    @ApiProperty({
        example: 'Sampaguita Street',
        description: 'Street name',
    })
    @IsString()
    @IsNotEmpty({ message: 'Street is required' })
    street!: string;

    @ApiProperty({
        example: 'Barangay Commonwealth',
        description: 'Barangay name',
    })
    @IsString()
    @IsNotEmpty({ message: 'Barangay is required' })
    barangay!: string;

    @ApiProperty({
        example: 'Quezon City',
        description: 'City name',
    })
    @IsString()
    @IsNotEmpty({ message: 'City is required' })
    city!: string;
}
