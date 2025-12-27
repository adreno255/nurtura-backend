import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendForgotPasswordOtpDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address to send password reset OTP to',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email!: string;

    @ApiProperty({
        example: '12345',
        description: '5-digit OTP code',
        minLength: 5,
        maxLength: 5,
    })
    @IsString()
    @Length(5, 5, { message: 'OTP code must be exactly 5 digits' })
    code!: string;
}
