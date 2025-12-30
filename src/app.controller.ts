import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';

@Public()
@ApiTags('System')
@Controller()
export class AppController {
    constructor(private readonly config: ConfigService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'API server status check',
        description: 'Returns server status and environment information',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Server is running',
        schema: {
            example: {
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'development',
                version: '0.0.1',
            },
        },
    })
    getStatus() {
        return {
            name: 'Nurtura API Server',
            status: 'ok',
            environment: this.config.get<string>('NODE_ENV') ?? 'development',
            version: '0.0.1',
        };
    }
}
