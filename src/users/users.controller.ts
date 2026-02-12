import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiConflictResponse,
    ApiUnauthorizedResponse,
    ApiInternalServerErrorResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Public, CurrentUser } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';
import { CheckEmailAvailabilityDto, CreateUserDto, UpdateUserDto } from './dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('exists')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Check email availability',
        description: 'Checks if an email is available for registration',
    })
    @ApiQuery({
        name: 'email',
        required: true,
        type: String,
        example: 'user@example.com',
        description: 'Email address to check',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Email availability checked successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        available: { type: 'boolean' },
                        message: { type: 'string' },
                    },
                },
                examples: {
                    available: {
                        summary: 'Email is available',
                        value: {
                            available: true,
                            message: 'Email is available',
                        },
                    },
                    taken: {
                        summary: 'Email is already registered',
                        value: {
                            available: false,
                            message: 'Email is already registered',
                        },
                    },
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
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Invalid email format' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Failed to check email availability' },
            },
        },
    })
    async checkEmail(@Query() dto: CheckEmailAvailabilityDto) {
        return this.usersService.checkEmailAvailability(dto);
    }

    @Get()
    @ApiBearerAuth('firebase-jwt')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user by Firebase UID',
        description: 'Retrieves user information by Firebase UID',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User info retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'User info fetched successfully' },
                userInfo: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        firebaseUid: { type: 'string', example: 'cml789xyz' },
                        firstName: { type: 'string', example: 'Juan' },
                        middleName: { type: 'string', example: 'Santos', nullable: true },
                        lastName: { type: 'string', example: 'Dela Cruz' },
                        suffix: { type: 'string', example: 'Jr.', nullable: true },
                        email: { type: 'string', example: 'juan@example.com' },
                        address: {
                            type: 'string',
                            example: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                        },
                        block: { type: 'string', example: 'Block 5' },
                        street: { type: 'string', example: 'Sampaguita St' },
                        barangay: { type: 'string', example: 'Brgy Commonwealth' },
                        city: { type: 'string', example: 'Quezon City' },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users/clx123abc456' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'User not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users/clx123abc456' },
                message: { type: 'string', example: 'User not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users/clx123abc456' },
                message: { type: 'string', example: 'Failed to fetch user by Firebase UID' },
            },
        },
    })
    async getUserById(@CurrentUser() user: CurrentUserPayload) {
        return this.usersService.findById(user.dbId);
    }

    @Post()
    @ApiBearerAuth('firebase-jwt')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register new user',
        description: 'Creates user profile in database (requires Firebase authentication)',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'User registered successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'User registered successfully' },
                userId: { type: 'string', example: 'clx123abc456' },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: {
                    type: 'string',
                    example: 'First name is required, Last name is required',
                },
            },
        },
    })
    @ApiConflictResponse({
        description: 'User profile already exists',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'User profile already exists' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Failed to register user to the database' },
            },
        },
    })
    async createUser(
        @CurrentUser() user: CurrentUserPayload,
        @Body() createUserDto: CreateUserDto,
    ) {
        return this.usersService.create(user.firebaseUid, user.email, createUserDto);
    }

    @Patch()
    @ApiBearerAuth('firebase-jwt')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update user',
        description:
            'Updates user information (email, first name, middle name, last name, suffix, and/or address)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'User updated successfully' },
                userInfo: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        firebaseUid: { type: 'string', example: 'cml789xyz' },
                        firstName: { type: 'string', example: 'Juan' },
                        middleName: { type: 'string', example: 'Santos', nullable: true },
                        lastName: { type: 'string', example: 'Dela Cruz' },
                        suffix: { type: 'string', example: 'Jr.', nullable: true },
                        email: { type: 'string', example: 'juan@example.com' },
                        address: {
                            type: 'string',
                            example: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                        },
                        block: { type: 'string', example: 'Block 5' },
                        street: { type: 'string', example: 'Sampaguita St' },
                        barangay: { type: 'string', example: 'Brgy Commonwealth' },
                        city: { type: 'string', example: 'Quezon City' },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: {
                    type: 'string',
                    example: 'Validation failed',
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'User not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'User not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/users' },
                message: { type: 'string', example: 'Failed to update user to the database' },
            },
        },
    })
    async update(@CurrentUser() user: CurrentUserPayload, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(user.dbId, updateUserDto);
    }
}
