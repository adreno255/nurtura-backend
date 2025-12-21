import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
    constructor(private readonly config: ConfigService) {}

    @Get()
    getStatus() {
        return {
            name: 'Nurtura API Server',
            status: 'ok',
            environment: this.config.get<string>('NODE_ENV') ?? 'development',
            version: '0.0.1',
        };
    }
}
