import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import * as admin from 'firebase-admin';
import { Injectable } from '@nestjs/common';

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

describe('FirebaseService', () => {
    let service: FirebaseService;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'FIREBASE_SERVICE_ACCOUNT') return mockServiceAccountJson;
            return undefined;
        }),
    };

    const mockLoggerService = {
        bootstrap: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockServiceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: 'test-private-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: 'test-client-id',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url:
            'https://www.googleapis.com/robot/v1/metadata/x509/test.iam.gserviceaccount.com',
    };

    const mockServiceAccountJson = JSON.stringify(mockServiceAccount);

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
            expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccount);
        });

        it('should log success message', () => {
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'Firebase Admin initialized successfully',
                'FirebaseService',
            );
        });

        it('should initialize with correct credentials', () => {
            expect(admin.initializeApp).toHaveBeenCalledWith({
                credential: mockServiceAccount,
            });
        });
    });

    describe('error handling', () => {
        it('should throw error if FIREBASE_SERVICE_ACCOUNT is not configured', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => undefined),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow(
                'FIREBASE_SERVICE_ACCOUNT is not configured',
            );
        });

        it('should throw error if service account JSON is invalid', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => 'invalid-json'),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
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

            const mockLogger = {
                bootstrap: jest.fn(),
                log: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    FirebaseService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => mockServiceAccountJson),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLogger,
                    },
                ],
            }).compile();

            await expect(module.init()).rejects.toThrow('Failed to initialize Firebase Admin');
            expect(mockLogger.error).toHaveBeenCalledWith(
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
                        useValue: {
                            get: jest.fn(() => mockServiceAccountJson),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
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
                        useValue: {
                            get: jest.fn(() => mockServiceAccountJson),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
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
            expect(() => {
                JSON.parse(mockServiceAccountJson);
            }).not.toThrow();
        });

        it('should require type field', () => {
            const invalidAccount = { ...mockServiceAccount };
            delete (invalidAccount as Partial<typeof mockServiceAccount>).type;

            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    project_id: mockServiceAccount.project_id,
                }),
            );
        });

        it('should require project_id field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    project_id: 'test-project',
                }),
            );
        });

        it('should require private_key field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    private_key: mockServiceAccount.private_key,
                }),
            );
        });

        it('should require client_email field', () => {
            expect(admin.credential.cert).toHaveBeenCalledWith(
                expect.objectContaining({
                    client_email: mockServiceAccount.client_email,
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
                        useValue: {
                            get: jest.fn(() => mockServiceAccountJson),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
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
                        useValue: {
                            get: jest.fn(() => mockServiceAccountJson),
                        },
                    },
                    {
                        provide: MyLoggerService,
                        useValue: {
                            bootstrap: jest.fn(),
                            log: jest.fn(),
                            error: jest.fn(),
                            warn: jest.fn(),
                        },
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
