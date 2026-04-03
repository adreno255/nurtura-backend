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
import { CreatePlantDto, UpdatePlantDto, PlantCategoryQueryDto } from './dto';
import { PlantCategory } from '../generated/prisma';

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
                path: { type: 'string', example: '/plants' },
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
                path: { type: 'string', example: '/plants' },
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
                path: { type: 'string', example: '/plants' },
                message: { type: 'string', example: 'Failed to fetch plants' },
            },
        },
    })
    async findAll(@Query() query: PlantCategoryQueryDto) {
        return this.plantsService.findAll(query);
    }

    @Get(':plantId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get a plant by ID',
        description: 'Retrieves a single plant by its unique ID',
    })
    @ApiParam({ name: 'plantId', description: 'Plant ID', example: 'clx1abc123' })
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to fetch plant' },
            },
        },
    })
    async findOne(@Param('plantId') id: string) {
        return this.plantsService.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new plant in the catalog',
        description: 'Adds a new plant to the catalog with the provided details',
    })
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
                path: { type: 'string', example: '/plants' },
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
                path: { type: 'string', example: '/plants' },
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
                path: { type: 'string', example: '/plants' },
                message: { type: 'string', example: 'Failed to create plant' },
            },
        },
    })
    async create(@Body() dto: CreatePlantDto) {
        return this.plantsService.create(dto);
    }

    @Patch(':plantId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update a plant in the catalog',
        description: 'Updates the details of an existing plant by its ID',
    })
    @ApiParam({ name: 'plantId', description: 'Plant ID', example: 'clx1abc123' })
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to update plant' },
            },
        },
    })
    async update(@Param('plantId') id: string, @Body() dto: UpdatePlantDto) {
        return this.plantsService.update(id, dto);
    }

    @Delete(':plantId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete a plant from the catalog',
        description:
            'Permanently deletes a plant. Blocked if the plant is currently assigned to any rack.',
    })
    @ApiParam({ name: 'plantId', description: 'Plant ID', example: 'clx1abc123' })
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
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
                path: { type: 'string', example: '/plants/clx1abc123' },
                message: { type: 'string', example: 'Failed to delete plant' },
            },
        },
    })
    async remove(@Param('plantId') id: string) {
        return this.plantsService.remove(id);
    }
}
