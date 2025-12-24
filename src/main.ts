import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MyLoggerService } from './my-logger/my-logger.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
        logger: false,
    });

    const logger = app.get(MyLoggerService);

    app.useGlobalInterceptors(new HttpLoggingInterceptor(logger));

    app.useGlobalFilters(app.get(AllExceptionsFilter));

    app.enableCors();

    app.setGlobalPrefix('api');

    const configService = app.get<ConfigService>(ConfigService);
    const port = configService.get<number>('PORT') ?? 3000;
    const env = configService.get<string>('NODE_ENV') ?? 'development';

    // 0.0.0.0 for production/Docker, localhost for development
    const host = env === 'production' ? '0.0.0.0' : 'localhost';

    await app.listen(port, host);

    logger.log(`Server running on http://${host}:${port}`, 'Bootstrap');
    logger.log(`Environment: ${env}`, 'Bootstrap');
}

void bootstrap();
