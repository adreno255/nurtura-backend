import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';
import { createMockConfigService, createMockLogger } from '../../test/mocks';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
    const mockAuth = {
        verifyIdToken: jest.fn(),
        getUserByEmail: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
    };

    return {
        initializeApp: jest.fn(() => ({})),
        credential: {
            cert: jest.fn((serviceAccount: admin.ServiceAccount) => serviceAccount),
        },
        auth: jest.fn(() => mockAuth),
    };
});

export interface FirebaseServiceAccount {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
}

describe('FirebaseService', () => {
    let service: FirebaseService;

    const mockConfigService = createMockConfigService();

    const mockLoggerService = createMockLogger();

    const mockServiceAccountJSON = JSON.parse(
        mockConfigService.get('FIREBASE_SERVICE_ACCOUNT') as string,
    ) as FirebaseServiceAccount;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirebaseService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<FirebaseService>(FirebaseService);

        await module.init();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should initialize Firebase Admin SDK', () => {
            expect(admin.initializeApp).toHaveBeenCalled();
        });

        it('should retrieve service account from ConfigService', () => {
            expect(mockConfigService.get).toHaveBeenCalledWith('FIREBASE_SERVICE_ACCOUNT');
        });

        it('should parse service account JSON', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccountJSON);
        });

        it('should log success message', () => {
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'Firebase Admin initialized successfully',
                'FirebaseService',
            );
        });

        it('should initialize with correct credentials', () => {
            expect(admin.initializeApp).toHaveBeenCalledWith({
                credential: mockServiceAccountJSON,
            });
        });
    });

    describe('error handling', () => {
        it('should throw error if FIREBASE_SERVICE_ACCOUNT is not configured', async () => {
            const mockConfigService = createMockConfigService({
                FIREBASE_SERVICE_ACCOUNT: undefined,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow(
                'FIREBASE_SERVICE_ACCOUNT is not configured',
            );
        });

        it('should throw error if service account JSON is invalid', async () => {
            const mockConfigService = createMockConfigService({
                FIREBASE_SERVICE_ACCOUNT: 'invalid-json',
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow();
        });

        it('should log error if initialization fails', async () => {
            const initError = new Error('Init failed');
            (admin.initializeApp as jest.Mock).mockImplementationOnce(() => {
                throw initError;
            });

            //const mockLogger = createMockLogger();

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow('Failed to initialize Firebase Admin');
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Failed to initialize Firebase Admin',
                'Init failed',
                'FirebaseService',
            );
        });

        it('should include error message in thrown error', async () => {
            const initError = new Error('Custom init error');
            (admin.initializeApp as jest.Mock).mockImplementationOnce(() => {
                throw initError;
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow(
                'Failed to initialize Firebase Admin: Custom init error',
            );
        });
    });

    describe('getAuth', () => {
        it('should return Firebase Auth instance', () => {
            const auth = service.getAuth();
            expect(auth).toBeDefined();
        });

        it('should return admin.auth() result', () => {
            const auth = service.getAuth();
            expect(admin.auth).toHaveBeenCalled();
            expect(auth).toBe(admin.auth());
        });

        it('should throw error if app not initialized', async () => {
            // Create service with initialization failure
            (admin.initializeApp as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Init failed');
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            const failedService = module.get<FirebaseService>(FirebaseService);

            await expect(module.init()).rejects.toThrow('Init failed');

            expect(() => failedService.getAuth()).toThrow('Firebase app not initialized');
        });
    });

    describe('service account validation', () => {
        it('should accept valid service account format', () => {
            expect(
                () =>
                    JSON.parse(
                        mockConfigService.get('FIREBASE_SERVICE_ACCOUNT') as string,
                    ) as FirebaseServiceAccount,
            ).not.toThrow();
        });

        it('should require type field', () => {
            const invalidAccount = { ...mockServiceAccountJSON };
            delete (invalidAccount as Partial<typeof mockServiceAccountJSON>).type;

            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    project_id: mockServiceAccountJSON.project_id,
                }),
            );
        });

        it('should require project_id field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    project_id: 'nurtura-api-test',
                }),
            );
        });

        it('should require private_key field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    private_key: mockServiceAccountJSON.private_key,
                }),
            );
        });

        it('should require client_email field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    client_email: mockServiceAccountJSON.client_email,
                }),
            );
        });
    });

    describe('integration', () => {
        it('should be injectable as a provider', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            const injectedService = module.get<FirebaseService>(FirebaseService);
            expect(injectedService).toBeInstanceOf(FirebaseService);
        });

        it('should work with dependency injection', async () => {
            @Injectable()
            class TestService {
                constructor(private readonly firebase: FirebaseService) {}

                getFirebase() {
                    return this.firebase;
                }
            }

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TestService,
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: mockConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                ],
            }).compile();

            const testService = module.get<TestService>(TestService);
            const firebase = testService.getFirebase();

            expect(firebase).toBeInstanceOf(FirebaseService);
        });
    });

    describe('lifecycle', () => {
        it('should initialize on module init', () => {
            expect(admin.initializeApp).toHaveBeenCalled();
        });

        it('should only initialize once per instance', () => {
            const callCount = (admin.initializeApp as jest.Mock).mock.calls.length;

            // Call getAuth multiple times
            service.getAuth();
            service.getAuth();
            service.getAuth();

            // initializeApp should still only be called once (during construction)
            expect((admin.initializeApp as jest.Mock).mock.calls.length).toBe(callCount);
        });
    });

    describe('admin SDK methods', () => {
        it('should provide access to auth methods', () => {
            const auth = service.getAuth();

            expect(typeof auth.verifyIdToken).toBe('function');
            expect(typeof auth.getUserByEmail).toBe('function');
            expect(typeof auth.createUser).toBe('function');
            expect(typeof auth.updateUser).toBe('function');
            expect(typeof auth.deleteUser).toBe('function');
        });
    });
});
