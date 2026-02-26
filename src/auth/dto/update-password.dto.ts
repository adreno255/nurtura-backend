import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
    @ApiProperty({
        example: 'NewSecurePass123!',
        description: 'New password for the user (minimum 8 characters)',
        minLength: 8,
    })
    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one symbol',
    })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    newPassword!: string;
}
