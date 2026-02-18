/**
 * WebSocket Mock Utilities
 * Reusable mocks for Socket.IO server and sockets
 */

import { type Namespace } from 'socket.io';
import type { WebsocketService } from '../../src/websocket/websocket.service';
import { type AuthenticatedSocket } from '../../src/websocket/interfaces/websocket.interface';

/**
 * Create mock Socket.IO Namespace
 */
export const createMockNamespace = (): jest.Mocked<Namespace> => {
    const mockEmit = jest.fn().mockReturnThis();
    const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

    return {
        to: mockTo,
        emit: mockEmit,
        adapter: {
            rooms: new Map(),
            sids: new Map(),
        },
        use: jest.fn(),
        on: jest.fn(),
        sockets: new Map(),
        server: {} as Namespace,
        name: '/realtime',
        connected: {},
        _fns: [],
        _rooms: new Set(),
        _except: new Set(),
        _flags: {},
        _adapter: {
            rooms: new Map(),
            sids: new Map(),
        },
    } as unknown as jest.Mocked<Namespace>;
};

/**
 * Create mock authenticated Socket
 */
export const createMockAuthenticatedSocket = (
    socketId: string = 'socket-123',
): jest.Mocked<AuthenticatedSocket> => {
    return {
        id: socketId,
        rooms: new Set([socketId]),
        data: {
            user: {
                dbId: '',
                firebaseUid: '',
                email: '',
            },
        },
        handshake: {
            auth: {},
            headers: {},
            time: new Date().toISOString(),
            address: '127.0.0.1',
            xdomain: false,
            secure: false,
            issued: Date.now(),
            url: '/realtime',
            query: {},
        },
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        disconnect: jest.fn().mockReturnThis(),
        connected: true,
        disconnected: false,
        to: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        use: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        write: jest.fn().mockReturnThis(),
        compress: jest.fn().mockReturnThis(),
        volatile: jest.fn().mockReturnThis(),
        broadcast: jest.fn().mockReturnThis(),
        local: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockReturnThis(),
        request: {} as Record<string, unknown>,
        client: {} as Record<string, unknown>,
        conn: {} as Record<string, unknown>,
        nsp: {} as Record<string, unknown>,
        server: {} as Record<string, unknown>,
    } as unknown as jest.Mocked<AuthenticatedSocket>;
};

/**
 * Create mock Socket with authentication error
 */
export const createMockUnauthenticatedSocket = (
    socketId: string = 'socket-unauth',
): jest.Mocked<AuthenticatedSocket> => {
    const socket = createMockAuthenticatedSocket(socketId);
    socket.handshake.auth = {};
    socket.handshake.headers = {};
    return socket;
};

/**
 * Create mock Socket with valid token
 */
export const createMockSocketWithToken = (
    token: string,
    socketId: string = 'socket-auth',
): jest.Mocked<AuthenticatedSocket> => {
    const socket = createMockAuthenticatedSocket(socketId);
    socket.handshake.auth.token = token;
    return socket;
};

/**
 * Create mock Socket with Bearer token in header
 */
export const createMockSocketWithBearerToken = (
    token: string,
    socketId: string = 'socket-bearer',
): jest.Mocked<AuthenticatedSocket> => {
    const socket = createMockAuthenticatedSocket(socketId);
    socket.handshake.auth = {};
    socket.handshake.headers.authorization = `Bearer ${token}`;
    return socket;
};

/**
 * Create mock WebsocketService
 */
export const createMockWebsocketService = (): jest.Mocked<WebsocketService> => {
    return {
        setServer: jest.fn(),
        validateConnection: jest.fn(),
        addClient: jest.fn(),
        removeClient: jest.fn(),
        validatePayload: jest.fn(),
        subscribeToRack: jest.fn(),
        unsubscribeFromRack: jest.fn(),
        getSubscribedRacks: jest.fn(),
        getTotalConnections: jest.fn(),
        getConnectionStats: jest.fn(),
        broadcastSensorData: jest.fn(),
        broadcastDeviceStatus: jest.fn(),
        broadcastNotification: jest.fn(),
        broadcastAutomationEvent: jest.fn(),
    } as unknown as jest.Mocked<WebsocketService>;
};
