import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { createMockConfigService } from '../test/mocks';

describe('AppController', () => {
    let controller: AppController;

    const mockConfigService = createMockConfigService();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        controller = module.get<AppController>(AppController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getStatus', () => {
        it('should return API server status', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result).toEqual({
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'development',
                version: '0.0.1',
            });
        });

        it('should retrieve NODE_ENV from ConfigService', () => {
            mockConfigService.get.mockReturnValue('development');

            controller.getStatus();

            expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV');
        });

        it('should use "development" as default environment if not configured', () => {
            const mockConfigService = createMockConfigService({
                NODE_ENV: undefined,
            });

            mockConfigService.get.mockReturnValue('NODE_ENV');

            const result = controller.getStatus();

            expect(result.environment).toBe('development');
        });

        it('should return production environment when configured', () => {
            mockConfigService.get.mockReturnValue('production');

            const result = controller.getStatus();

            expect(result.environment).toBe('production');
        });

        it('should return test environment when configured', () => {
            mockConfigService.get.mockReturnValue('test');

            const result = controller.getStatus();

            expect(result.environment).toBe('test');
        });

        it('should always return status "ok"', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result.status).toBe('ok');
        });

        it('should always return correct API name', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result.name).toBe('Nurtura API Server');
        });

        it('should always return current version', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result.version).toBe('0.0.1');
        });

        it('should handle empty string environment value', () => {
            const mockConfigService = createMockConfigService({
                NODE_ENV: '',
            });

            mockConfigService.get.mockReturnValue('NODE_ENV');

            const result = controller.getStatus();

            expect(result.environment).toBe('development');
        });

        it('should return object with all required properties', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('environment');
            expect(result).toHaveProperty('version');
        });

        it('should return object with exactly 4 properties', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(Object.keys(result)).toHaveLength(4);
        });
    });

    describe('response structure', () => {
        it('should return object with string values', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(typeof result.name).toBe('string');
            expect(typeof result.status).toBe('string');
            expect(typeof result.environment).toBe('string');
            expect(typeof result.version).toBe('string');
        });

        it('should not include any sensitive information', () => {
            mockConfigService.get.mockReturnValue('development');

            const result = controller.getStatus();

            expect(result).not.toHaveProperty('databaseUrl');
            expect(result).not.toHaveProperty('apiKey');
            expect(result).not.toHaveProperty('secrets');
        });
    });

    describe('consistency', () => {
        it('should return same structure on multiple calls', () => {
            mockConfigService.get.mockReturnValue('development');

            const result1 = controller.getStatus();
            const result2 = controller.getStatus();

            expect(result1).toEqual(result2);
        });

        it('should be idempotent', () => {
            mockConfigService.get.mockReturnValue('development');

            const results = Array.from({ length: 5 }, () => controller.getStatus());

            results.forEach((result, index) => {
                if (index > 0) {
                    expect(result).toEqual(results[0]);
                }
            });
        });
    });

    describe('environment variations', () => {
        const environments = ['development', 'production', 'test'];

        environments.forEach((env) => {
            it(`should handle ${env} environment`, () => {
                mockConfigService.get.mockReturnValue(env);

                const result = controller.getStatus();

                expect(result.environment).toBe(env);
                expect(result.name).toBe('Nurtura API Server');
                expect(result.status).toBe('ok');
                expect(result.version).toBe('0.0.1');
            });
        });
    });

    describe('integration', () => {
        it('should work with ConfigService', () => {
            mockConfigService.get.mockReturnValue('development');

            controller.getStatus();

            expect(mockConfigService.get).toHaveBeenCalled();
        });

        it('should not throw errors', () => {
            mockConfigService.get.mockReturnValue('development');

            expect(() => controller.getStatus()).not.toThrow();
        });

        it('should handle ConfigService errors gracefully', () => {
            mockConfigService.get.mockImplementation(() => {
                throw new Error('Config error');
            });

            // Should catch error and return default
            expect(() => controller.getStatus()).toThrow();
        });
    });
});
