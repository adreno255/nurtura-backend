import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBadRequestResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { SendOtpRequestDto } from './dto/send-otp-request.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@Public()
@ApiTags('Authentication - OTP')
@Controller('auth/otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) {}

    @Post('registration')
    @Throttle({ default: { limit: process.env.NODE_ENV === 'test' ? 15 : 3, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send registration OTP',
        description:
            'Sends a 5-digit OTP code to the provided email for account registration verification',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Registration OTP sent successfully. Please check your email.',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/registration' },
                message: {
                    type: 'string',
                    example: 'Invalid email format',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to send OTP email',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/registration' },
                message: { type: 'string', example: 'Failed to send registration OTP email' },
            },
        },
    })
    async sendRegistrationOtp(@Body() dto: SendOtpRequestDto) {
        await this.otpService.sendRegistrationOtp(dto);
        return {
            message: 'Registration OTP sent successfully. Please check your email.',
        };
    }

    @Post('forgot-password')
    @Throttle({ default: { limit: process.env.NODE_ENV === 'test' ? 15 : 3, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send forgot password OTP',
        description:
            'Sends a 5-digit OTP code to the provided email for password reset verification',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Password reset OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Password reset OTP sent successfully. Please check your email.',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/forgot-password' },
                message: {
                    type: 'string',
                    example: 'Invalid email format',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to send password reset OTP',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/forgot-password' },
                message: { type: 'string', example: 'Failed to send password reset OTP email' },
            },
        },
    })
    async sendForgotPasswordOtp(@Body() dto: SendOtpRequestDto) {
        await this.otpService.sendForgotPasswordOtp(dto);
        return {
            message: 'Password reset OTP sent successfully. Please check your email.',
        };
    }

    @Post('email-reset')
    @Throttle({ default: { limit: process.env.NODE_ENV === 'test' ? 15 : 3, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send email reset OTP',
        description: 'Sends a 5-digit OTP code to the provided email for email reset verification',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Email reset OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Email reset OTP sent successfully. Please check your email.',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/email-reset' },
                message: {
                    type: 'string',
                    example: 'Invalid email format',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to send email reset OTP',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/otp/email-reset' },
                message: { type: 'string', example: 'Failed to send email reset OTP email' },
            },
        },
    })
    async sendEmailResetOtp(@Body() dto: SendOtpRequestDto) {
        await this.otpService.sendEmailResetOtp(dto);
        return {
            message: 'Email reset OTP sent successfully. Please check your email.',
        };
    }

    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verify OTP',
        description:
            'Verifies the OTP code for the given email and purpose (registration or forgot-password)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'OTP verified successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'OTP verified successfully.',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description:
            'Invalid OTP, expired OTP, purpose mismatch, validation error, or no OTP found',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        statusCode: {
                            type: 'number',
                            example: 400,
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-12-27T10:30:00.000Z',
                        },
                        path: {
                            type: 'string',
                            example: '/api/auth/otp/verify',
                        },
                        message: {
                            type: 'string',
                        },
                    },
                },
                examples: {
                    invalidOtp: {
                        summary: 'Invalid OTP',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/otp/verify',
                            message: 'Invalid OTP code. Please check and try again.',
                        },
                    },
                    expiredOtp: {
                        summary: 'Expired OTP',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/otp/verify',
                            message: 'OTP has expired. Please request a new one.',
                        },
                    },
                    notFound: {
                        summary: 'OTP not found',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/otp/verify',
                            message: 'No OTP found for this email. Please request a new one.',
                        },
                    },
                    invalidPurpose: {
                        summary: 'Invalid OTP purpose',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/otp/verify',
                            message:
                                'Invalid OTP context. Please use the correct verification flow.',
                        },
                    },
                    validationError: {
                        summary: 'DTO validation error',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/otp/verify',
                            message: 'Invalid email format, OTP code must be exactly 5 digits',
                        },
                    },
                },
            },
        },
    })
    verifyOtp(@Body() dto: VerifyOtpDto) {
        this.otpService.verifyOtp(dto);
        return {
            message: 'OTP verified successfully.',
        };
    }
}
