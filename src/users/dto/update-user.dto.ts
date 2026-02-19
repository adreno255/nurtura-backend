import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address of the user',
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    email?: string;

    @ApiProperty({
        example: 'Juan',
        description: 'First name of the user',
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    firstName?: string;

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
    @IsOptional()
    @MaxLength(100)
    lastName?: string;

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
    @IsOptional()
    block?: string;

    @ApiProperty({
        example: 'Sampaguita Street',
        description: 'Street name',
    })
    @IsString()
    @IsOptional()
    street?: string;

    @ApiProperty({
        example: 'Barangay Commonwealth',
        description: 'Barangay name',
    })
    @IsString()
    @IsOptional()
    barangay?: string;

    @ApiProperty({
        example: 'Quezon City',
        description: 'City name',
    })
    @IsString()
    @IsOptional()
    city?: string;
}
