import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('AppService', () => {
    let service: AppService;

    const mockConfigService = {
        get: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<AppService>(AppService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getStatus', () => {
        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
        });

        it('should return API server status with version from package.json', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.2.3' }));

            const result = service.getStatus();

            expect(result).toEqual({
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'development',
                version: '1.2.3',
            });
        });

        it('should retrieve NODE_ENV from ConfigService', () => {
            mockConfigService.get.mockReturnValue('production');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            service.getStatus();

            expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV');
        });

        it('should use "development" as default environment if not configured', () => {
            mockConfigService.get.mockReturnValue(undefined);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.environment).toBe('development');
        });

        it('should return production environment when configured', () => {
            mockConfigService.get.mockReturnValue('production');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.environment).toBe('production');
        });

        it('should return test environment when configured', () => {
            mockConfigService.get.mockReturnValue('test');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.environment).toBe('test');
        });

        it('should always return status "ok"', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.status).toBe('ok');
        });

        it('should always return correct API name', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.name).toBe('Nurtura API Server');
        });

        it('should read version from package.json', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '2.5.1' }));

            const result = service.getStatus();

            expect(result.version).toBe('2.5.1');
            expect(fs.readFileSync).toHaveBeenCalledWith('/mock/path/package.json', 'utf-8');
        });

        it('should use process.cwd() to locate package.json', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            service.getStatus();

            expect(jest.spyOn(path, 'join')).toHaveBeenCalledWith(process.cwd(), 'package.json');
        });

        it('should return "unknown" version if package.json cannot be read', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('File not found');
            });

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should return "unknown" version if package.json is invalid JSON', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should return "unknown" version if version property is missing', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(
                JSON.stringify({ name: 'test-package' }),
            );

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should handle empty string environment value', () => {
            mockConfigService.get.mockReturnValue(null);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.environment).toBe('development');
        });

        it('should return object with all required properties', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('environment');
            expect(result).toHaveProperty('version');
        });

        it('should return object with exactly 4 properties', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(Object.keys(result)).toHaveLength(4);
        });
    });

    describe('response structure', () => {
        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
        });

        it('should return object with string values', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(typeof result.name).toBe('string');
            expect(typeof result.status).toBe('string');
            expect(typeof result.environment).toBe('string');
            expect(typeof result.version).toBe('string');
        });

        it('should not include any sensitive information', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result).not.toHaveProperty('databaseUrl');
            expect(result).not.toHaveProperty('apiKey');
            expect(result).not.toHaveProperty('secrets');
        });
    });

    describe('consistency', () => {
        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
        });

        it('should return same structure on multiple calls', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result1 = service.getStatus();
            const result2 = service.getStatus();

            expect(result1).toEqual(result2);
        });

        it('should be idempotent', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const results = Array.from({ length: 5 }, () => service.getStatus());

            results.forEach((result, index) => {
                if (index > 0) {
                    expect(result).toEqual(results[0]);
                }
            });
        });
    });

    describe('environment variations', () => {
        const environments = ['development', 'production', 'test'];

        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
        });

        environments.forEach((env) => {
            it(`should handle ${env} environment`, () => {
                mockConfigService.get.mockReturnValue(env);

                const result = service.getStatus();

                expect(result.environment).toBe(env);
                expect(result.name).toBe('Nurtura API Server');
                expect(result.status).toBe('ok');
                expect(result.version).toBe('1.0.0');
            });
        });
    });

    describe('version reading edge cases', () => {
        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
            mockConfigService.get.mockReturnValue('development');
        });

        it('should handle file system errors gracefully', () => {
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT: no such file or directory');
            });

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should handle JSON parse errors gracefully', () => {
            (fs.readFileSync as jest.Mock).mockReturnValue('{invalid json}');

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should handle empty package.json', () => {
            (fs.readFileSync as jest.Mock).mockReturnValue('{}');

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should handle package.json with null version', () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: null }));

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });

        it('should handle permission errors', () => {
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('EACCES: permission denied');
            });

            const result = service.getStatus();

            expect(result.version).toBe('unknown');
        });
    });

    describe('integration', () => {
        beforeEach(() => {
            (path.join as jest.Mock).mockReturnValue('/mock/path/package.json');
        });

        it('should work with ConfigService', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            service.getStatus();

            expect(mockConfigService.get).toHaveBeenCalled();
        });

        it('should not throw errors on successful execution', () => {
            mockConfigService.get.mockReturnValue('development');
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            expect(() => service.getStatus()).not.toThrow();
        });

        it('should handle ConfigService returning null', () => {
            mockConfigService.get.mockReturnValue(null);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

            const result = service.getStatus();

            expect(result.environment).toBe('development');
        });
    });
});
