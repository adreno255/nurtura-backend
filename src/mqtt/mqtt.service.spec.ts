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

jest.mock('mqtt');

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

type MessageHandler = (topic: string, message: Buffer) => Promise<void>;
type SubscribeCallback = (err: Error | null, grants: ISubscriptionGrant[]) => void;
type ConnackPacket = IConnackPacket;

const CONNACK: ConnackPacket = {
    cmd: 'connack',
    returnCode: 0,
    retain: false,
    qos: 0,
    dup: false,
    length: 0,
    topic: null,
    payload: null,
} as unknown as IConnackPacket;

const CONNACK_SESSION: Partial<ConnackPacket> = {
    cmd: 'connack',
    returnCode: 0,
    sessionPresent: false,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Fires the 'connect' handler registered via client.once() to resolve the connection promise. */
function triggerConnect(mockClient: ReturnType<typeof createMockMqttClient>) {
    setImmediate(() => {
        const handler = mockClient.once.mock.calls.find((c) => c[0] === 'connect')?.[1] as
            | ((p: ConnackPacket) => void)
            | undefined;
        handler?.(CONNACK);
    });
}

/** Fires the 'error' handler registered via client.once() to reject the connection promise. */
function triggerConnectError(mockClient: ReturnType<typeof createMockMqttClient>, error: Error) {
    setImmediate(() => {
        const handler = mockClient.once.mock.calls.find((c) => c[0] === 'error')?.[1] as
            | ((e: Error) => void)
            | undefined;
        handler?.(error);
    });
}

/** Retrieves the persistent event handler registered via client.on(event). */
function getEventHandler<T extends (...args: any[]) => any>(
    mockClient: ReturnType<typeof createMockMqttClient>,
    event: string,
): T | undefined {
    return mockClient.on.mock.calls.find((c) => c[0] === event)?.[1] as T | undefined;
}

/** Builds the test module with optional config overrides. */
async function buildModule(
    configOverrides: Record<string, unknown>,
    mockClient: ReturnType<typeof createMockMqttClient>,
) {
    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
        providers: [
            MqttService,
            { provide: ConfigService, useValue: createMockConfigService(configOverrides) },
            { provide: MyLoggerService, useValue: createMockLogger() },
            { provide: SensorsService, useValue: createMockSensorsService() },
            { provide: RacksService, useValue: createMockRacksService() },
            { provide: EventEmitter2, useValue: createMockEventEmitter() },
        ],
    }).compile();

    return module.get<MqttService>(MqttService);
}

