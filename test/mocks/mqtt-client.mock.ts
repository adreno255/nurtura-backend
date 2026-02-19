import { type MqttClient } from 'mqtt';

/**
 * Creates a mock MQTT client for testing
 * Simulates the behavior of the mqtt library's client
 */
export function createMockMqttClient(): jest.Mocked<MqttClient> {
    return {
        connected: true,
        reconnecting: false,

        // Connection methods
        connect: jest.fn().mockReturnThis(),
        end: jest.fn((force?: boolean, opts?: object, cb?: () => void) => {
            if (cb) cb();
            return {} as MqttClient;
        }),

        // Publish/Subscribe methods
        publish: jest.fn(
            (topic: string, message: string | Buffer, opts: any, cb?: (error?: Error) => void) => {
                if (cb) cb();
                return {} as MqttClient;
            },
        ),
        subscribe: jest.fn(
            (
                topic: string | string[],
                opts: { qos?: number } | undefined,
                cb?: (error: Error | null, granted?: any[]) => void,
            ) => {
                if (cb) cb(null, [{ topic, qos: opts?.qos || 0 }]);
                return {} as MqttClient;
            },
        ),
        unsubscribe: jest.fn(
            (topic: string | string[], opts: any, cb?: (error?: Error) => void) => {
                if (cb) cb();
                return {} as MqttClient;
            },
        ),

        // Event emitter methods
        on: jest.fn().mockReturnThis(),
        once: jest.fn().mockReturnThis(),
        removeListener: jest.fn().mockReturnThis(),
        removeAllListeners: jest.fn().mockReturnThis(),
        emit: jest.fn(),

        // Stream methods
        setMaxListeners: jest.fn().mockReturnThis(),
        getMaxListeners: jest.fn().mockReturnValue(10),
        listeners: jest.fn().mockReturnValue([]),
        rawListeners: jest.fn().mockReturnValue([]),
        listenerCount: jest.fn().mockReturnValue(0),
        prependListener: jest.fn().mockReturnThis(),
        prependOnceListener: jest.fn().mockReturnThis(),
        eventNames: jest.fn().mockReturnValue([]),

        // MQTT-specific methods
        reconnect: jest.fn().mockReturnThis(),
        handleMessage: jest.fn(),
        getLastMessageId: jest.fn().mockReturnValue(1),

        // Additional properties
        options: {
            host: 'test-broker.example.com',
            port: 8883,
            protocol: 'mqtts',
            reconnectPeriod: 5000,
        },

        // Stream properties
        readable: true,
        writable: true,

        // Other required methods from EventEmitter and Stream
        addListener: jest.fn().mockReturnThis(),
        off: jest.fn().mockReturnThis(),
        setEncoding: jest.fn().mockReturnThis(),
        pause: jest.fn().mockReturnThis(),
        resume: jest.fn().mockReturnThis(),
        isPaused: jest.fn().mockReturnValue(false),
        pipe: jest.fn().mockReturnThis(),
        unpipe: jest.fn().mockReturnThis(),
        unshift: jest.fn(),
        wrap: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        read: jest.fn(),

        // Async iterator methods
        [Symbol.asyncIterator]: jest.fn(),

        // Other stream methods
        cork: jest.fn(),
        uncork: jest.fn(),
        write: jest.fn(),

        // Cast as unknown then to MqttClient to satisfy TypeScript
    } as unknown as jest.Mocked<MqttClient>;
}
