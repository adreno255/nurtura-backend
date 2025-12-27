import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MyLoggerService } from './my-logger/my-logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
        logger: false,
    });

    const logger = app.get(MyLoggerService);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    app.useGlobalInterceptors(new HttpLoggingInterceptor(logger));

    app.useGlobalFilters(app.get(AllExceptionsFilter));

    app.enableCors();

    app.setGlobalPrefix('api');

    const config = new DocumentBuilder()
        .setTitle('Nurtura API')
        .setDescription('API documentation for Nurtura platform')
        .setVersion('0.0.1')
        .addTag('System', 'Entry endpoint of the API server')
        .addTag('Authentication', 'User authentication and authorization endpoints')
        .addTag('Authentication - OTP', 'OTP verification and management')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api/docs', app, document, {
        customSiteTitle: 'Nurtura API Docs',
    });

    const configService = app.get<ConfigService>(ConfigService);
    const port = configService.get<number>('PORT') ?? 3000;
    const env = configService.get<string>('NODE_ENV') ?? 'development';

    // 0.0.0.0 for production/Docker, localhost for development
    const host = env === 'production' ? '0.0.0.0' : 'localhost';

    await app.listen(port, host);

    logger.log(`Server running on http://${host}:${port}`, 'Bootstrap');
    logger.log(`Swagger docs available at http://${host}:${port}/api/docs`, 'Bootstrap');
    logger.log(`Environment: ${env}`, 'Bootstrap');
}

void bootstrap();
