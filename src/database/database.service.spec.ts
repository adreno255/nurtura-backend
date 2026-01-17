import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable } from '@nestjs/common';
import { createMockConfigService } from '../../test/mocks';

// Mock pg Pool
jest.mock('pg', () => {
    const mockPool = {
        connect: jest.fn(),
        end: jest.fn(),
        query: jest.fn(),
    };
    return {
        Pool: jest.fn(() => mockPool),
    };
});

// Mock PrismaClient
jest.mock('../generated/prisma/client', () => {
    class PrismaClient {
        $connect = jest.fn().mockResolvedValue(undefined);
        $disconnect = jest.fn().mockResolvedValue(undefined);

        user = {};
        rack = {};
        plant = {};
        activity = {};
        notification = {};
        sensorReading = {};
        aggregatedSensorReading = {};
        automationRule = {};
    }

    return { PrismaClient };
});

// Mock PrismaPg adapter
jest.mock('@prisma/adapter-pg', () => {
    return {
        PrismaPg: jest.fn().mockImplementation(() => ({})),
    };
});

describe('DatabaseService', () => {
    let service: DatabaseService;

    const mockConfigService = createMockConfigService();

    beforeEach(async () => {
        // Clear all mocks
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DatabaseService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<DatabaseService>(DatabaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('constructor', () => {
        it('should retrieve DATABASE_URL from ConfigService', () => {
            expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_URL');
        });

        it('should create Pool with connection string', () => {
            expect(Pool).toHaveBeenCalledWith({
                connectionString: mockConfigService.get('DATABASE_URL'),
            });
        });

        it('should extend PrismaClient', () => {
            expect(service).toBeInstanceOf(PrismaClient);
        });

        it('should have all Prisma models available', () => {
            expect(service.user).toBeDefined();
            expect(service.rack).toBeDefined();
            expect(service.plant).toBeDefined();
            expect(service.activity).toBeDefined();
            expect(service.notification).toBeDefined();
            expect(service.sensorReading).toBeDefined();
            expect(service.aggregatedSensorReading).toBeDefined();
            expect(service.automationRule).toBeDefined();
        });
    });

    describe('onModuleInit', () => {
        it('should connect to database on module initialization', async () => {
            const connectSpy = jest.spyOn(service, '$connect');

            await service.onModuleInit();

            expect(connectSpy).toHaveBeenCalledTimes(1);
        });

        it('should handle connection success', async () => {
            const connectSpy = jest.spyOn(service, '$connect').mockResolvedValueOnce(undefined);

            await expect(service.onModuleInit()).resolves.not.toThrow();

            connectSpy.mockRestore();
        });

        it('should propagate connection errors', async () => {
            const connectionError = new Error('Connection failed');
            const connectSpy = jest
                .spyOn(service, '$connect')
                .mockRejectedValueOnce(connectionError);

            await expect(service.onModuleInit()).rejects.toThrow('Connection failed');

            connectSpy.mockRestore();
        });

        it('should handle timeout errors', async () => {
            const timeoutError = new Error('Connection timeout');
            const connectSpy = jest.spyOn(service, '$connect').mockRejectedValueOnce(timeoutError);

            await expect(service.onModuleInit()).rejects.toThrow('Connection timeout');

            connectSpy.mockRestore();
        });
    });

    describe('onModuleDestroy', () => {
        it('should disconnect from database on module destruction', async () => {
            const disconnectSpy = jest.spyOn(service, '$disconnect');

            await service.onModuleDestroy();

            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        });

        it('should handle disconnection success', async () => {
            const disconnectSpy = jest
                .spyOn(service, '$disconnect')
                .mockResolvedValueOnce(undefined);

            await expect(service.onModuleDestroy()).resolves.not.toThrow();

            disconnectSpy.mockRestore();
        });

        it('should handle disconnection errors gracefully', async () => {
            const disconnectError = new Error('Disconnect failed');
            const disconnectSpy = jest
                .spyOn(service, '$disconnect')
                .mockRejectedValueOnce(disconnectError);

            await expect(service.onModuleDestroy()).rejects.toThrow('Disconnect failed');

            disconnectSpy.mockRestore();
        });
    });

    describe('lifecycle', () => {
        it('should connect before disconnect', async () => {
            const calls: string[] = [];

            jest.spyOn(service, '$connect').mockImplementation(() => {
                calls.push('connect');
                return Promise.resolve();
            });

            jest.spyOn(service, '$disconnect').mockImplementation(() => {
                calls.push('disconnect');
                return Promise.resolve();
            });

            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(calls).toEqual(['connect', 'disconnect']);
        });

        it('should allow multiple connect/disconnect cycles', async () => {
            const connectSpy = jest.spyOn(service, '$connect');
            const disconnectSpy = jest.spyOn(service, '$disconnect');

            await service.onModuleInit();
            await service.onModuleDestroy();
            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(connectSpy).toHaveBeenCalledTimes(2);
            expect(disconnectSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('database operations', () => {
        it('should have Prisma client methods available', () => {
            expect(typeof service.$connect).toBe('function');
            expect(typeof service.$disconnect).toBe('function');
        });

        it('should provide access to all models', () => {
            const models = [
                'user',
                'rack',
                'plant',
                'activity',
                'notification',
                'sensorReading',
                'aggregatedSensorReading',
                'automationRule',
            ];

            models.forEach((model) => {
                expect(service).toHaveProperty(model);
            });
        });
    });

    describe('error scenarios', () => {
        it('should handle invalid connection string', async () => {
            const invalidConfigService = {
                get: jest.fn(() => 'invalid-connection-string'),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    DatabaseService,
                    {
                        provide: ConfigService,
                        useValue: invalidConfigService,
                    },
                ],
            }).compile();

            const invalidService = module.get<DatabaseService>(DatabaseService);

            expect(invalidService).toBeDefined();
        });

        it('should handle missing DATABASE_URL', async () => {
            const emptyConfigService = {
                get: jest.fn(() => undefined),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    DatabaseService,
                    {
                        provide: ConfigService,
                        useValue: emptyConfigService,
                    },
                ],
            }).compile();

            module.get(DatabaseService);

            expect(Pool).toHaveBeenCalledWith({
                connectionString: undefined,
            });
        });
    });

    describe('adapter configuration', () => {
        it('should use PrismaPg adapter', () => {
            expect(PrismaPg).toHaveBeenCalled();
        });

        it('should pass Pool instance to adapter', () => {
            const MockedPool = Pool as jest.MockedClass<typeof Pool>;
            const mockResults = MockedPool.mock.results;

            if (mockResults.length > 0) {
                const lastResult = mockResults[mockResults.length - 1];
                expect(PrismaPg).toHaveBeenCalledWith(lastResult.value);
            }
        });
    });

    describe('integration points', () => {
        it('should be injectable as a provider', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    DatabaseService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => mockConfigService.get('DATABASE_URL')),
                        },
                    },
                ],
            }).compile();

            const injectedService = module.get<DatabaseService>(DatabaseService);
            expect(injectedService).toBeInstanceOf(DatabaseService);
        });

        it('should work with dependency injection', async () => {
            @Injectable()
            class TestService {
                constructor(private readonly db: DatabaseService) {}

                getDb() {
                    return this.db;
                }
            }

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TestService,
                    DatabaseService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => mockConfigService.get('DATABASE_URL')),
                        },
                    },
                ],
            }).compile();

            const testService = module.get<TestService>(TestService);
            const db = testService.getDb();

            expect(db).toBeInstanceOf(DatabaseService);
        });
    });

    describe('connection pooling', () => {
        it('should configure connection pool via pg.Pool', () => {
            expect(Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    connectionString: mockConfigService.get('DATABASE_URL'),
                }),
            );
        });

        it('should use adapter for connection pooling', () => {
            expect(PrismaPg).toHaveBeenCalled();
        });
    });
});
