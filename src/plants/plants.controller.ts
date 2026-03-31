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
    ApiParam,
    ApiQuery,
    ApiUnauthorizedResponse,
    ApiNotFoundResponse,
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { PlantsService } from './plants.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type CurrentUserPayload } from '../common/interfaces';
import { CreatePlantDto, UpdatePlantDto, AssignPlantToRackDto, PlantCategoryQueryDto } from './dto';
import { PlantCategory } from '../generated/prisma';
import { ActivityQueryDto } from '../common/dto/activity-query.dto';

@ApiTags('Plants')
@ApiBearerAuth('firebase-jwt')
@Controller('plants')
export class PlantsController {
    constructor(private readonly plantsService: PlantsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get all plants in the catalog',
        description:
            'Retrieves a paginated list of plants with optional filtering by type and active status',
    })
    @ApiQuery({
        name: 'category',
        enum: PlantCategory,
        required: false,
        description: 'Filter by plant category',
    })
    @ApiQuery({
        name: 'isActive',
        type: Boolean,
        required: false,
        description: 'Filter by active status',
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
        description: 'Plants retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx1abc123' },
                            name: { type: 'string', example: 'Lettuce' },
                            type: { type: 'string', nullable: true, example: 'LEAFY_GREENS' },
                            recommendedSoil: { type: 'string', nullable: true, example: 'LOAMY' },
                            description: {
                                type: 'string',
                                nullable: true,
                                example: 'A crispy leafy green perfect for salads.',
                            },
                            isActive: { type: 'boolean', example: true },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                                example: '2026-01-15T08:00:00.000Z',
                            },
                            updatedAt: {
                                type: 'string',
                                format: 'date-time',
                                example: '2026-01-15T08:00:00.000Z',
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
        description: 'Invalid query error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/plants' },
                message: {
                    type: 'string',
                    example:
                        'Page and limit query parameters must be positive integers, and type must be a valid PlantCategory enum value',
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
                path: { type: 'string', example: '/api/plants' },
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants' },
                message: { type: 'string', example: 'Failed to fetch plants' },
            },
        },
    })
    async findAll(@Query() query: PlantCategoryQueryDto) {
        return this.plantsService.findAll(query);
    }

    @Get('activities/planting')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get planting activity',
        description:
            'Retrieves plant assignment history (RackPlantingHistory) across all racks owned by the authenticated user. Supports date range filtering on plantedAt.',
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
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx999hist001' },
                            rackId: { type: 'string', example: 'clx123abc456' },
                            plantId: { type: 'string', example: 'clx000plant123' },
                            quantity: { type: 'number', example: 10 },
                            plantedAt: { type: 'string', example: '2025-01-01T08:00:00.000Z' },
                            harvestedAt: {
                                type: 'string',
                                example: '2025-02-01T08:00:00.000Z',
                                nullable: true,
                            },
                            harvestCount: { type: 'number', example: 3 },
                            plant: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string', example: 'Lettuce' },
                                    category: { type: 'string', example: 'LEAFY_GREENS' },
                                },
                            },
                            rack: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string', example: 'Living Room Farm' },
                                    macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
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
                amount: {
                    type: 'number',
                    description: 'Total number of planting records in the filtered date range',
                    example: 5,
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
                path: { type: 'string', example: '/api/plants/activities/planting' },
                message: { type: 'string', example: 'Failed to fetch planting activities' },
            },
        },
    })
    async getPlantingActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.plantsService.getPlantingActivities(user.dbId, query);
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get a plant by ID' })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Plant retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant retrieved successfully' },
                plant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx1abc123' },
                        name: { type: 'string', example: 'Lettuce' },
                        type: { type: 'string', nullable: true, example: 'LEAFY_GREENS' },
                        recommendedSoil: { type: 'string', nullable: true, example: 'LOAMY' },
                        description: {
                            type: 'string',
                            nullable: true,
                            example: 'A crispy leafy green perfect for salads.',
                        },
                        isActive: { type: 'boolean', example: true },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:00:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:00:00.000Z',
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Plant not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Plant with ID clx1abc123 not found' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to fetch plant' },
            },
        },
    })
    async findOne(@Param('id') id: string) {
        return this.plantsService.findOne(id);
    }

    @Get('activities/care')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get plant care activity',
        description:
            'Retrieves watering and grow light activities (WATERING_ON, WATERING_OFF, LIGHT_ON, LIGHT_OFF) across all racks owned by the authenticated user. Supports date range filtering.',
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
                            eventType: { type: 'string', example: 'WATERING_ON' },
                            details: {
                                type: 'string',
                                example: 'Watering started - Moisture below threshold',
                            },
                            metadata: { type: 'object', nullable: true },
                            timestamp: { type: 'string', example: '2025-02-05T14:30:00.000Z' },
                            rack: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', example: 'clx123abc456' },
                                    name: { type: 'string', example: 'Living Room Farm' },
                                    macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                                    currentPlant: {
                                        type: 'object',
                                        nullable: true,
                                        properties: {
                                            id: { type: 'string', example: 'clx000plant123' },
                                            name: { type: 'string', example: 'Lettuce' },
                                            category: { type: 'string', example: 'LEAFY_GREENS' },
                                        },
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
                amount: {
                    type: 'number',
                    description: 'Total number of plant care events in the filtered date range',
                    example: 42,
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
                path: { type: 'string', example: '/api/plants/activities/care' },
                message: { type: 'string', example: 'Failed to fetch plant care activities' },
            },
        },
    })
    async getPlantCareActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.plantsService.getPlantCareActivities(user.dbId, query);
    }

    @Get('activities/harvest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get harvest activity',
        description:
            'Retrieves harvest activities (PLANT_HARVESTED) across all racks owned by the authenticated user. Supports date range filtering. Also returns `totalHarvestCount` — the sum of harvested quantities within the date range.',
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
                                    plantId: { type: 'string' },
                                    plantName: { type: 'string' },
                                    rackId: { type: 'string' },
                                    rackName: { type: 'string' },
                                    harvestCount: { type: 'number' },
                                    quantity: {
                                        type: 'number',
                                        description: 'Number of plants/heads harvested',
                                    },
                                },
                                nullable: true,
                            },
                            timestamp: { type: 'string', example: '2025-02-05T14:30:00.000Z' },
                            rack: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', example: 'clx123abc456' },
                                    name: { type: 'string', example: 'Living Room Farm' },
                                    macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                                    currentPlant: {
                                        type: 'object',
                                        nullable: true,
                                        properties: {
                                            id: { type: 'string', example: 'clx000plant123' },
                                            name: { type: 'string', example: 'Lettuce' },
                                            category: { type: 'string', example: 'LEAFY_GREENS' },
                                        },
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
                        totalItems: { type: 'number', example: 15 },
                        totalPages: { type: 'number', example: 2 },
                        hasNextPage: { type: 'boolean', example: true },
                        hasPreviousPage: { type: 'boolean', example: false },
                    },
                },
                amount: {
                    type: 'number',
                    description: 'Total number of harvest events in the filtered date range',
                    example: 15,
                },
                totalHarvestCount: {
                    type: 'number',
                    description: 'Total pieces/heads harvested across all events in the date range',
                    example: 150,
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
                path: { type: 'string', example: '/api/plants/activities/harvest' },
                message: { type: 'string', example: 'Failed to fetch harvest activities' },
            },
        },
    })
    async getHarvestActivities(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: ActivityQueryDto,
    ) {
        return this.plantsService.getHarvestActivities(user.dbId, query);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new plant in the catalog' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Plant created successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant created successfully' },
                plant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx1abc123' },
                        name: { type: 'string', example: 'Lettuce' },
                        type: { type: 'string', nullable: true, example: 'LEAFY_GREENS' },
                        recommendedSoil: { type: 'string', nullable: true, example: 'LOAMY' },
                        description: {
                            type: 'string',
                            nullable: true,
                            example: 'A crispy leafy green perfect for salads.',
                        },
                        isActive: { type: 'boolean', example: true },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:00:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:00:00.000Z',
                        },
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants' },
                message: {
                    type: 'string',
                    example:
                        'type must be one of the following values: LEAFY_GREENS, TROPICAL_GREENS, HERBS, ROOT_AND_STALK',
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
                path: { type: 'string', example: '/api/plants' },
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants' },
                message: { type: 'string', example: 'Failed to create plant' },
            },
        },
    })
    async create(@Body() dto: CreatePlantDto) {
        return this.plantsService.create(dto);
    }

    @Post(':id/assign')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Assign a plant to a rack',
        description:
            'Assigns this plant to the specified rack. If the rack already has a different plant, it is recorded as removed (PLANT_REMOVED + PLANT_CHANGED). If the rack is empty, the event is PLANT_ADDED.',
    })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
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
                path: { type: 'string', example: '/api/plants/clx1abc123/assign' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/assign' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/assign' },
                message: { type: 'string', example: 'Rack not found or does not belong to you' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/assign' },
                message: { type: 'string', example: 'Failed to assign plant to rack' },
            },
        },
    })
    async assignToRack(
        @Param('id') id: string,
        @Body() dto: AssignPlantToRackDto,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.plantsService.assignToRack(id, user.dbId, dto);
    }

    @Post(':id/racks/:rackId/harvest')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Harvest a plant from a rack',
        description:
            'Marks the plant as successfully harvested and clears the rack. Increments the harvest count and logs a PLANT_HARVESTED activity.',
    })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx2def456' })
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
                path: {
                    type: 'string',
                    example: '/api/plants/clx1abc123/racks/clx2def456/harvest',
                },
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
                path: {
                    type: 'string',
                    example: '/api/plants/clx1abc123/racks/clx2def456/harvest',
                },
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
                path: {
                    type: 'string',
                    example: '/api/plants/clx1abc123/racks/clx2def456/harvest',
                },
                message: { type: 'string', example: 'Rack not found or does not belong to you' },
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
                path: {
                    type: 'string',
                    example: '/api/plants/clx1abc123/racks/clx2def456/harvest',
                },
                message: { type: 'string', example: 'Failed to harvest plant' },
            },
        },
    })
    async harvestFromRack(
        @Param('id') id: string,
        @Param('rackId') rackId: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.plantsService.harvestFromRack(id, rackId, user.dbId);
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update a plant in the catalog' })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Plant updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant updated successfully' },
                plant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx1abc123' },
                        name: { type: 'string', example: 'Basil' },
                        type: { type: 'string', nullable: true, example: 'HERBS' },
                        recommendedSoil: { type: 'string', nullable: true, example: 'PEATY' },
                        description: {
                            type: 'string',
                            nullable: true,
                            example: 'An aromatic herb used in Italian cuisine.',
                        },
                        isActive: { type: 'boolean', example: true },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:00:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-02-01T10:30:00.000Z',
                        },
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
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: {
                    type: 'string',
                    example: 'name must be shorter than or equal to 200 characters',
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Plant not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Plant with ID clx1abc123 not found' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to update plant' },
            },
        },
    })
    async update(@Param('id') id: string, @Body() dto: UpdatePlantDto) {
        return this.plantsService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete a plant from the catalog',
        description:
            'Permanently deletes a plant. Blocked if the plant is currently assigned to any rack.',
    })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Plant deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Plant deleted successfully' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Plant not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Plant with ID clx1abc123 not found' },
            },
        },
    })
    @ApiConflictResponse({
        description: 'Plant is currently assigned to one or more racks',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: {
                    type: 'string',
                    example:
                        'Cannot delete a plant that is currently assigned to one or more racks. Remove it from all racks first.',
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
                path: { type: 'string', example: '/api/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to delete plant' },
            },
        },
    })
    async remove(@Param('id') id: string) {
        return this.plantsService.remove(id);
    }

    @Delete(':id/racks/:rackId/remove')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Remove a plant from a rack without harvesting',
        description:
            'Removes the plant from the rack without harvesting — used for failure or early removal cases. Logs a PLANT_REMOVED activity.',
    })
    @ApiParam({ name: 'id', description: 'Plant ID', example: 'clx1abc123' })
    @ApiParam({ name: 'rackId', description: 'Rack ID', example: 'clx2def456' })
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
                path: { type: 'string', example: '/api/plants/clx1abc123/racks/clx2def456/remove' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/racks/clx2def456/remove' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/racks/clx2def456/remove' },
                message: { type: 'string', example: 'Rack not found or does not belong to you' },
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
                path: { type: 'string', example: '/api/plants/clx1abc123/racks/clx2def456/remove' },
                message: { type: 'string', example: 'Failed to remove plant from rack' },
            },
        },
    })
    async removeFromRack(
        @Param('id') id: string,
        @Param('rackId') rackId: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.plantsService.removeFromRack(id, rackId, user.dbId);
    }
}
