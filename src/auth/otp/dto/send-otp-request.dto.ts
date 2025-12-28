import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpRequestDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email address to send OTP to',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email!: string;
}
