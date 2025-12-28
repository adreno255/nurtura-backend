import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address of the user',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email!: string;

    @ApiProperty({
        example: 'NewSecurePass123!',
        description: 'New password for the user (minimum 8 characters)',
        minLength: 8,
    })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    newPassword!: string;
}
