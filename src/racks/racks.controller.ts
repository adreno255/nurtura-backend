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
    ApiInternalServerErrorResponse,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { RacksService } from './racks.service';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';

@ApiTags('Racks')
@ApiBearerAuth('firebase-jwt')
@Controller('racks')
export class RacksController {
    constructor(private readonly racksService: RacksService) {}

    // CRUD Operations

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
    @ApiBadRequestResponse({
        description: 'Invalid MAC address format or validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks' },
                message: {
                    type: 'string',
                    example: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
                },
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
                path: { type: 'string', example: '/api/racks' },
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
                path: { type: 'string', example: '/api/racks' },
                message: { type: 'string', example: 'Failed to register rack' },
            },
        },
    })
    async create(@CurrentUser() user: CurrentUserPayload, @Body() createRackDto: CreateRackDto) {
        return this.racksService.create(user.dbId, createRackDto);
    }

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
                            name: { type: 'string', example: 'Living Room Farm' },
                            macAddress: { type: 'string', example: 'AA:BB:CC:DD:EE:FF' },
                            status: { type: 'string', example: 'ONLINE' },
                            lastSeenAt: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
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
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks' },
                message: { type: 'string', example: 'Failed to fetch racks' },
            },
        },
    })
    async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: PaginationQueryDto) {
        return this.racksService.findAll(user.dbId, query);
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
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Failed to fetch rack details' },
            },
        },
    })
    async findOne(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.findById(rackId, user.dbId);
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
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Validation failed' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456' },
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
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456' },
                message: { type: 'string', example: 'Failed to delete rack' },
            },
        },
    })
    async remove(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.delete(rackId, user.dbId);
    }

    // Current State & Control Operations

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
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456/sensors/current' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/sensors/current' },
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
    @ApiNotFoundResponse({
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456/status' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/status' },
                message: { type: 'string', example: 'Failed to fetch device status' },
            },
        },
    })
    async getStatus(@CurrentUser() user: CurrentUserPayload, @Param('rackId') rackId: string) {
        return this.racksService.getDeviceStatus(rackId, user.dbId);
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/water' },
                message: {
                    type: 'string',
                    example: 'Watering duration must be between 1000ms and 60000ms',
                },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/water' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/water' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/light' },
                message: { type: 'string', example: 'Action must be either "on" or "off"' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/light' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/light' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/sensors' },
                message: { type: 'string', example: 'Action must be either "on" or "off"' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/sensors' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/commands/sensors' },
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
                            eventType: { type: 'string', example: 'WATERING_ON' },
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
        description: 'Rack not found or access denied',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-02-01T10:30:00.000Z' },
                path: { type: 'string', example: '/api/racks/clx123abc456/activities' },
                message: { type: 'string', example: 'Rack not found or access denied' },
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
                path: { type: 'string', example: '/api/racks/clx123abc456/activities' },
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
