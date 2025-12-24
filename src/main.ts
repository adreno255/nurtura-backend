import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MyLoggerService } from './my-logger/my-logger.service';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    app.useLogger(app.get(MyLoggerService));

    app.enableCors();

    app.setGlobalPrefix('api');

    const configService = app.get<ConfigService>(ConfigService);
    const port = configService.get<number>('PORT') ?? 3000;
    const env = configService.get<string>('NODE_ENV') ?? 'development';

    // 0.0.0.0 for production/Docker, localhost for development
    const host = env === 'production' ? '0.0.0.0' : 'localhost';

    await app.listen(port, host);

    console.log(`Server running on http://localhost:${port}`);
    console.log(`Environment: ${env}`);
}

void bootstrap();