// ─────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────

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

        mockMqttClient = createMockMqttClient();
        (mqtt.connect as jest.Mock).mockReturnValue(mockMqttClient);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttService,
                { provide: ConfigService, useValue: mockConfigService },
                { provide: MyLoggerService, useValue: mockLoggerService },
                { provide: SensorsService, useValue: mockSensorsService },
                { provide: RacksService, useValue: mockRacksService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
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

    // ─────────────────────────────────────────────
    // onModuleInit
    // ─────────────────────────────────────────────

    describe('onModuleInit', () => {
        /** Initialises the service, resolving the connection promise synchronously. */
        const init = async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
        };

        it('should connect to MQTT broker on initialization', async () => {
            await init();
            expect(mqtt.connect).toHaveBeenCalled();
        });

        it('should retrieve MQTT configuration from ConfigService', async () => {
            await init();
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_HOST');
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_PORT', 8883);
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_USERNAME');
            expect(mockConfigService.get).toHaveBeenCalledWith('MQTT_PASSWORD');
        });

        it('should connect with correct MQTT URL', async () => {
            await init();
            expect(mqtt.connect).toHaveBeenCalledWith(
                'mqtts://test.mqtt.broker.com:8883',
                expect.any(Object),
            );
        });

        it('should connect with correct credentials', async () => {
            await init();
            expect(mqtt.connect).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ username: 'test-user', password: 'test-password' }),
            );
        });

        it('should connect with TLS enabled', async () => {
            await init();
            expect(mqtt.connect).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ rejectUnauthorized: true }),
            );
        });

        it('should generate a unique client ID', async () => {
            await init();
            const [, options] = (mqtt.connect as jest.Mock).mock.calls[0] as [
                string,
                IClientOptions,
            ];
            expect(options.clientId).toMatch(/^nurtura-backend-[a-f0-9]{6}$/);
        });

        it('should configure reconnection settings', async () => {
            await init();
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
            await init();
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'Connected to MQTT broker',
                'MqttService',
            );
        });

        it.each([
            ['MQTT_HOST', { MQTT_HOST: undefined, MQTT_USERNAME: 'u', MQTT_PASSWORD: 'p' }],
            ['MQTT_USERNAME', { MQTT_HOST: 'host', MQTT_USERNAME: undefined, MQTT_PASSWORD: 'p' }],
            ['MQTT_PASSWORD', { MQTT_HOST: 'host', MQTT_USERNAME: 'u', MQTT_PASSWORD: undefined }],
        ])('should throw if %s is not configured', async (_, config) => {
            const svc = await buildModule(config, createMockMqttClient());
            await expect(svc.onModuleInit()).rejects.toThrow('MQTT configuration is incomplete');
        });

        it('should log error if connection fails', async () => {
            const error = new Error('Connection refused');
            triggerConnectError(mockMqttClient, error);
            await expect(service.onModuleInit()).rejects.toThrow('Connection refused');
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Failed to connect to MQTT broker',
                'Connection refused',
                'MqttService',
            );
        });

        it('should reject promise on connection error', async () => {
            triggerConnectError(mockMqttClient, new Error('Authentication failed'));
            await expect(service.onModuleInit()).rejects.toThrow('Authentication failed');
        });
    });

    // ─────────────────────────────────────────────
    // event handlers
    // ─────────────────────────────────────────────

    describe('event handlers', () => {
        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            mockLoggerService.log.mockClear();
            mockLoggerService.bootstrap.mockClear();
            mockLoggerService.warn.mockClear();
            mockLoggerService.error.mockClear();
            mockLoggerService.debug.mockClear();
        });

        it('should handle connect event', () => {
            const handler = getEventHandler<(p: Partial<ConnackPacket>) => void>(
                mockMqttClient,
                'connect',
            );
            handler?.(CONNACK_SESSION);
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'MQTT client connected',
                'MqttService',
            );
        });

        it('should handle disconnect event', () => {
            const handler = getEventHandler<() => void>(mockMqttClient, 'disconnect');
            handler?.();
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                'Disconnected from MQTT broker',
                'MqttService',
            );
        });

        it('should handle offline event', () => {
            const handler = getEventHandler<() => void>(mockMqttClient, 'offline');
            handler?.();
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                'MQTT client is offline',
                'MqttService',
            );
        });

        it('should handle error event', () => {
            const handler = getEventHandler<(e: Error) => void>(mockMqttClient, 'error');
            handler?.(new Error('Test error'));
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'MQTT client error',
                'Test error',
                'MqttService',
            );
        });

        it('should handle close event', () => {
            const handler = getEventHandler<() => void>(mockMqttClient, 'close');
            handler?.();
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                'MQTT connection closed',
                'MqttService',
            );
        });

        it('should handle reconnect event', () => {
            const handler = getEventHandler<() => void>(mockMqttClient, 'reconnect');
            handler?.();
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('Reconnecting to MQTT broker'),
                'MqttService',
            );
        });

        it('should stop reconnecting after max attempts', () => {
            const handler = getEventHandler<() => void>(mockMqttClient, 'reconnect');
            for (let i = 0; i < 10; i++) handler?.();
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Max reconnection attempts reached. Stopping reconnection.',
                '',
                'MqttService',
            );
            expect(jest.spyOn(mockMqttClient, 'end')).toHaveBeenCalledWith(true);
        });

        it('should reset reconnect attempts on successful connection', () => {
            const reconnect = getEventHandler<() => void>(mockMqttClient, 'reconnect');
            const connect = getEventHandler<(p: Partial<ConnackPacket>) => void>(
                mockMqttClient,
                'connect',
            );

            reconnect?.();
            reconnect?.();
            connect?.(CONNACK_SESSION);

            expect(mockLoggerService.error).not.toHaveBeenCalledWith(
                expect.stringContaining('Max reconnection attempts'),
                expect.any(String),
                expect.any(String),
            );
        });
    });

    // ─────────────────────────────────────────────
    // subscription
    // ─────────────────────────────────────────────

    describe('subscription', () => {
        // Captured before clearAllMocks() so tests can invoke it without inspecting .on.mock.calls
        let connectHandler: ((p: Partial<ConnackPacket>) => void) | undefined;

        /** Triggers the persistent on-connect handler to drive subscribeToTopics(). */
        const fireConnect = () => {
            mockMqttClient.connected = true;
            connectHandler?.(CONNACK_SESSION);
        };

        /** Resolves all pending subscribe callbacks so topics are added to subscribedTopics[]. */
        const resolveSubscriptions = () => {
            (mockMqttClient.subscribe as jest.Mock).mock.calls.forEach(
                ([topic, , cb]: [string, unknown, SubscribeCallback]) => {
                    cb?.(null, [{ topic, qos: 1 }]);
                },
            );
        };

        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            // Capture before clearing — clearAllMocks() wipes on.mock.calls
            connectHandler = getEventHandler<(p: Partial<ConnackPacket>) => void>(
                mockMqttClient,
                'connect',
            );
            jest.clearAllMocks();
        });

        it.each(['nurtura/rack/+/sensors', 'nurtura/rack/+/status', 'nurtura/rack/+/errors'])(
            'should subscribe to %s topic',
            (topic) => {
                fireConnect();
                expect(jest.spyOn(mockMqttClient, 'subscribe')).toHaveBeenCalledWith(
                    topic,
                    expect.objectContaining({ qos: 1 }),
                    expect.any(Function),
                );
            },
        );

        it('should use QoS 1 for all subscriptions', () => {
            fireConnect();
            (jest.spyOn(mockMqttClient, 'subscribe') as jest.SpyInstance).mock.calls.forEach(
                ([, opts]) => expect(opts).toMatchObject({ qos: 1 }),
            );
        });

        it('should log successful subscription', () => {
            fireConnect();
            const [topic, , cb] = (mockMqttClient.subscribe as jest.Mock).mock.calls[0] as [
                string,
                IClientSubscribeOptions,
                SubscribeCallback,
            ];
            cb?.(null, [{ topic, qos: 1 }]);
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                expect.stringContaining(`Subscribed to topic: ${topic}`),
                'MqttService',
            );
        });

        it('should log error on subscription failure', () => {
            fireConnect();
            const [, , cb] = (mockMqttClient.subscribe as jest.Mock).mock.calls[0] as [
                string,
                IClientSubscribeOptions,
                SubscribeCallback,
            ];
            cb?.(new Error('Subscription failed'), []);
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to subscribe to topic'),
                'Subscription failed',
                'MqttService',
            );
        });

        it('should not subscribe if client is not connected', () => {
            mockMqttClient.connected = false;
            connectHandler?.(CONNACK_SESSION);
            expect(jest.spyOn(mockMqttClient, 'subscribe')).not.toHaveBeenCalled();
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                'Cannot subscribe: MQTT client not connected',
                'MqttService',
            );
        });

        it('should prevent duplicate subscriptions on reconnect', () => {
            fireConnect();
            resolveSubscriptions();
            jest.clearAllMocks();

            // Second connect — all topics already tracked
            fireConnect();
            expect(jest.spyOn(mockMqttClient, 'subscribe')).not.toHaveBeenCalled();
            expect(mockLoggerService.debug).toHaveBeenCalledWith(
                expect.stringContaining('Already subscribed'),
                'MqttService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // message routing
    // ─────────────────────────────────────────────

    describe('message routing', () => {
        let messageHandler: MessageHandler;

        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            // Capture before clearing — clearAllMocks() wipes on.mock.calls
            messageHandler = getEventHandler<MessageHandler>(mockMqttClient, 'message')!;
            jest.clearAllMocks();
        });

        const topic = (type: string) => `nurtura/rack/${mqttTestMacAddresses.valid}/${type}`;

        it('should route sensor messages to SensorsService', async () => {
            await messageHandler(topic('sensors'), Buffer.from(mqttTestMessages.validSensorData));
            expect(mockSensorsService.processSensorData).toHaveBeenCalledWith(
                mqttTestMacAddresses.valid,
                mqttTestMessages.validSensorData,
            );
        });

        it('should route status messages to RacksService', async () => {
            await messageHandler(topic('status'), Buffer.from(mqttTestMessages.deviceOnline));
            expect(mockRacksService.processDeviceStatus).toHaveBeenCalledWith(
                mqttTestMacAddresses.valid,
                mqttTestMessages.deviceOnline,
            );
        });

        it('should route error messages to RacksService', async () => {
            await messageHandler(topic('errors'), Buffer.from(mqttTestMessages.deviceError));
            expect(mockRacksService.processDeviceError).toHaveBeenCalledWith(
                mqttTestMacAddresses.valid,
                mqttTestMessages.deviceError,
            );
        });

        it('should log the received topic', async () => {
            const t = topic('sensors');
            await messageHandler(t, Buffer.from(mqttTestMessages.validSensorData));
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Message received on topic: ${t}`,
                'MqttService',
            );
        });

        it('should warn on invalid topic format', async () => {
            await messageHandler('invalid/topic/format', Buffer.from('test'));
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid topic format'),
                'MqttService',
            );
        });

        it('should warn on unknown message type', async () => {
            await messageHandler(topic('unknown'), Buffer.from('test'));
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('Unknown message type'),
                'MqttService',
            );
        });

        it('should log error if message processing fails', async () => {
            mockSensorsService.processSensorData.mockRejectedValue(new Error('Processing failed'));
            await messageHandler(topic('sensors'), Buffer.from(mqttTestMessages.validSensorData));
            // The message handler uses a fire-and-forget .catch() — flush the microtask
            // queue so the rejection handler runs before we assert on the logger.
            await Promise.resolve();
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining('Error routing message'),
                'Processing failed',
                'MqttService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // publishCommand
    // ─────────────────────────────────────────────

    describe('publishCommand', () => {
        const mac = mqttTestMacAddresses.valid;

        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            mockMqttClient.connected = true;
            jest.clearAllMocks();
        });

        /** Makes client.publish() call its callback with no error. */
        const mockPublishSuccess = () => {
            mockMqttClient.publish.mockImplementation(
                (
                    _t: string,
                    _m: string | Buffer,
                    _o?: IClientPublishOptions,
                    cb?: (e?: Error, p?: Packet) => void,
                ) => {
                    cb?.();
                    return mockMqttClient;
                },
            );
        };

        /** Makes client.publish() call its callback with the given error. */
        const mockPublishError = (error: Error) => {
            mockMqttClient.publish.mockImplementation(
                (
                    _t: string,
                    _m: string | Buffer,
                    _o?: IClientPublishOptions,
                    cb?: (e?: Error, p?: Packet) => void,
                ) => {
                    cb?.(error);
                    return mockMqttClient;
                },
            );
        };

        it.each([
            ['watering', { action: 'on', duration: 5000 }],
            ['lighting', { action: 'on' }],
            ['sensors', { action: 'read' }],
        ] as const)('should publish %s command to the correct topic', async (type, payload) => {
            await service.publishCommand(mac, type, payload);
            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                `nurtura/rack/${mac}/commands/${type}`,
                JSON.stringify(payload),
                { qos: 1 },
                expect.any(Function),
            );
        });

        it('should use QoS 1 for all commands', async () => {
            await service.publishCommand(mac, 'watering', { action: 'on' });
            expect(jest.spyOn(mockMqttClient, 'publish')).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ qos: 1 }),
                expect.any(Function),
            );
        });

        it('should log the published command', async () => {
            mockPublishSuccess();
            await service.publishCommand(mac, 'watering', { action: 'on' });
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('Published command'),
                'MqttService',
            );
        });

        it('should throw if client is not connected', async () => {
            mockMqttClient.connected = false;
            await expect(service.publishCommand(mac, 'watering', { action: 'on' })).rejects.toThrow(
                'MQTT client not connected',
            );
        });

        it('should log error if client is not connected', async () => {
            mockMqttClient.connected = false;
            await expect(service.publishCommand(mac, 'watering', {})).rejects.toThrow();
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Cannot publish: MQTT client not connected',
                '',
                'MqttService',
            );
        });

        it('should reject if publish fails', async () => {
            mockPublishError(new Error('Publish failed'));
            await expect(service.publishCommand(mac, 'watering', {})).rejects.toThrow(
                'Publish failed',
            );
        });
    });

    // ─────────────────────────────────────────────
    // health check methods
    // ─────────────────────────────────────────────

    describe('health check methods', () => {
        let connectHandler: ((p: Partial<ConnackPacket>) => void) | undefined;
        let reconnectHandler: (() => void) | undefined;

        /** Triggers the persistent on-connect handler and resolves all subscribe callbacks. */
        const fireConnectAndResolveSubscriptions = () => {
            mockMqttClient.connected = true;
            connectHandler?.(CONNACK_SESSION);
            (mockMqttClient.subscribe as jest.Mock).mock.calls.forEach(
                ([topic, , cb]: [string, unknown, SubscribeCallback]) => {
                    cb?.(null, [{ topic, qos: 1 }]);
                },
            );
        };

        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            // Capture before clearing — clearAllMocks() wipes on.mock.calls
            connectHandler = getEventHandler<(p: Partial<ConnackPacket>) => void>(
                mockMqttClient,
                'connect',
            );
            reconnectHandler = getEventHandler<() => void>(mockMqttClient, 'reconnect');
            jest.clearAllMocks();
        });

        it('should return true when client is connected', () => {
            mockMqttClient.connected = true;
            expect(service.isConnected()).toBe(true);
        });

        it('should return false when client is not connected', () => {
            mockMqttClient.connected = false;
            expect(service.isConnected()).toBe(false);
        });

        it('should return the subscribed topics', () => {
            fireConnectAndResolveSubscriptions();
            expect(service.getSubscribedTopics()).toEqual(
                expect.arrayContaining([
                    'nurtura/rack/+/sensors',
                    'nurtura/rack/+/status',
                    'nurtura/rack/+/errors',
                ]),
            );
        });

        it('should return full connection status', () => {
            fireConnectAndResolveSubscriptions();
            expect(service.getConnectionStatus()).toEqual({
                connected: true,
                reconnectAttempts: 0,
                subscribedTopics: expect.arrayContaining([
                    'nurtura/rack/+/sensors',
                    'nurtura/rack/+/status',
                    'nurtura/rack/+/errors',
                ]) as unknown as string[],
            });
        });

        it('should track reconnect attempts in status', () => {
            reconnectHandler?.();
            reconnectHandler?.();
            expect(service.getConnectionStatus().reconnectAttempts).toBe(2);
        });
    });

    // ─────────────────────────────────────────────
    // onModuleDestroy
    // ─────────────────────────────────────────────

    describe('onModuleDestroy', () => {
        /** Makes client.end() call its callback immediately. */
        const mockEndCallback = () => {
            mockMqttClient.end.mockImplementation(
                (_force?: boolean, _opts?: Partial<IClientOptions>, cb?: () => void) => {
                    cb?.();
                    return mockMqttClient;
                },
            );
        };

        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
            jest.clearAllMocks();
        });

        it('should call client.end(false) on module destruction', async () => {
            mockEndCallback();
            await service.onModuleDestroy();
            expect(jest.spyOn(mockMqttClient, 'end')).toHaveBeenCalledWith(
                false,
                {},
                expect.any(Function),
            );
        });

        it('should log the closing message', async () => {
            mockEndCallback();
            await service.onModuleDestroy();
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'Closing MQTT connection...',
                'MqttService',
            );
        });

        it('should log graceful closure', async () => {
            mockEndCallback();
            await service.onModuleDestroy();
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'MQTT connection closed gracefully',
                'MqttService',
            );
        });

        it('should handle destruction if client is null', async () => {
            const svc = await buildModule({ MQTT_HOST: undefined }, createMockMqttClient());
            await expect(svc.onModuleDestroy()).resolves.not.toThrow();
        });
    });

    // ─────────────────────────────────────────────
    // integration
    // ─────────────────────────────────────────────

    describe('integration', () => {
        beforeEach(async () => {
            triggerConnect(mockMqttClient);
            await service.onModuleInit();
        });

        it('should use ConfigService during initialisation', () => {
            expect(mockConfigService.get).toHaveBeenCalled();
        });

        it('should use MyLoggerService during initialisation', () => {
            expect(mockLoggerService.bootstrap).toHaveBeenCalled();
        });

        it('should delegate sensor messages to SensorsService', async () => {
            const handler = getEventHandler<MessageHandler>(mockMqttClient, 'message')!;
            await handler(
                `nurtura/rack/${mqttTestMacAddresses.valid}/sensors`,
                Buffer.from(mqttTestMessages.validSensorData),
            );
            expect(mockSensorsService.processSensorData).toHaveBeenCalled();
        });

        it('should delegate status messages to RacksService', async () => {
            const handler = getEventHandler<MessageHandler>(mockMqttClient, 'message')!;
            await handler(
                `nurtura/rack/${mqttTestMacAddresses.valid}/status`,
                Buffer.from(mqttTestMessages.deviceOnline),
            );
            expect(mockRacksService.processDeviceStatus).toHaveBeenCalled();
        });
    });
});
