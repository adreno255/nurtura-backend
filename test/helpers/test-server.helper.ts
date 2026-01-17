/**
 * Test Server Helper
 * Utilities for managing NestJS test server
 */

import { type INestApplication, ValidationPipe, type Type, type Abstract } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

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

        // 2. Safely iterate through providers
        if (moduleOverrides.providers) {
            for (const override of moduleOverrides.providers) {
                moduleBuilder.overrideProvider(override.provide).useValue(override.useValue);
            }
        }

        const moduleFixture: TestingModule = await moduleBuilder.compile();
        this.app = moduleFixture.createNestApplication();

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
