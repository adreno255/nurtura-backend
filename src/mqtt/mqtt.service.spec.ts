import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MqttService } from './mqtt.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorsService } from '../sensors/sensors.service';
import { RacksService } from '../racks/racks.service';
import * as mqtt from 'mqtt';
import {
    createMockConfigService,
    createMockLogger,
    createMockMqttClient,
    createMockSensorsService,
    createMockRacksService,
    createMockEventEmitter,
} from '../../test/mocks';
import { mqttTestMacAddresses, mqttTestMessages } from '../../test/fixtures';
import {
    type ISubscriptionGrant,
    type IClientOptions,
    type IConnackPacket,
    type IClientSubscribeOptions,
    type IClientPublishOptions,
    type Packet,
} from 'mqtt';

// Mock mqtt module
jest.mock('mqtt');

describe('MqttService', () => {
    let service: MqttService;
    let mockMqttClient: ReturnType<typeof createMockMqttClient>;

    const mockConfigService = createMockConfigService({
        MQTT_HOST: 'test.mqtt.broker.com',
        MQTT_PORT: 8883,
        MQTT_USERNAME: 'test-user',
        MQTT_PASSWORD: 'test-password',
    });

    const mockLoggerService = createMockLogger();
    const mockSensorsService = createMockSensorsService();
    const mockRacksService = createMockRacksService();

    const mockEventEmitter = createMockEventEmitter();

    beforeEach(async () => {
        jest.clearAllMocks();

        // Create fresh mock client for each test
        mockMqttClient = createMockMqttClient();

        // Mock mqtt.connect to return our mock client
        (mqtt.connect as jest.Mock).mockReturnValue(mockMqttClient);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
                {
                    provide: SensorsService,
                    useValue: mockSensorsService,
                },
                {
                    provide: RacksService,
                    useValue: mockRacksService,
                },
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
                },
            ],
        }).compile();

        service = module.get<MqttService>(MqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should connect to MQTT broker on initialization', async () => {
            // Trigger 'connect' event immediately
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mqtt.connect).toHaveBeenCalled();
        });

        it('should retrieve MQTT configuration from ConfigService', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_HOST');
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_PORT', 8883);
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_USERNAME');
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_PASSWORD');
        });

        it('should connect with correct MQTT URL', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mqtt.connect).toHaveBeenCalledWith(
                'mqtts://test.mqtt.broker.com:8883',
                expect.any(Object),
            );
        });

        it('should connect with correct credentials', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mqtt.connect).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    username: 'test-user',
                    password: 'test-password',
                }),
            );
        });

        it('should connect with TLS enabled', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mqtt.connect).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    rejectUnauthorized: true,
                }),
            );
        });

        it('should generate unique client ID', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            const [, options] = (mqtt.connect as jest.Mock).mock.calls[0] as [
                string,
                IClientOptions,
            ];

            expect(options.clientId).toMatch(/^nurtura-backend-[a-f0-9]{6}$/);
        });

        it('should configure reconnection settings', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mqtt.connect).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    reconnectPeriod: 5000,
                    connectTimeout: 30000,
                    keepalive: 60,
                    clean: true,
                }),
            );
        });

        it('should log bootstrap message on successful connection', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'Connected to MQTT broker',
                'MqttService',
            );
        });

        it('should throw error if MQTT_HOST is not configured', async () => {
            const invalidConfigService = createMockConfigService({
                MQTT_HOST: undefined,
                MQTT_USERNAME: 'test-user',
                MQTT_PASSWORD: 'test-password',
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    MqttService,
                    {
                        provide: ConfigService,
                        useValue: invalidConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                    {
                        provide: SensorsService,
                        useValue: mockSensorsService,
                    },
                    {
                        provide: RacksService,
                        useValue: mockRacksService,
                    },
                    {
                        provide: EventEmitter2,
                        useValue: mockEventEmitter,
                    },
                ],
            }).compile();

            const invalidService = module.get<MqttService>(MqttService);

            await expect(invalidService.onModuleInit()).rejects.toThrow(
                'MQTT configuration is incomplete',
            );
        });

        it('should throw error if MQTT_USERNAME is not configured', async () => {
            const invalidConfigService = createMockConfigService({
                MQTT_HOST: 'test.broker.com',
                MQTT_USERNAME: undefined,
                MQTT_PASSWORD: 'test-password',
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    MqttService,
                    {
                        provide: ConfigService,
                        useValue: invalidConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                    {
                        provide: SensorsService,
                        useValue: mockSensorsService,
                    },
                    {
                        provide: RacksService,
                        useValue: mockRacksService,
                    },
                    {
                        provide: EventEmitter2,
                        useValue: mockEventEmitter,
                    },
                ],
            }).compile();

            const invalidService = module.get<MqttService>(MqttService);

            await expect(invalidService.onModuleInit()).rejects.toThrow(
                'MQTT configuration is incomplete',
            );
        });

        it('should throw error if MQTT_PASSWORD is not configured', async () => {
            const invalidConfigService = createMockConfigService({
                MQTT_HOST: 'test.broker.com',
                MQTT_USERNAME: 'test-user',
                MQTT_PASSWORD: undefined,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    MqttService,
                    {
                        provide: ConfigService,
                        useValue: invalidConfigService,
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                    {
                        provide: SensorsService,
                        useValue: mockSensorsService,
                    },
                    {
                        provide: RacksService,
                        useValue: mockRacksService,
                    },
                    {
                        provide: EventEmitter2,
                        useValue: mockEventEmitter,
                    },
                ],
            }).compile();

            const invalidService = module.get<MqttService>(MqttService);

            await expect(invalidService.onModuleInit()).rejects.toThrow(
                'MQTT configuration is incomplete',
            );
        });

        it('should log error if connection fails', async () => {
            const connectionError = new Error('Connection refused');

            setImmediate(() => {
                const errorHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'error',
                )?.[1] as ((error: Error) => void) | undefined;
                if (errorHandler) errorHandler(connectionError);
            });

            await expect(service.onModuleInit()).rejects.toThrow('Connection refused');

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Failed to connect to MQTT broker',
                'Connection refused',
                'MqttService',
            );
        });

        it('should reject promise on connection error', async () => {
            const connectionError = new Error('Authentication failed');

            setImmediate(() => {
                const errorHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'error',
                )?.[1] as ((error: Error) => void) | undefined;
                if (errorHandler) errorHandler(connectionError);
            });

            await expect(service.onModuleInit()).rejects.toThrow('Authentication failed');
        });
    });

    describe('event handlers', () => {
        beforeEach(async () => {
            // Establish connection for event handler tests
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            // Only clear logger mocks, not mqtt client mocks needed for finding handlers
            mockLoggerService.log.mockClear();
            mockLoggerService.bootstrap.mockClear();
            mockLoggerService.warn.mockClear();
            mockLoggerService.error.mockClear();
            mockLoggerService.debug.mockClear();
        });

        it('should handle connect event', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            expect(connectHandler).toBeDefined();

            if (connectHandler) {
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });
                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    'MQTT client connected',
                    'MqttService',
                );
            }
        });

        it('should handle disconnect event', () => {
            const disconnectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'disconnect',
            )?.[1] as () => void;

            expect(disconnectHandler).toBeDefined();

            if (disconnectHandler) {
                disconnectHandler();
                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    'Disconnected from MQTT broker',
                    'MqttService',
                );
            }
        });

        it('should handle offline event', () => {
            const offlineHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'offline',
            )?.[1] as () => void;

            expect(offlineHandler).toBeDefined();

            if (offlineHandler) {
                offlineHandler();
                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    'MQTT client is offline',
                    'MqttService',
                );
            }
        });

        it('should handle error event', () => {
            const errorHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'error',
            )?.[1] as (error: Error) => void;

            expect(errorHandler).toBeDefined();

            if (errorHandler) {
                const testError = new Error('Test error');
                errorHandler(testError);
                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    'MQTT client error',
                    'Test error',
                    'MqttService',
                );
            }
        });

        it('should handle close event', () => {
            // 1. Cast the handler to a function that takes no arguments
            const closeHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'close',
            )?.[1] as () => void;

            expect(closeHandler).toBeDefined();

            if (closeHandler) {
                closeHandler();

                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    'MQTT connection closed',
                    'MqttService',
                );
            }
        });

        it('should handle reconnect event', () => {
            const reconnectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'reconnect',
            )?.[1] as () => void;

            expect(reconnectHandler).toBeDefined();

            if (reconnectHandler) {
                reconnectHandler();
                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    expect.stringContaining('Reconnecting to MQTT broker'),
                    'MqttService',
                );
            }
        });

        it('should stop reconnecting after max attempts', () => {
            const reconnectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'reconnect',
            )?.[1] as () => void;

            if (reconnectHandler) {
                // Trigger reconnect 10 times
                for (let i = 0; i < 10; i++) {
                    reconnectHandler();
                }

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    'Max reconnection attempts reached. Stopping reconnection.',
                    '',
                    'MqttService',
                );
                expect(jest.spyOn(mockMqttClient, 'end')).toHaveBeenCalledWith(true);
            }
        });

        it('should reset reconnect attempts on successful connection', () => {
            const reconnectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'reconnect',
            )?.[1] as () => void;
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (reconnectHandler && connectHandler) {
                // Trigger some reconnects
                reconnectHandler();
                reconnectHandler();

                // Then successful connection
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                // Should not have logged error about max attempts
                expect(mockLoggerService.error).not.toHaveBeenCalledWith(
                    expect.stringContaining('Max reconnection attempts'),
                    expect.any(String),
                    expect.any(String),
                );
            }
        });
    });

    describe('subscription', () => {
        beforeEach(async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            jest.clearAllMocks();
        });

        it('should subscribe to sensor data topic', () => {
            // Trigger connect event to initiate subscription
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                expect(jest.spyOn(mockMqttClient, 'subscribe')).toHaveBeenCalledWith(
                    'nurtura/rack/+/sensors',
                    expect.objectContaining({ qos: 1 }),
                    expect.any(Function),
                );
            }
        });

        it('should subscribe to status topic', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                expect(jest.spyOn(mockMqttClient, 'subscribe')).toHaveBeenCalledWith(
                    'nurtura/rack/+/status',
                    expect.objectContaining({ qos: 1 }),
                    expect.any(Function),
                );
            }
        });

        it('should subscribe to errors topic', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                expect(jest.spyOn(mockMqttClient, 'subscribe')).toHaveBeenCalledWith(
                    'nurtura/rack/+/errors',
                    expect.objectContaining({ qos: 1 }),
                    expect.any(Function),
                );
            }
        });

        it('should use QoS 1 for all subscriptions', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                const subscribeCalls = jest.spyOn(mockMqttClient, 'subscribe').mock.calls;
                subscribeCalls.forEach((call) => {
                    expect(call[1]).toMatchObject({ qos: 1 });
                });
            }
        });

        it('should log successful subscription', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                type SubscribeCallback = (err: Error | null, grants: ISubscriptionGrant[]) => void;
                const subscribeArgs = (mockMqttClient.subscribe as jest.Mock).mock.calls[0] as [
                    string | string[],
                    IClientSubscribeOptions,
                    SubscribeCallback | undefined,
                ];

                const callback = subscribeArgs[2] as (
                    err: Error | null,
                    grants: ISubscriptionGrant[],
                ) => void;

                expect(callback).toBeDefined();

                if (callback) {
                    callback(null, [{ topic: 'nurtura/rack/+/sensors', qos: 1 }]);

                    expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                        expect.stringContaining('Subscribed to topic: nurtura/rack/+/sensors'),
                        'MqttService',
                    );
                }
            }
        });

        it('should log error on subscription failure', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                type SubscribeCallback = (
                    err: Error | null,
                    grants: ISubscriptionGrant[] | null,
                ) => void;
                const subscribeCall = (mockMqttClient.subscribe as jest.Mock).mock.calls[0] as [
                    string,
                    any,
                    SubscribeCallback,
                ];

                const callback = subscribeCall[2];
                const error = new Error('Subscription failed');

                if (callback) {
                    callback(error, null);

                    expect(mockLoggerService.error).toHaveBeenCalledWith(
                        expect.stringContaining('Failed to subscribe to topic'),
                        'Subscription failed',
                        'MqttService',
                    );
                }
            }
        });

        it('should not subscribe if client is not connected', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = false;
                jest.clearAllMocks();

                connectHandler({ cmd: 'connack', returnCode: 0, sessionPresent: false });

                expect(jest.spyOn(mockMqttClient, 'subscribe')).not.toHaveBeenCalled();
                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    'Cannot subscribe: MQTT client not connected',
                    'MqttService',
                );
            }
        });

        it('should prevent duplicate subscriptions on reconnect', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;

                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                type SubscribeCallback = (err: Error | null, grants: ISubscriptionGrant[]) => void;
                const subscribeCalls = (mockMqttClient.subscribe as jest.Mock).mock.calls as Array<
                    [string, any, SubscribeCallback]
                >;

                subscribeCalls.forEach((call) => {
                    const [topic, , callback] = call;
                    if (callback) {
                        callback(null, [{ topic, qos: 1 }]);
                    }
                });

                jest.clearAllMocks();

                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                expect(jest.spyOn(mockMqttClient, 'subscribe')).not.toHaveBeenCalled();
                expect(mockLoggerService.debug).toHaveBeenCalledWith(
                    expect.stringContaining('Already subscribed'),
                    'MqttService',
                );
            }
        });
    });

    describe('message routing', () => {
        beforeEach(async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            jest.clearAllMocks();
        });

        it('should route sensor messages to SensorsService', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/sensors`;
                const message = Buffer.from(mqttTestMessages.validSensorData);

                await messageHandler(topic, message);

                expect(mockSensorsService.processSensorData).toHaveBeenCalledWith(
                    mqttTestMacAddresses.valid,
                    mqttTestMessages.validSensorData,
                );
            }
        });

        it('should route status messages to RacksService', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/status`;
                const message = Buffer.from(mqttTestMessages.deviceOnline);

                await messageHandler(topic, message);

                expect(mockRacksService.processDeviceStatus).toHaveBeenCalledWith(
                    mqttTestMacAddresses.valid,
                    mqttTestMessages.deviceOnline,
                );
            }
        });

        it('should route error messages to RacksService', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/errors`;
                const message = Buffer.from(mqttTestMessages.deviceError);

                await messageHandler(topic, message);

                expect(mockRacksService.processDeviceError).toHaveBeenCalledWith(
                    mqttTestMacAddresses.valid,
                    mqttTestMessages.deviceError,
                );
            }
        });

        it('should log received message', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/sensors`;
                const message = Buffer.from(mqttTestMessages.validSensorData);

                await messageHandler(topic, message);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Message received on topic: ${topic}`,
                    'MqttService',
                );
            }
        });

        it('should handle invalid topic format', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const invalidTopic = 'invalid/topic/format';
                const message = Buffer.from('test message');

                await messageHandler(invalidTopic, message);

                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Invalid topic format'),
                    'MqttService',
                );
            }
        });

        it('should handle unknown message type', async () => {
            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/unknown`;
                const message = Buffer.from('test message');

                await messageHandler(topic, message);

                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Unknown message type'),
                    'MqttService',
                );
            }
        });

        it('should log error if message processing fails', async () => {
            mockSensorsService.processSensorData.mockRejectedValue(new Error('Processing failed'));

            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/sensors`;
                const message = Buffer.from(mqttTestMessages.validSensorData);

                await messageHandler(topic, message);

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    expect.stringContaining('Error routing message'),
                    'Processing failed',
                    'MqttService',
                );
            }
        });
    });

    describe('publishCommand', () => {
        beforeEach(async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            mockMqttClient.connected = true;
            jest.clearAllMocks();
        });

        it('should publish watering command', async () => {
            const payload = { action: 'on', duration: 5000 };

            await service.publishCommand(mqttTestMacAddresses.valid, 'watering', payload);

            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                `nurtura/rack/${mqttTestMacAddresses.valid}/commands/watering`,
                JSON.stringify(payload),
                { qos: 1 },
                expect.any(Function),
            );
        });

        it('should publish lighting command', async () => {
            const payload = { action: 'on' };

            await service.publishCommand(mqttTestMacAddresses.valid, 'lighting', payload);

            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                `nurtura/rack/${mqttTestMacAddresses.valid}/commands/lighting`,
                JSON.stringify(payload),
                { qos: 1 },
                expect.any(Function),
            );
        });

        it('should publish sensors command', async () => {
            const payload = { action: 'read' };

            await service.publishCommand(mqttTestMacAddresses.valid, 'sensors', payload);

            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                `nurtura/rack/${mqttTestMacAddresses.valid}/commands/sensors`,
                JSON.stringify(payload),
                { qos: 1 },
                expect.any(Function),
            );
        });

        it('should use QoS 1 for commands', async () => {
            const payload = { action: 'on' };

            await service.publishCommand(mqttTestMacAddresses.valid, 'watering', payload);

            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ qos: 1 }),
                expect.any(Function),
            );
        });

        it('should log published command', async () => {
            const payload = { action: 'on' };
            const mac = mqttTestMacAddresses.valid;

            mockMqttClient.publish.mockImplementation(
                (
                    topic: string,
                    message: string | Buffer,
                    options: IClientPublishOptions,
                    callback?: (error?: Error, packet?: Packet) => void,
                ) => {
                    if (callback) {
                        callback();
                    }
                    return mockMqttClient;
                },
            );

            await service.publishCommand(mac, 'watering', payload);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('Published command'),
                'MqttService',
            );
        });

        it('should throw error if client is not connected', async () => {
            mockMqttClient.connected = false;
            const payload = { action: 'on' };

            await expect(
                service.publishCommand(mqttTestMacAddresses.valid, 'watering', payload),
            ).rejects.toThrow('MQTT client not connected');
        });

        it('should log error if client is not connected', async () => {
            mockMqttClient.connected = false;
            const payload = { action: 'on' };

            await expect(
                service.publishCommand(mqttTestMacAddresses.valid, 'watering', payload),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Cannot publish: MQTT client not connected',
                '',
                'MqttService',
            );
        });

        it('should reject if publish fails', async () => {
            const publishError = new Error('Publish failed');

            mockMqttClient.publish.mockImplementation(
                (
                    _topic: string,
                    _message: string | Buffer,
                    _options: IClientPublishOptions,
                    callback?: (error?: Error, packet?: Packet) => void,
                ) => {
                    if (callback) callback(publishError);
                    return mockMqttClient;
                },
            );

            const payload = { action: 'on' };
            const mac = mqttTestMacAddresses.valid;

            await expect(service.publishCommand(mac, 'watering', payload)).rejects.toThrow(
                'Publish failed',
            );
        });

        it('should reject if publish fails', async () => {
            const publishError = new Error('Publish failed');

            mockMqttClient.publish.mockImplementation(
                (
                    _topic: string,
                    _message: string | Buffer,
                    _options: IClientPublishOptions,
                    callback?: (error?: Error, packet?: Packet) => void,
                ) => {
                    if (callback) callback(publishError);
                    return mockMqttClient;
                },
            );

            const payload = { action: 'on' };
            const mac = mqttTestMacAddresses.valid;

            await expect(service.publishCommand(mac, 'watering', payload)).rejects.toThrow(
                'Publish failed',
            );
        });
    });

    describe('health check methods', () => {
        beforeEach(async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            jest.clearAllMocks();
        });

        it('should return true if client is connected', () => {
            mockMqttClient.connected = true;
            expect(service.isConnected()).toBe(true);
        });

        it('should return false if client is not connected', () => {
            mockMqttClient.connected = false;
            expect(service.isConnected()).toBe(false);
        });

        it('should return subscribed topics', () => {
            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                mockMqttClient.connected = true;
                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                type SubscribeCallback = (err: Error | null, grants: ISubscriptionGrant[]) => void;
                const subscribeCalls = (mockMqttClient.subscribe as jest.Mock).mock.calls as Array<
                    [string, any, SubscribeCallback]
                >;

                subscribeCalls.forEach((call) => {
                    const [topic, , callback] = call;
                    if (callback) {
                        callback(null, [{ topic, qos: 1 }]);
                    }
                });

                const topics = service.getSubscribedTopics();

                expect(topics).toContain('nurtura/rack/+/sensors');
                expect(topics).toContain('nurtura/rack/+/status');
                expect(topics).toContain('nurtura/rack/+/errors');
            }
        });

        it('should return connection status', () => {
            mockMqttClient.connected = true;

            const connectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'connect',
            )?.[1] as (packet: IConnackPacket) => void;

            if (connectHandler) {
                connectHandler({
                    cmd: 'connack',
                    returnCode: 0,
                    sessionPresent: false,
                } as IConnackPacket);

                type SubscribeCallback = (err: Error | null, grants: ISubscriptionGrant[]) => void;
                const subscribeCalls = (mockMqttClient.subscribe as jest.Mock).mock.calls as Array<
                    [string, any, SubscribeCallback]
                >;

                subscribeCalls.forEach((call) => {
                    const [topic, , callback] = call;
                    if (callback) {
                        callback(null, [{ topic, qos: 1 }]);
                    }
                });

                const status = service.getConnectionStatus();

                expect(status).toEqual({
                    connected: true,
                    reconnectAttempts: 0,
                    subscribedTopics: expect.arrayContaining([
                        'nurtura/rack/+/sensors',
                        'nurtura/rack/+/status',
                        'nurtura/rack/+/errors',
                    ]) as unknown as string[],
                });
            }
        });

        it('should track reconnect attempts in status', () => {
            const reconnectHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'reconnect',
            )?.[1] as () => void;

            if (reconnectHandler) {
                reconnectHandler();
                reconnectHandler();

                const status = service.getConnectionStatus();

                expect(status.reconnectAttempts).toBe(2);
            }
        });
    });

    describe('onModuleDestroy', () => {
        beforeEach(async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();
            jest.clearAllMocks();
        });

        it('should close MQTT connection on module destruction', async () => {
            mockMqttClient.end.mockImplementation(
                (_force: boolean, _options: IClientOptions, callback?: () => void) => {
                    if (callback) callback();
                    return mockMqttClient;
                },
            );

            await service.onModuleDestroy();

            expect(jest.spyOn(mockMqttClient, 'end')).toHaveBeenCalledWith(
                false,
                {},
                expect.any(Function),
            );
        });

        it('should log closing message', async () => {
            mockMqttClient.end.mockImplementation(
                (_force: boolean, _options: IClientOptions, callback?: () => void) => {
                    if (callback) callback();
                    return mockMqttClient;
                },
            );

            await service.onModuleDestroy();

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'Closing MQTT connection...',
                'MqttService',
            );
        });

        it('should log successful closure', async () => {
            mockMqttClient.end.mockImplementation(
                (_force: boolean, _options: IClientOptions, callback?: () => void) => {
                    if (callback) callback();
                    return mockMqttClient;
                },
            );

            await service.onModuleDestroy();

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'MQTT connection closed gracefully',
                'MqttService',
            );
        });

        it('should handle destruction if client is null', async () => {
            // Create service without initializing
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    MqttService,
                    {
                        provide: ConfigService,
                        useValue: createMockConfigService({
                            MQTT_HOST: undefined,
                        }),
                    },
                    {
                        provide: MyLoggerService,
                        useValue: mockLoggerService,
                    },
                    {
                        provide: SensorsService,
                        useValue: mockSensorsService,
                    },
                    {
                        provide: RacksService,
                        useValue: mockRacksService,
                    },
                    {
                        provide: EventEmitter2,
                        useValue: mockEventEmitter,
                    },
                ],
            }).compile();

            const uninitializedService = module.get<MqttService>(MqttService);

            await expect(uninitializedService.onModuleDestroy()).resolves.not.toThrow();
        });
    });

    describe('integration', () => {
        it('should work with ConfigService', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });
            await service.onModuleInit();

            expect(mockConfigService.get).toHaveBeenCalled();
        });

        it('should work with MyLoggerService', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            expect(mockLoggerService.bootstrap).toHaveBeenCalled();
        });

        it('should work with SensorsService', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/sensors`;
                const message = Buffer.from(mqttTestMessages.validSensorData);

                await messageHandler(topic, message);

                expect(mockSensorsService.processSensorData).toHaveBeenCalled();
            }
        });

        it('should work with RacksService', async () => {
            setImmediate(() => {
                const connectHandler = mockMqttClient.once.mock.calls.find(
                    (call) => call[0] === 'connect',
                )?.[1] as (packet: IConnackPacket) => void; // Explicitly type the handler

                if (connectHandler) {
                    connectHandler({
                        cmd: 'connack',
                        returnCode: 0,
                        retain: false,
                        qos: 0,
                        dup: false,
                        length: 0,
                        topic: null,
                        payload: null,
                    } as unknown as IConnackPacket); // Cast to the actual Interface
                }
            });

            await service.onModuleInit();

            const messageHandler = mockMqttClient.on.mock.calls.find(
                (call) => call[0] === 'message',
            )?.[1] as ((topic: string, message: any) => Promise<void>) | undefined;

            if (messageHandler) {
                const topic = `nurtura/rack/${mqttTestMacAddresses.valid}/status`;
                const message = Buffer.from(mqttTestMessages.deviceOnline);

                await messageHandler(topic, message);

                expect(mockRacksService.processDeviceStatus).toHaveBeenCalled();
            }
        });
    });
});
