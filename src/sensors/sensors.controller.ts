import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiNotFoundResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { SensorsService } from './sensors.service';
import { CurrentUser } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';
import { RacksService } from '../racks/racks.service';

@ApiTags('Sensors')
@ApiBearerAuth('firebase-jwt')
@Controller('sensors')
export class SensorsController {
    constructor(
        private readonly sensorsService: SensorsService,
        private readonly racksService: RacksService,
    ) {}

    @Get(':rackId/history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get sensor reading history',
        description: 'Retrieves historical sensor readings for a specific rack over a time period',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'hours',
        required: false,
        description: 'Number of hours of history to retrieve',
        example: 24,
        type: Number,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sensor reading history retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Sensor reading history retrieved' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx789def012' },
                            temperature: { type: 'number', example: 25.5 },
                            humidity: { type: 'number', example: 65.2 },
                            moisture: { type: 'number', example: 45.8 },
                            lightLevel: { type: 'number', example: 850 },
                            timestamp: { type: 'string', example: '2025-02-01T10:00:00.000Z' },
                        },
                    },
                },
                count: { type: 'number', example: 48 },
                periodHours: { type: 'number', example: 24 },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/history' },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/history' },
                message: { type: 'string', example: 'Failed to fetch sensor history' },
            },
        },
    })
    async getHistory(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        await this.racksService.verifyRackOwnership(rackId, user.firebaseUid);
        const readings = await this.sensorsService.getHistory(rackId, Number(hours));

        return {
            message: 'Sensor reading history retrieved',
            data: readings,
            count: readings.length,
            periodHours: Number(hours),
        };
    }

    @Get(':rackId/aggregated')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get aggregated sensor data',
        description: 'Retrieves hourly aggregated sensor data for analytics and charts',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'hours',
        required: false,
        description: 'Number of hours of aggregated data to retrieve',
        example: 24,
        type: Number,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Aggregated sensor data retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Aggregated sensor data retrieved' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx789def012' },
                            hour: { type: 'string', example: '2025-02-01T10:00:00.000Z' },
                            avgTemperature: { type: 'number', example: 25.5 },
                            avgHumidity: { type: 'number', example: 65.2 },
                            avgMoisture: { type: 'number', example: 45.8 },
                            avgLightLevel: { type: 'number', example: 850 },
                            minTemperature: { type: 'number', example: 24.0 },
                            maxTemperature: { type: 'number', example: 27.0 },
                            minMoisture: { type: 'number', example: 40.0 },
                            maxMoisture: { type: 'number', example: 50.0 },
                            readingCount: { type: 'number', example: 60 },
                        },
                    },
                },
                count: { type: 'number', example: 24 },
                periodHours: { type: 'number', example: 24 },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/aggregated' },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/aggregated' },
                message: { type: 'string', example: 'Failed to fetch aggregated data' },
            },
        },
    })
    async getAggregated(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        await this.racksService.verifyRackOwnership(rackId, user.firebaseUid);
        const data = await this.sensorsService.getAggregatedData(rackId, Number(hours));

        return {
            message: 'Aggregated sensor data retrieved',
            data,
            count: data.length,
            periodHours: Number(hours),
        };
    }

    @Get(':rackId/statistics')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get sensor statistics',
        description: 'Retrieves statistical analysis of sensor readings (min, max, avg, median)',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiQuery({
        name: 'hours',
        required: false,
        description: 'Number of hours to analyze',
        example: 24,
        type: Number,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sensor statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Sensor statistics retrieved' },
                data: {
                    type: 'object',
                    properties: {
                        temperature: {
                            type: 'object',
                            properties: {
                                min: { type: 'number', example: 22.0 },
                                max: { type: 'number', example: 28.0 },
                                avg: { type: 'number', example: 25.5 },
                                median: { type: 'number', example: 25.0 },
                                count: { type: 'number', example: 48 },
                            },
                        },
                        humidity: {
                            type: 'object',
                            properties: {
                                min: { type: 'number', example: 60.0 },
                                max: { type: 'number', example: 70.0 },
                                avg: { type: 'number', example: 65.2 },
                                median: { type: 'number', example: 65.0 },
                                count: { type: 'number', example: 48 },
                            },
                        },
                        moisture: {
                            type: 'object',
                            properties: {
                                min: { type: 'number', example: 40.0 },
                                max: { type: 'number', example: 50.0 },
                                avg: { type: 'number', example: 45.8 },
                                median: { type: 'number', example: 46.0 },
                                count: { type: 'number', example: 48 },
                            },
                        },
                        lightLevel: {
                            type: 'object',
                            properties: {
                                min: { type: 'number', example: 500 },
                                max: { type: 'number', example: 1200 },
                                avg: { type: 'number', example: 850 },
                                median: { type: 'number', example: 800 },
                                count: { type: 'number', example: 48 },
                            },
                        },
                        totalReadings: { type: 'number', example: 48 },
                        periodHours: { type: 'number', example: 24 },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/statistics' },
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
                path: { type: 'string', example: '/api/sensors/clx123abc456/statistics' },
                message: { type: 'string', example: 'Failed to calculate statistics' },
            },
        },
    })
    async getStatistics(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        await this.racksService.verifyRackOwnership(rackId, user.firebaseUid);
        const stats = await this.sensorsService.getStatistics(rackId, Number(hours));

        return {
            message: 'Sensor statistics retrieved',
            data: stats,
        };
    }
}
