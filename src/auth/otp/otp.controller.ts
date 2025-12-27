import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { SendRegistrationOtpDto } from './dto/send-registration-otp.dto';
import { SendForgotPasswordOtpDto } from './dto/send-forgot-password-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Authentication - OTP')
@Controller('auth/otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) {}

    @Post('send')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send registration OTP',
        description:
            'Sends a 6-digit OTP code to the provided email for account registration verification',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'OTP sent successfully',
        schema: {
            example: {
                message: 'Registration OTP sent successfully. Please check your email.',
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email format or failed to send OTP',
        schema: {
            example: {
                statusCode: 400,
                message: 'Failed to send OTP email. Please try again.',
                error: 'Bad Request',
            },
        },
    })
    async sendRegistrationOtp(@Body() dto: SendRegistrationOtpDto) {
        await this.otpService.sendRegistrationOtp(dto);
        return {
            message: 'Registration OTP sent successfully. Please check your email.',
        };
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send forgot password OTP',
        description:
            'Sends a 6-digit OTP code to the provided email for password reset verification',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Password reset OTP sent successfully',
        schema: {
            example: {
                message: 'Password reset OTP sent successfully. Please check your email.',
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email format or failed to send OTP',
        schema: {
            example: {
                statusCode: 400,
                message: 'Failed to send password reset OTP. Please try again.',
                error: 'Bad Request',
            },
        },
    })
    async sendForgotPasswordOtp(@Body() dto: SendForgotPasswordOtpDto) {
        await this.otpService.sendForgotPasswordOtp(dto);
        return {
            message: 'Password reset OTP sent successfully. Please check your email.',
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
            example: {
                message: 'OTP verified successfully.',
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid OTP, expired OTP, purpose mismatch, or no OTP found',
        schema: {
            examples: {
                invalidCode: {
                    value: {
                        statusCode: 400,
                        message: 'Invalid OTP code. Please check and try again.',
                        error: 'Bad Request',
                    },
                },
                expired: {
                    value: {
                        statusCode: 400,
                        message: 'OTP has expired. Please request a new one.',
                        error: 'Bad Request',
                    },
                },
                notFound: {
                    value: {
                        statusCode: 400,
                        message: 'No OTP found for this email. Please request a new one.',
                        error: 'Bad Request',
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
