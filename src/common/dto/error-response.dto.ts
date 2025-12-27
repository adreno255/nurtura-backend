import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
    @ApiProperty({
        example: 400,
        description: 'HTTP status code',
    })
    statusCode!: number;

    @ApiProperty({
        example: '2025-12-27T10:30:00.000Z',
        description: 'ISO 8601 timestamp of when the error occurred',
    })
    timestamp!: string;

    @ApiProperty({
        example: '/api/auth/otp/verify',
        description: 'API endpoint path where the error occurred',
    })
    path!: string;

    @ApiProperty({
        example: 'Invalid OTP code. Please check and try again.',
        description: 'Human-readable error message',
    })
    message!: string;
}
