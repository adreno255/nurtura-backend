import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiInternalServerErrorResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmailQueryDto } from './dto/email-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from 'src/common/decorators';

@Public()
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('providers')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get available sign-in providers',
        description:
            'Returns all sign-in providers (methods) available for the given email address',
    })
    @ApiQuery({
        name: 'email',
        required: true,
        type: String,
        example: 'user@example.com',
        description: 'Email address to check for sign-in providers',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sign-in providers retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                providers: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['password', 'google.com'],
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
                path: { type: 'string', example: '/api/auth/providers' },
                message: { type: 'string', example: 'Invalid email format' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to check sign-in providers',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/providers' },
                message: { type: 'string', example: 'Failed to check sign-in providers' },
            },
        },
    })
    async getProviders(@Query() dto: EmailQueryDto) {
        return this.authService.getProviders(dto);
    }

    @Get('onboarding-status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Check user onboarding status',
        description: 'Checks if a user needs to complete onboarding/profile setup',
    })
    @ApiQuery({
        name: 'email',
        required: true,
        type: String,
        example: 'user@example.com',
        description: 'Email address to check onboarding status',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Onboarding status checked successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        needsOnboarding: {
                            type: 'boolean',
                        },
                        providers: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        message: {
                            type: 'string',
                        },
                    },
                },
                examples: {
                    needsOnboarding: {
                        summary: 'User needs onboarding',
                        value: {
                            needsOnboarding: true,
                            providers: ['google.com'],
                            message: 'User exists in Firebase, but no profile found in database',
                        },
                    },
                    onboardingComplete: {
                        summary: 'User onboarding complete',
                        value: {
                            needsOnboarding: false,
                            message: 'User profile exists',
                        },
                    },
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'No user found for this email',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/onboarding-status' },
                message: { type: 'string', example: 'No user found for this email' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email or no sign-in methods found',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        statusCode: { type: 'number', example: 400 },
                        timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                        path: { type: 'string', example: '/api/auth/onboarding-status' },
                        message: { type: 'string' },
                    },
                },
                examples: {
                    invalidEmail: {
                        summary: 'Invalid email format',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/onboarding-status',
                            message: 'Invalid email format',
                        },
                    },
                    noSignInMethods: {
                        summary: 'No sign-in methods found',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/onboarding-status',
                            message: 'No sign-in methods found for this user',
                        },
                    },
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to check user status',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/onboarding-status' },
                message: { type: 'string', example: 'Failed to check user status' },
            },
        },
    })
    async getOnboardingStatus(@Query() dto: EmailQueryDto) {
        return this.authService.getOnboardingStatus(dto);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reset user password',
        description: 'Updates the password for a user account in Firebase',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Password updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Password updated successfully',
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'No user found for this email',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/reset-password' },
                message: { type: 'string', example: 'No user found for this email' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid email or password format',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        statusCode: { type: 'number', example: 400 },
                        timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                        path: { type: 'string', example: '/api/auth/reset-password' },
                        message: { type: 'string' },
                    },
                },
                examples: {
                    invalidEmail: {
                        summary: 'Invalid email format',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/reset-password',
                            message: 'Invalid email format',
                        },
                    },
                    weakPassword: {
                        summary: 'Password validation failed',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/api/auth/reset-password',
                            message:
                                'Password must be at least 8 characters long, Password must contain at least one uppercase letter, one lowercase letter, one digit, and one symbol',
                        },
                    },
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to reset password',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/auth/reset-password' },
                message: { type: 'string', example: 'Failed to reset password' },
            },
        },
    })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }
}
