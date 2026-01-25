import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MyLoggerService } from './my-logger/my-logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { type NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bufferLogs: true,
    });

    const configService = app.get<ConfigService>(ConfigService);
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

    const isProduction = configService.get('NODE_ENV') === 'production';

    if (isProduction) {
        app.set('trust proxy', 1);
        logger.bootstrap(
            'Trust proxy enabled for rate limiting / client IP detection',
            'Bootstrap',
        );
    } else {
        const config = new DocumentBuilder()
            .setTitle('Nurtura API')
            .setDescription('API documentation for Nurtura platform')
            .setVersion('0.0.1')
            .addTag('System', 'Entry endpoint of the API server')
            .addTag('Authentication', 'User authentication and authorization endpoints')
            .addTag('Authentication - OTP', 'OTP verification and management')
            .addTag('Users', 'User profile management')
            .addBearerAuth(
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    name: 'Firebase ID Token',
                    description: 'Enter Firebase ID Token (obtained from Firebase Authentication)',
                    in: 'header',
                },
                'firebase-jwt',
            )
            .build();

        const document = SwaggerModule.createDocument(app, config);

        SwaggerModule.setup('api/docs', app, document, {
            customSiteTitle: 'Nurtura API Docs',
        });
    }

    const port = configService.get<number>('PORT') ?? 3000;
    const env = configService.get<string>('NODE_ENV') ?? 'development';
    const host = configService.get<string>('HOST') ?? 'localhost';

    await app.listen(port, host);

    logger.bootstrap(`Server running on http://${host}:${port}`, 'Bootstrap');
    logger.bootstrap(`Environment: ${env}`, 'Bootstrap');
    if (!isProduction)
        logger.bootstrap(`Swagger docs available at http://${host}:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
