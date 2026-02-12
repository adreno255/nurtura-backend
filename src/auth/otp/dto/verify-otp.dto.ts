import { IsEmail, IsString, IsIn, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address associated with the OTP',
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

    @ApiProperty({
        example: 'registration',
        description: 'Purpose of the OTP verification',
        enum: ['registration', 'forgot-password'],
    })
    @IsString()
    @IsIn(['registration', 'forgot-password'], {
        message: 'Purpose must be either "registration" or "forgot-password"',
    })
    purpose!: 'registration' | 'forgot-password' | 'email-reset';
}
