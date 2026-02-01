import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { SensorsService } from './sensors.service';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
// import { CurrentUser } from '../common/decorators';
// import { type CurrentUserPayload } from '../common/interfaces';

@ApiTags('Sensors')
@ApiBearerAuth('firebase-jwt')
@UseGuards(FirebaseAuthGuard)
@Controller('sensors')
export class SensorsController {
    constructor(private readonly sensorsService: SensorsService) {}

    @Get(':rackId/latest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get latest sensor reading',
        description: 'Retrieves the most recent sensor reading for a specific rack',
    })
    @ApiParam({
        name: 'rackId',
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Latest sensor reading retrieved successfully',
    })
    async getLatest(@Param('rackId') rackId: string /* @CurrentUser() user: CurrentUserPayload */) {
        // TODO: Verify user owns this rack
        const reading = await this.sensorsService.getLatestReading(rackId);

        return {
            message: 'Latest sensor reading retrieved',
            data: reading,
        };
    }

    @Get(':rackId/history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get sensor reading history',
        description: 'Retrieves historical sensor readings for a specific rack',
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
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sensor reading history retrieved successfully',
    })
    async getHistory(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        // @CurrentUser() user: CurrentUserPayload,
    ) {
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
        description: 'Retrieves hourly aggregated sensor data for analytics',
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
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Aggregated sensor data retrieved successfully',
    })
    async getAggregated(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        // @CurrentUser() user: CurrentUserPayload,
    ) {
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
        description: 'Retrieves statistical analysis of sensor readings',
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
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sensor statistics retrieved successfully',
    })
    async getStatistics(
        @Param('rackId') rackId: string,
        @Query('hours') hours: number = 24,
        // @CurrentUser() user: CurrentUserPayload,
    ) {
        const stats = await this.sensorsService.getStatistics(rackId, Number(hours));

        return {
            message: 'Sensor statistics retrieved',
            data: stats,
        };
    }
}
