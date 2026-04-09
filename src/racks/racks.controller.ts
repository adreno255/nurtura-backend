import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
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
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { RacksService } from './racks.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';
import { ActivityQueryDto } from '../common/dto/activity-query.dto';
import {
    CreateRackDto,
    UpdateRackDto,
    AssignPlantToRackDto,
    HarvestPlantDto,
    UnassignFromRackDto,
    HarvestLeavesDto,
    HarvestSeedsDto,
} from './dto';
import { RackExistsDto } from './dto/rack-exists.dto';

@ApiTags('Racks')
@ApiBearerAuth('firebase-jwt')
@Controller('racks')
export class RacksController {
    constructor(private readonly racksService: RacksService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get all racks for authenticated user',
        description: 'Retrieves a paginated list of all racks owned by the authenticated user',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of items per page',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Racks retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx123abc456' },
                            userId: { type: 'string', example: 'clxusr789' },
                            name: { type: 'string', example: 'Living Room Farm' },
                            macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                            mqttTopic: {
                                type: 'string',
                                example: 'nurtura/rack/aa-bb-cc-dd-ee-ff',
                                nullable: true,
                            },
                            description: {
                                type: 'string',
                                example: 'Rack for growing herbs',
                                nullable: true,
                            },
                            currentPlantId: {
                                type: 'string',
                                example: 'clx000plant123',
                                nullable: true,
                            },
                            quantity: { type: 'number', example: 10 },
                            plantedAt: {
                                type: 'string',
                                example: '2025-01-01T08:00:00.000Z',
                                nullable: true,
                            },
                            lastHarvestAt: {
                                type: 'string',
                                example: '2025-02-01T08:00:00.000Z',
                                nullable: true,
                            },
                            harvestCount: { type: 'number', example: 3 },
                            isActive: { type: 'boolean', example: true },
                            status: {
                                type: 'string',
                                enum: ['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE'],
                                example: 'ONLINE',
                            },
                            lastActivityAt: {
                                type: 'string',
                                example: '2025-02-01T10:30:00.000Z',
                                nullable: true,
                            },
                            lastSeenAt: {
                                type: 'string',
                                example: '2025-02-01T10:30:00.000Z',
                                nullable: true,
                            },
                            lastWateredAt: {
                                type: 'string',
                                example: '2025-02-01T09:00:00.000Z',
                                nullable: true,
                            },
                            lastLightOnAt: {
                                type: 'string',
                                example: '2025-02-01T06:00:00.000Z',
                                nullable: true,
                            },
                            createdAt: { type: 'string', example: '2025-01-15T08:00:00.000Z' },
                            updatedAt: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                            currentPlant: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                    name: { type: 'string', example: 'Basil' },
                                    category: { type: 'string', example: 'Herb' },
                                    recommendedSoil: { type: 'string', example: 'Loamy soil' },
                                    description: {
                                        type: 'string',
                                        example:
                                            'Basil is a fragrant herb commonly used in cooking.',
                                    },
                                },
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        currentPage: { type: 'number', example: 1 },
                        itemsPerPage: { type: 'number', example: 10 },
                        totalItems: { type: 'number', example: 25 },
                        totalPages: { type: 'number', example: 3 },
                        hasNextPage: { type: 'boolean', example: true },
                        hasPreviousPage: { type: 'boolean', example: false },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid query parameters',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks' },
                message: {
                    type: 'string',
                    example: 'Page and limit query parameters must be positive integers',
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
                path: { type: 'string', example: '/racks' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks' },
                message: { type: 'string', example: 'Failed to fetch racks' },
            },
        },
    })
    async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: PaginationQueryDto) {
        return this.racksService.findAll(user.dbId, query);
    }

    @Get('exists')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Check if rack exists by MAC address',
        description:
            'Checks if a rack with the given MAC address already exists for the authenticated user. Returns true if it exists, false otherwise.',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Rack existence check completed successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        exists: {
                            type: 'boolean',
                            example: true,
                        },
                        rack: {
                            type: 'object',
                            example: {
                                id: 'clx123abc456',
                                userId: 'clxusr789',
                                name: 'Living Room Farm',
                                macAddress: 'AA:BB:CC:DD:EE:FF',
                                mqttTopic: 'nurtura/rack/aa-bb-cc-dd-ee-ff',
                                description: 'Rack for growing herbs',
                                currentPlantId: 'clx000plant123',
                                quantity: 10,
                                plantedAt: '2025-01-01T08:00:00.000Z',
                                lastHarvestAt: '2025-02-01T08:00:00.000Z',
                                harvestCount: 3,
                                isActive: true,
                                status: 'ONLINE',
                                lastActivityAt: '2025-02-01T10:30:00.000Z',
                                lastSeenAt: '2025-02-01T10:30:00.000Z',
                                lastWateredAt: '2025-02-01T09:00:00.000Z',
                                lastLightOnAt: '2025-02-01T06:00:00.000Z',
                                createdAt: '2025-01-15T08:00:00.000Z',
                                updatedAt: '2025-02-01T10:30:00.000Z',
                            },
                            nullable: true,
                        },
                    },
                },
                examples: {
                    doesExist: {
                        summary: 'Rack Exists',
                        value: {
                            exists: true,
                            rack: {
                                id: 'clx123abc456',
                                userId: 'clxusr789',
                                name: 'Living Room Farm',
                                macAddress: 'AA:BB:CC:DD:EE:FF',
                                mqttTopic: 'nurtura/rack/aa-bb-cc-dd-ee-ff',
                                description: 'Rack for growing herbs',
                                currentPlantId: 'clx000plant123',
                                quantity: 10,
                                plantedAt: '2025-01-01T08:00:00.000Z',
                                lastHarvestAt: '2025-02-01T08:00:00.000Z',
                                harvestCount: 3,
                                isActive: true,
                                status: 'ONLINE',
                                lastActivityAt: '2025-02-01T10:30:00.000Z',
                                lastSeenAt: '2025-02-01T10:30:00.000Z',
                                lastWateredAt: '2025-02-01T09:00:00.000Z',
                                lastLightOnAt: '2025-02-01T06:00:00.000Z',
                                createdAt: '2025-01-15T08:00:00.000Z',
                                updatedAt: '2025-02-01T10:30:00.000Z',
                            },
                        },
                    },
                    doesNotExist: {
                        summary: 'Rack Does Not Exist',
                        value: {
                            exists: false,
                        },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid MAC address format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/exists' },
                message: {
                    type: 'string',
                    example: 'Invalid MAC address format',
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
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/exists' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/exists' },
                message: { type: 'string', example: 'Failed to check rack existence' },
            },
        },
    })
    async rackExists(
        @CurrentUser() user: CurrentUserPayload,
        @Body() rackExistsDto: RackExistsDto,
    ) {
        return await this.racksService.rackExists(rackExistsDto.macAddress, user.dbId);
    }

    @Get('activities')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get rack management activities',
        description:
            'Returns RACK_ADDED, RACK_RENAMED, and RACK_REMOVED activities for all racks owned by the user, with optional date range filter, pagination, and rack ID filter.',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: String,
        description: 'Filter activities from this date (ISO 8601)',
        example: '2026-01-01T00:00:00.000Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: String,
        description: 'Filter activities up to this date (ISO 8601)',
        example: '2026-03-31T23:59:59.999Z',
    })
    @ApiQuery({
        name: 'rackId',
        required: false,
        type: String,
        description: 'Filter rack activities by rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (max 100)',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Rack activities retrieved successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', example: 'clx789act123' },
                                    rackId: { type: 'string', example: 'clx123abc456' },
                                    eventType: {
                                        type: 'string',
                                        enum: ['RACK_ADDED', 'RACK_RENAMED', 'RACK_REMOVED'],
                                    },
                                    details: {
                                        type: 'string',
                                        nullable: true,
                                    },
                                    metadata: {
                                        type: 'object',
                                        nullable: true,
                                        description: 'Shape varies by eventType. See examples.',
                                    },
                                    timestamp: {
                                        type: 'string',
                                        example: '2026-01-09T08:00:00.000Z',
                                    },
                                },
                            },
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                currentPage: { type: 'number', example: 1 },
                                itemsPerPage: { type: 'number', example: 10 },
                                totalItems: { type: 'number', example: 5 },
                                totalPages: { type: 'number', example: 1 },
                                hasNextPage: { type: 'boolean', example: false },
                                hasPreviousPage: { type: 'boolean', example: false },
                            },
                        },
                    },
                },
                examples: {
                    RACK_ADDED: {
                        summary: 'RACK_ADDED — rack registered',
                        value: {
                            data: [
                                {
                                    id: 'clx789act001',
                                    rackId: 'clx123abc456',
                                    eventType: 'RACK_ADDED',
                                    details: 'Rack "Living Room Farm" registered',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: '00:1B:44:11:3A:B7',
                                        userId: 'clxusr789',
                                    },
                                    timestamp: '2026-01-09T08:00:00.000Z',
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    RACK_RENAMED: {
                        summary: 'RACK_RENAMED — rack name updated',
                        value: {
                            data: [
                                {
                                    id: 'clx789act002',
                                    rackId: 'clx123abc456',
                                    eventType: 'RACK_RENAMED',
                                    details:
                                        'Rack renamed from "Living Room Farm" to "Herb Station"',
                                    metadata: {
                                        oldName: 'Living Room Farm',
                                        newName: 'Herb Station',
                                        macAddress: '00:1B:44:11:3A:B7',
                                        userId: 'clxusr789',
                                    },
                                    timestamp: '2026-02-01T10:00:00.000Z',
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    RACK_REMOVED: {
                        summary: 'RACK_REMOVED — rack deleted',
                        value: {
                            data: [
                                {
                                    id: 'clx789act003',
                                    rackId: 'clx123abc456',
                                    eventType: 'RACK_REMOVED',
                                    details: 'Rack "Herb Station" removed',
                                    metadata: {
                                        rackName: 'Herb Station',
                                        macAddress: '00:1B:44:11:3A:B7',
                                        userId: 'clxusr789',
                                    },
                                    timestamp: '2026-03-01T08:00:00.000Z',
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
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
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/activities' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/activities' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/activities' },
                message: { type: 'string', example: 'Failed to fetch rack activities' },
            },
        },
    })
    async getRackActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.racksService.getRackActivities(user.dbId, query);
    }

    @Get('count')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('firebase-jwt')
    @ApiOperation({
        summary: 'Get rack count',
        description: 'Returns the total number of active racks owned by the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Rack count retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                count: { type: 'number', example: 3 },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/api/racks/count' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/api/racks/count' },
                message: { type: 'string', example: 'Failed to fetch rack count' },
            },
        },
    })
    async getRackCount(@CurrentUser() user: CurrentUserPayload) {
        return this.racksService.getRackCount(user.dbId);
    }

    @Get('planted-quantity')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('firebase-jwt')
    @ApiOperation({
        summary: 'Get total planted quantity',
        description:
            'Returns the sum of plant quantities across all active racks owned by the authenticated user that currently have a plant assigned',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Total planted quantity retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                totalQuantity: { type: 'number', example: 28 },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/api/racks/planted-quantity' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-09T08:00:00.000Z' },
                path: { type: 'string', example: '/api/racks/planted-quantity' },
                message: { type: 'string', example: 'Failed to fetch planted quantity' },
            },
        },
    })
    async getPlantedQuantity(@CurrentUser() user: CurrentUserPayload) {
        return this.racksService.getPlantedQuantity(user.dbId);
    }

    @Get(':rackId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get rack details',
        description: 'Retrieves detailed information about a specific rack',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Rack details retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Rack details retrieved successfully' },
                rack: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        userId: { type: 'string', example: 'clxusr789' },
                        name: { type: 'string', example: 'Living Room Farm' },
                        macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                        mqttTopic: {
                            type: 'string',
                            example: 'nurtura/rack/aa-bb-cc-dd-ee-ff',
                            nullable: true,
                        },
                        description: {
                            type: 'string',
                            example: 'Rack for growing herbs',
                            nullable: true,
                        },
                        currentPlantId: {
                            type: 'string',
                            example: 'clx000plant123',
                            nullable: true,
                        },
                        quantity: { type: 'number', example: 10 },
                        plantedAt: {
                            type: 'string',
                            example: '2025-01-01T08:00:00.000Z',
                            nullable: true,
                        },
                        lastHarvestAt: {
                            type: 'string',
                            example: '2025-02-01T08:00:00.000Z',
                            nullable: true,
                        },
                        harvestCount: { type: 'number', example: 3 },
                        isActive: { type: 'boolean', example: true },
                        status: {
                            type: 'string',
                            enum: ['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE'],
                            example: 'ONLINE',
                        },
                        lastActivityAt: {
                            type: 'string',
                            example: '2025-02-01T10:30:00.000Z',
                            nullable: true,
                        },
                        lastSeenAt: {
                            type: 'string',
                            example: '2025-02-01T10:30:00.000Z',
                            nullable: true,
                        },
                        lastWateredAt: {
                            type: 'string',
                            example: '2025-02-01T09:00:00.000Z',
                            nullable: true,
                        },
                        lastLightOnAt: {
                            type: 'string',
                            example: '2025-02-01T06:00:00.000Z',
                            nullable: true,
                        },
                        createdAt: { type: 'string', example: '2025-01-15T08:00:00.000Z' },
                        updatedAt: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                        currentPlant: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                name: { type: 'string', example: 'Basil' },
                                category: { type: 'string', example: 'Herb' },
                                recommendedSoil: { type: 'string', example: 'Loamy soil' },
                                description: {
                                    type: 'string',
                                    example: 'Basil is a fragrant herb commonly used in cooking.',
                                },
                            },
                        },
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
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Failed to fetch rack details' },
            },
        },
    })
    async findOne(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.findById(rackId, user.dbId);
    }

    @Get(':rackId/sensors/current')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get current rack state',
        description: 'Retrieves current rack status and latest sensor reading',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Current rack state retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Current rack state retrieved successfully' },
                rack: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        name: { type: 'string', example: 'Living Room Farm' },
                        status: { type: 'string', example: 'ONLINE' },
                        lastSeenAt: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                    },
                },
                latestReading: {
                    type: 'object',
                    properties: {
                        temperature: { type: 'number', example: 25.5 },
                        humidity: { type: 'number', example: 65.2 },
                        moisture: { type: 'number', example: 45.8 },
                        lightLevel: { type: 'number', example: 850 },
                        timestamp: { type: 'string', example: '2025-02-01T10:25:00.000Z' },
                    },
                    nullable: true,
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
                path: { type: 'string', example: '/racks/clx123abc456/sensors/current' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/sensors/current' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/sensors/current' },
                message: { type: 'string', example: 'Failed to fetch current rack state' },
            },
        },
    })
    async getCurrentState(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
    ) {
        return this.racksService.getCurrentState(rackId, user.dbId);
    }

    @Get(':rackId/status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get device status',
        description:
            'Retrieves the current status of the rack device (ONLINE/OFFLINE/ERROR/MAINTENANCE)',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Device status retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Device status retrieved successfully' },
                status: { type: 'string', example: 'ONLINE' },
                lastSeenAt: { type: 'string', example: '2025-02-01T10:30:00.000Z', nullable: true },
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
                path: { type: 'string', example: '/racks/clx123abc456/status' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/status' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/status' },
                message: { type: 'string', example: 'Failed to fetch device status' },
            },
        },
    })
    async getStatus(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.getDeviceStatus(rackId, user.dbId);
    }

    @Get('activities/plant-care')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get plant care activity',
        description:
            'Retrieves watering and grow light activities (WATERING_START, WATERING_STOP, LIGHT_ON, LIGHT_OFF) across all racks owned by the authenticated user. Supports date range filtering, pagination, and rack ID filtering.',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: String,
        description: 'Filter from this date (ISO 8601)',
        example: '2025-02-01T00:00:00.000Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: String,
        description: 'Filter up to this date (ISO 8601)',
        example: '2025-02-28T23:59:59.999Z',
    })
    @ApiQuery({
        name: 'rackId',
        required: false,
        type: String,
        description: 'Filter plant care activities by rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (max 100)',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Plant care activities retrieved successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', example: 'clx789def012' },
                                    rackId: { type: 'string', example: 'clx123abc456' },
                                    eventType: {
                                        type: 'string',
                                        enum: [
                                            'WATERING_START',
                                            'WATERING_STOP',
                                            'LIGHT_ON',
                                            'LIGHT_OFF',
                                        ],
                                    },
                                    details: {
                                        type: 'string',
                                        nullable: true,
                                    },
                                    metadata: {
                                        type: 'object',
                                        nullable: true,
                                        description: 'Shape varies by eventType. See examples.',
                                    },
                                    timestamp: {
                                        type: 'string',
                                        example: '2025-02-05T14:30:00.000Z',
                                    },
                                    rack: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string', example: 'Living Room Farm' },
                                            macAddress: {
                                                type: 'string',
                                                example: 'AA:BB:CC:DD:EE:FF',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                currentPage: { type: 'number', example: 1 },
                                itemsPerPage: { type: 'number', example: 10 },
                                totalItems: { type: 'number', example: 42 },
                                totalPages: { type: 'number', example: 5 },
                                hasNextPage: { type: 'boolean', example: true },
                                hasPreviousPage: { type: 'boolean', example: false },
                            },
                        },
                    },
                },
                examples: {
                    WATERING_START: {
                        summary: 'WATERING_START — watering started',
                        value: {
                            data: [
                                {
                                    id: 'clx789def012',
                                    rackId: 'clx123abc456',
                                    eventType: 'WATERING_START',
                                    details:
                                        'Watering start triggered by automation rule "Auto Watering - Lettuce"',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        source: 'automation',
                                        ruleId: 'clxrule123',
                                        ruleName: 'Auto Watering - Lettuce',
                                        duration: 300000,
                                    },
                                    timestamp: '2025-02-05T14:30:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    WATERING_STOP: {
                        summary: 'WATERING_STOP — watering stopped',
                        value: {
                            data: [
                                {
                                    id: 'clx789def013',
                                    rackId: 'clx123abc456',
                                    eventType: 'WATERING_STOP',
                                    details:
                                        'Watering stop triggered by automation rule "Auto Watering - Lettuce"',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        source: 'automation',
                                        ruleId: 'clxrule123',
                                        ruleName: 'Auto Watering - Lettuce',
                                        duration: 300000,
                                    },
                                    timestamp: '2025-02-05T14:35:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    LIGHT_ON: {
                        summary: 'LIGHT_ON — grow light turned on',
                        value: {
                            data: [
                                {
                                    id: 'clx789def014',
                                    rackId: 'clx123abc456',
                                    eventType: 'LIGHT_ON',
                                    details:
                                        'Grow light on triggered by automation rule "Morning Light Cycle"',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        source: 'automation',
                                        ruleId: 'clxrule456',
                                        ruleName: 'Morning Light Cycle',
                                    },
                                    timestamp: '2025-02-05T06:00:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    LIGHT_OFF: {
                        summary: 'LIGHT_OFF — grow light turned off',
                        value: {
                            data: [
                                {
                                    id: 'clx789def015',
                                    rackId: 'clx123abc456',
                                    eventType: 'LIGHT_OFF',
                                    details:
                                        'Grow light off triggered by automation rule "Morning Light Cycle"',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        source: 'automation',
                                        ruleId: 'clxrule456',
                                        ruleName: 'Morning Light Cycle',
                                    },
                                    timestamp: '2025-02-05T18:00:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
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
                path: { type: 'string', example: '/racks/activities/plant-care' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/activities/plant-care' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/activities/plant-care' },
                message: { type: 'string', example: 'Failed to fetch plant care activities' },
            },
        },
    })
    async getPlantCareActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.racksService.getPlantCareActivities(user.dbId, query);
    }

    @Get('activities/harvest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get harvest activity',
        description:
            'Retrieves harvest activities (LEAVES_HARVESTED, PLANT_HARVESTED, and SEEDS_HARVESTED) across all racks owned by the authenticated user. Supports date range filtering, pagination, and rack ID filtering. Also returns `totalHarvestCount` — the sum of harvest events within the date range.',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: String,
        description: 'Filter from this date (ISO 8601)',
        example: '2025-02-01T00:00:00.000Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: String,
        description: 'Filter up to this date (ISO 8601)',
        example: '2025-02-28T23:59:59.999Z',
    })
    @ApiQuery({
        name: 'rackId',
        required: false,
        type: String,
        description: 'Filter harvest activities by rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (max 100)',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Harvest activities retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx789def012' },
                            rackId: { type: 'string', example: 'clx123abc456' },
                            eventType: { type: 'string', example: 'PLANT_HARVESTED' },
                            details: {
                                type: 'string',
                                example: 'Harvest #3 of "Lettuce" from rack "Living Room Farm"',
                            },
                            metadata: {
                                type: 'object',
                                properties: {
                                    rackName: { type: 'string', example: 'Living Room Farm' },
                                    macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                                    plantId: { type: 'string', example: 'plant789' },
                                    plantName: { type: 'string', example: 'Lettuce' },
                                    harvestCount: { type: 'number', example: 3 },
                                    quantity: {
                                        type: 'number',
                                        description: 'Number of plants/heads harvested',
                                        example: 15,
                                    },
                                    harvestedAt: {
                                        type: 'string',
                                        example: '2025-02-05T14:30:00.000Z',
                                    },
                                },
                            },
                            timestamp: { type: 'string', example: '2025-02-05T14:30:00.000Z' },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        currentPage: { type: 'number', example: 1 },
                        itemsPerPage: { type: 'number', example: 10 },
                        totalItems: { type: 'number', example: 15 },
                        totalPages: { type: 'number', example: 2 },
                        hasNextPage: { type: 'boolean', example: true },
                        hasPreviousPage: { type: 'boolean', example: false },
                    },
                },
                totalHarvestCount: {
                    type: 'number',
                    description: 'Total pieces/heads harvested across all events in the date range',
                    example: 150,
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
                path: { type: 'string', example: '/racks/activities/harvest' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/activities/harvest' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/plants/activities/harvest' },
                message: { type: 'string', example: 'Failed to fetch harvest activities' },
            },
        },
    })
    async getHarvestActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.racksService.getHarvestActivities(user.dbId, query);
    }

    @Get('activities/planting')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get planting activity',
        description:
            'Retrieves planting activities (PLANT_ADDED, PLANT_CHANGED, PLANT_REMOVED) across all racks owned by the authenticated user. Supports date range filtering, pagination, and rack ID filtering.',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: String,
        description: 'Filter records planted from this date (ISO 8601)',
        example: '2025-02-01T00:00:00.000Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: String,
        description: 'Filter records planted up to this date (ISO 8601)',
        example: '2025-02-28T23:59:59.999Z',
    })
    @ApiQuery({
        name: 'rackId',
        required: false,
        type: String,
        description: 'Filter planting activities by rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (max 100)',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Planting activities retrieved successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', example: 'clx999act001' },
                                    rackId: { type: 'string', example: 'clx123abc456' },
                                    eventType: {
                                        type: 'string',
                                        enum: ['PLANT_ADDED', 'PLANT_CHANGED', 'PLANT_REMOVED'],
                                    },
                                    details: {
                                        type: 'string',
                                        nullable: true,
                                    },
                                    metadata: {
                                        type: 'object',
                                        nullable: true,
                                        description: 'Shape varies by eventType. See examples.',
                                    },
                                    timestamp: {
                                        type: 'string',
                                        example: '2025-01-01T08:00:00.000Z',
                                    },
                                    rack: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string', example: 'Living Room Farm' },
                                            macAddress: {
                                                type: 'string',
                                                example: 'AA:BB:CC:DD:EE:FF',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                currentPage: { type: 'number', example: 1 },
                                itemsPerPage: { type: 'number', example: 10 },
                                totalItems: { type: 'number', example: 5 },
                                totalPages: { type: 'number', example: 1 },
                                hasNextPage: { type: 'boolean', example: false },
                                hasPreviousPage: { type: 'boolean', example: false },
                            },
                        },
                    },
                },
                examples: {
                    PLANT_ADDED: {
                        summary: 'PLANT_ADDED — fresh planting',
                        value: {
                            data: [
                                {
                                    id: 'clx999act001',
                                    rackId: 'clx123abc456',
                                    eventType: 'PLANT_ADDED',
                                    details: 'Plant "Lettuce" added to rack',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        plantId: 'clx000plant123',
                                        plantName: 'Lettuce',
                                        quantity: 10,
                                        plantedAt: '2025-01-01T08:00:00.000Z',
                                    },
                                    timestamp: '2025-01-01T08:00:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    PLANT_CHANGED: {
                        summary: 'PLANT_CHANGED — crop rotation',
                        value: {
                            data: [
                                {
                                    id: 'clx999act002',
                                    rackId: 'clx123abc456',
                                    eventType: 'PLANT_CHANGED',
                                    details: 'Plant changed from previous to "Basil"',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        previousPlantId: 'clx000plant456',
                                        previousPlantName: 'Lettuce',
                                        newPlantId: 'clx000plant123',
                                        newPlantName: 'Basil',
                                        quantity: 8,
                                    },
                                    timestamp: '2025-02-01T08:00:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
                    },
                    PLANT_REMOVED: {
                        summary: 'PLANT_REMOVED — removed without harvesting',
                        value: {
                            data: [
                                {
                                    id: 'clx999act003',
                                    rackId: 'clx123abc456',
                                    eventType: 'PLANT_REMOVED',
                                    details:
                                        'Plant removed from rack (replaced during crop rotation)',
                                    metadata: {
                                        rackName: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                        removedPlantId: 'clx000plant456',
                                        removedPlantName: 'Lettuce',
                                        replacedByPlantId: 'clx000plant123',
                                        replacedByPlantName: 'Basil',
                                    },
                                    timestamp: '2025-02-01T08:00:00.000Z',
                                    rack: {
                                        id: 'clx123abc456',
                                        name: 'Living Room Farm',
                                        macAddress: 'AA:BB:CC:DD:EE:FF',
                                    },
                                },
                            ],
                            meta: {
                                currentPage: 1,
                                itemsPerPage: 10,
                                totalItems: 1,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false,
                            },
                        },
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
                path: { type: 'string', example: '/racks/activities/planting' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/activities/planting' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/plants/activities/planting' },
                message: { type: 'string', example: 'Failed to fetch planting activities' },
            },
        },
    })
    async getPlantingActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.racksService.getPlantingActivities(user.dbId, query);
    }

    @Post(':rackId/harvest-leaves')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Harvest leaves of current plant from a rack',
        description:
            'Marks the leaves of the current plant as successfully harvested while keeping the plant in the rack. Increments the harvest count and logs a LEAVES_HARVESTED activity, but does not clear the rack or mark the plant as fully harvested.',
    })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx123abc456' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Leaves harvested successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Leaves harvested successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Plant is not assigned to this rack',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-leaves' },
                message: {
                    type: 'string',
                    example: 'This plant is not currently assigned to that rack',
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-leaves' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-leaves' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-leaves' },
                message: { type: 'string', example: 'Failed to harvest leaves' },
            },
        },
    })
    async harvestLeavesFromRack(
        @Param('rackId') rackId: string,
        @Body() dto: HarvestLeavesDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.racksService.harvestLeavesFromRack(rackId, user.dbId, dto);
    }

    @Post(':rackId/harvest')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Harvest a plant from a rack',
        description:
            'Marks the plant as successfully harvested and clears the rack. Increments the harvest count and logs a PLANT_HARVESTED activity.',
    })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx123abc456' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Plant harvested successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant harvested successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Plant is not assigned to this rack',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest' },
                message: {
                    type: 'string',
                    example: 'This plant is not currently assigned to that rack',
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest' },
                message: { type: 'string', example: 'Failed to harvest plant' },
            },
        },
    })
    async harvestPlantFromRack(
        @Param('rackId') rackId: string,
        @Body() dto: HarvestPlantDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.racksService.harvestPlantFromRack(rackId, user.dbId, dto);
    }

    @Post(':rackId/harvest-seeds')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Harvest seeds of current plant from a rack',
        description:
            'Marks the seeds of the current plant as successfully harvested while keeping the plant in the rack. Increments the harvest count and logs a SEEDS_HARVESTED activity, but does not clear the rack or mark the plant as fully harvested.',
    })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx123abc456' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Seeds harvested successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Seeds harvested successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description:
            'Plant is not assigned to this rack, exceeds available seeds, or depletes the rack below minimum seed threshold.',
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
                            example: '/racks/clx123abc456/harvest-seeds',
                        },
                        message: {
                            type: 'string',
                        },
                    },
                },
                examples: {
                    plantNotAssigned: {
                        summary: 'Plant not assigned to rack',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/racks/clx123abc456/harvest-seeds',
                            message: 'This plant is not currently assigned to that rack',
                        },
                    },
                    aboveMaximumThreshold: {
                        summary: 'Exceeds available seeds',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/racks/clx123abc456/harvest-seeds',
                            message:
                                'Cannot harvest 10 seeds — maximum allowed is 9 (rack quantity minus 1)',
                        },
                    },
                    belowMinimumThreshold: {
                        summary: 'Below minimum threshold',
                        value: {
                            statusCode: 400,
                            timestamp: '2025-12-27T10:30:00.000Z',
                            path: '/racks/clx123abc456/harvest-seeds',
                            message:
                                'Cannot harvest seeds — rack must have at least 2 seeds to harvest any (quantity must be at least 2)',
                        },
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-seeds' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-seeds' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/harvest-seeds' },
                message: { type: 'string', example: 'Failed to harvest seeds' },
            },
        },
    })
    async harvestSeedsFromRack(
        @Param('rackId') rackId: string,
        @Body() dto: HarvestSeedsDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.racksService.harvestSeedsFromRack(rackId, user.dbId, dto);
    }

    @Post(':rackId/assign')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Assign a plant to a rack',
        description:
            'Assigns this plant to the specified rack. If the rack already has a different plant, it is recorded as removed (PLANT_REMOVED + PLANT_CHANGED). If the rack is empty, the event is PLANT_ADDED.',
    })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx123abc456' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Plant assigned to rack successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant assigned to rack successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Validation error or plant is inactive',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/assign' },
                message: { type: 'string', example: 'Cannot assign an inactive plant to a rack' },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/assign' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Plant or rack not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/assign' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/assign' },
                message: { type: 'string', example: 'Failed to assign plant to rack' },
            },
        },
    })
    async assignToRack(
        @Param('rackId') rackId: string,
        @Body() dto: AssignPlantToRackDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.racksService.assignToRack(rackId, user.dbId, dto);
    }

    @Post(':rackId/unassign')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Remove a plant from a rack without harvesting',
        description:
            'Removes the plant from the rack without harvesting — used for failure or early removal cases. Logs a PLANT_REMOVED activity.',
    })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx123abc456' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Plant removed from rack successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant removed from rack successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Plant is not assigned to this rack',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/unassign' },
                message: {
                    type: 'string',
                    example: 'This plant is not currently assigned to that rack',
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/unassign' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/unassign' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/unassign' },
                message: { type: 'string', example: 'Failed to remove plant from rack' },
            },
        },
    })
    async unassignFromRack(
        @Param('rackId') rackId: string,
        @Body() dto: UnassignFromRackDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.racksService.unassignFromRack(rackId, user.dbId, dto);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register new rack',
        description: 'Creates a new rack by registering an ESP32 device with its MAC address',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Rack registered successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Rack registered successfully' },
                rackId: { type: 'string', example: 'clx123abc456' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Rack registered successfully',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            example: 'Rack registered successfully',
                        },
                        rackId: {
                            type: 'string',
                            example: 'clx123abc456',
                        },
                    },
                },
                examples: {
                    newRack: {
                        summary: 'New Rack Registration',
                        value: {
                            message: 'Rack registered successfully',
                            rackId: 'clx123abc456',
                        },
                    },
                    recoveredRack: {
                        summary: 'Recovered Rack',
                        value: {
                            message: 'Archived rack recovered successfully.',
                            rackId: 'clx123abc456',
                        },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid MAC address format or validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks' },
                message: {
                    type: 'string',
                    example: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
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
                path: { type: 'string', example: '/racks' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiConflictResponse({
        description: 'MAC address already registered',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks' },
                message: { type: 'string', example: 'MAC address already registered' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks' },
                message: { type: 'string', example: 'Failed to register rack' },
            },
        },
    })
    async create(@CurrentUser() user: CurrentUserPayload, @Body() createRackDto: CreateRackDto) {
        return this.racksService.create(user.dbId, createRackDto);
    }

    @Patch(':rackId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update rack',
        description: 'Updates rack information (name, description, MQTT topic)',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Rack updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Rack updated successfully' },
                rack: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        name: { type: 'string', example: 'Living Room Farm' },
                        macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                        mqttTopic: { type: 'string', example: 'nurtura/rack/living-room' },
                        description: { type: 'string', example: 'Rack for growing herbs' },
                        status: { type: 'string', example: 'ONLINE' },
                        isActive: { type: 'boolean', example: true },
                        lastSeenAt: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                        createdAt: { type: 'string', example: '2025-01-15T08:00:00.000Z' },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Validation failed' },
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
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Failed to update rack' },
            },
        },
    })
    async update(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
        @Body() updateRackDto: UpdateRackDto,
    ) {
        return this.racksService.update(rackId, user.dbId, updateRackDto);
    }

    @Delete(':rackId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete rack',
        description: 'Soft deletes a rack (sets isActive to false)',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Rack deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Rack deleted successfully' },
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
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: {
                    type: 'string',
                    example: 'Rack clx123abc456 not found or access denied',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456' },
                message: { type: 'string', example: 'Failed to delete rack' },
            },
        },
    })
    async remove(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.delete(rackId, user.dbId);
    }

    /*
    @Post(':rackId/commands/water')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Trigger watering',
        description: 'Sends a command to activate the water pump for a specified duration',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Watering command sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Watering command sent successfully' },
                commandType: { type: 'string', example: 'water' },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid duration',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/water' },
                message: {
                    type: 'string',
                    example: 'Watering duration must be between 1000ms and 60000ms',
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/water' },
                message: { type: 'string', example: 'Rack clx123abc456 not found or access denied' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/water' },
                message: { type: 'string', example: 'Failed to send watering command' },
            },
        },
    })
    async triggerWatering(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
        @Body() waterCommandDto: WaterCommandDto,
    ) {
        return this.racksService.triggerWatering(
            rackId,
            user.dbId,
            waterCommandDto.duration,
        );
    }

    @Post(':rackId/commands/light')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Control grow light',
        description: 'Sends a command to turn the grow light on or off',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Grow light command sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Grow light on command sent successfully' },
                commandType: { type: 'string', example: 'light' },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid action',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/light' },
                message: { type: 'string', example: 'Action must be either "on" or "off"' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/light' },
                message: { type: 'string', example: 'Rack clx123abc456 not found or access denied' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/light' },
                message: { type: 'string', example: 'Failed to send grow light command' },
            },
        },
    })
    async controlGrowLight(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
        @Body() lightCommandDto: LightCommandDto,
    ) {
        return this.racksService.controlGrowLight(rackId, user.dbId, lightCommandDto.action);
    }

    @Post(':rackId/commands/sensors')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Control sensors',
        description: 'Sends a command to turn sensors on or off (for maintenance)',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sensors command sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Sensors on command sent successfully' },
                commandType: { type: 'string', example: 'sensors' },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid action',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/sensors' },
                message: { type: 'string', example: 'Action must be either "on" or "off"' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/sensors' },
                message: { type: 'string', example: 'Rack clx123abc456 not found or access denied' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/commands/sensors' },
                message: { type: 'string', example: 'Failed to send sensors command' },
            },
        },
    })
    async controlSensors(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
        @Body() sensorsCommandDto: SensorsCommandDto,
    ) {
        return this.racksService.controlSensors(rackId, user.dbId, sensorsCommandDto.action);
    }

    @Get(':rackId/activities')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get recent activities',
        description: 'Retrieves recent activity logs for a specific rack',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of activities to retrieve',
        example: 50,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Activities retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Activities retrieved successfully' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx789def012' },
                            eventType: { type: 'string', example: 'WATERING_START' },
                            details: {
                                type: 'string',
                                example: 'Manual watering triggered (5000ms)',
                            },
                            timestamp: { type: 'string', example: '2025-02-01T10:25:00.000Z' },
                        },
                    },
                },
                count: { type: 'number', example: 25 },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack clx123abc456 not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/activities' },
                message: { type: 'string', example: 'Rack clx123abc456 not found or access denied' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/racks/clx123abc456/activities' },
                message: { type: 'string', example: 'Failed to fetch activities' },
            },
        },
    })
    async getActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Param('rackId') rackId: string,
        @Query('limit') limit: number = 50,
    ) {
        const activities = await this.racksService.getRecentActivities(
            rackId,
            user.dbId,
            Number(limit),
        );

        return {
            message: 'Activities retrieved successfully',
            data: activities,
            count: activities.length,
        };
    }
    */
}
