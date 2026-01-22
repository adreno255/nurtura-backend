/**
 * Test Server Helper
 * Utilities for managing NestJS test server
 */

import { type INestApplication, ValidationPipe, type Type, type Abstract } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { MyLoggerService } from '../../src/my-logger/my-logger.service';
import { HttpLoggingInterceptor } from '../../src/common/interceptors/http-logging.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

interface ProviderOverride {
    provide: string | symbol | (new (...args: any[]) => any) | Type<any> | Abstract<any>;
    useValue: any;
}

interface ModuleOverrides {
    providers?: ProviderOverride[];
}

export class TestServerHelper {
    private app: INestApplication | null = null;

    /**
     * Create and initialize NestJS test application
     */
    async createTestApp(moduleOverrides: ModuleOverrides = {}): Promise<INestApplication> {
        const moduleBuilder = Test.createTestingModule({
            imports: [AppModule],
        });

        if (moduleOverrides.providers) {
            for (const override of moduleOverrides.providers) {
                moduleBuilder.overrideProvider(override.provide).useValue(override.useValue);
            }
        }

        const moduleFixture: TestingModule = await moduleBuilder.compile();
        this.app = moduleFixture.createNestApplication();

        const logger = this.app.get<MyLoggerService>(MyLoggerService);

        this.app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
            }),
        );

        this.app.useGlobalInterceptors(new HttpLoggingInterceptor(logger));

        this.app.useGlobalFilters(this.app.get(AllExceptionsFilter));

        this.app.enableCors();
        this.app.setGlobalPrefix('api');

        await this.app.init();
        return this.app;
    }

    /**
     * Get the current app instance
     */
    getApp(): INestApplication {
        if (!this.app) {
            throw new Error('Test app not initialized. Call createTestApp() first.');
        }
        return this.app;
    }

    /**
     * Close the test application
     */
    async closeApp(): Promise<void> {
        if (this.app) {
            await this.app.close();
            this.app = null;
        }
    }

    /**
     * Get a service from the test application
     */
    getService<T>(
        service: string | symbol | (new (...args: any[]) => any) | Type<T> | Abstract<T>,
    ): T {
        if (!this.app) {
            throw new Error('Test app not initialized. Call createTestApp() first.');
        }
        return this.app.get<T>(service);
    }

    /**
     * Get the HTTP server instance
     */
    getHttpServer(): any {
        if (!this.app) {
            throw new Error('Test app not initialized. Call createTestApp() first.');
        }
        return this.app.getHttpServer();
    }
}
