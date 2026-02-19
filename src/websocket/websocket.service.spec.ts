import { Test, type TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { WebsocketService } from './websocket.service';
import { DatabaseService } from '../database/database.service';
import { FirebaseService } from '../firebase/firebase.service';
import { SensorsService } from '../sensors/sensors.service';
import { RacksService } from '../racks/racks.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import {
    createMockDatabaseService,
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockLogger,
    createMockRacksService,
    createMockSensorsService,
    FirebaseAuthErrors,
} from '../../test/mocks';
import {
    createMockNamespace,
    createMockAuthenticatedSocket,
} from '../../test/mocks/websocket.mock';
import {
    mockSensorReading,
    mockNotification,
    mockAutomationEvent,
    validFirebaseToken,
    validDbUser,
} from '../../test/fixtures';
import { IsString } from 'class-validator';

describe('WebsocketService', () => {
    let service: WebsocketService;
    let mockNamespace: ReturnType<typeof createMockNamespace>;
    let mockSocket: ReturnType<typeof createMockAuthenticatedSocket>;

    const mockDatabaseService = createMockDatabaseService();
    const mockFirebaseAuth = createMockFirebaseAuth();
    const mockFirebaseService = createMockFirebaseService(mockFirebaseAuth);
    const mockLoggerService = createMockLogger();
    const mockSensorsService = createMockSensorsService();
    const mockRacksService = createMockRacksService();

    beforeEach(async () => {
        jest.clearAllMocks();

        mockNamespace = createMockNamespace();
        mockSocket = createMockAuthenticatedSocket();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebsocketService,
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
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
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<WebsocketService>(WebsocketService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('setServer', () => {
        it('should set server instance', () => {
            service.setServer(mockNamespace);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'WebSocket server instance registered',
                'WebsocketService',
            );
        });

        it('should allow server to be accessed after setting', () => {
            service.setServer(mockNamespace);

            // Should not throw when broadcasting
            expect(() => service.broadcastSensorData('rack-123', mockSensorReading)).not.toThrow();
        });
    });

    describe('validateConnection', () => {
        beforeEach(() => {
            mockFirebaseAuth.verifyIdToken.mockResolvedValue(validFirebaseToken);
            mockDatabaseService.user.findUnique.mockResolvedValue(validDbUser);
        });

        it('should validate connection with Bearer token', async () => {
            mockSocket.handshake.auth.token = `Bearer ${validFirebaseToken.uid}`;

            await service.validateConnection(mockSocket);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalled();
            expect(mockSocket.data.user).toEqual({
                dbId: validDbUser.id,
                firebaseUid: validDbUser.firebaseUid,
                email: validDbUser.email,
            });
        });

        it('should validate connection with token from auth object', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;

            await service.validateConnection(mockSocket);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith(validFirebaseToken.uid);
        });

        it('should validate connection with token from authorization header', async () => {
            mockSocket.handshake.auth.token = undefined;
            mockSocket.handshake.headers.authorization = `Bearer ${validFirebaseToken.uid}`;

            await service.validateConnection(mockSocket);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith(validFirebaseToken.uid);
        });

        it('should strip Bearer prefix from token', async () => {
            mockSocket.handshake.auth.token = `Bearer test-token-123`;

            await service.validateConnection(mockSocket);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('test-token-123');
        });

        it('should query database for user', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;

            await service.validateConnection(mockSocket);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid: validFirebaseToken.uid },
                select: { id: true, firebaseUid: true, email: true },
            });
        });

        it('should set user data on socket', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;

            await service.validateConnection(mockSocket);

            expect(mockSocket.data.user).toEqual({
                dbId: validDbUser.id,
                firebaseUid: validDbUser.firebaseUid,
                email: validDbUser.email,
            });
        });

        it('should log successful validation', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;

            await service.validateConnection(mockSocket);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Token validated for user: ${validDbUser.email}`,
                'WebsocketService',
            );
        });

        it('should throw WsException if no token provided', async () => {
            mockSocket.handshake.auth.token = undefined;
            mockSocket.handshake.headers.authorization = undefined;

            await expect(service.validateConnection(mockSocket)).rejects.toThrow(
                new WsException('AUTH_MISSING'),
            );
        });

        it('should log warning when token is missing', async () => {
            mockSocket.handshake.auth.token = undefined;
            mockSocket.handshake.headers.authorization = undefined;

            await expect(service.validateConnection(mockSocket)).rejects.toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                `Client ${mockSocket.id} attempted connection without auth token`,
                'WebsocketService',
            );
        });

        it('should throw WsException if user not found in database', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.validateConnection(mockSocket)).rejects.toThrow(
                new WsException('AUTH_INVALID'),
            );
        });

        it('should log warning when user not found in database', async () => {
            mockSocket.handshake.auth.token = validFirebaseToken.uid;
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.validateConnection(mockSocket)).rejects.toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                `No corresponding user found in database for UID: ${validFirebaseToken.uid}`,
                'FirebaseJwtStrategy',
            );
        });

        it('should throw WsException on Firebase token verification failure', async () => {
            mockSocket.handshake.auth.token = 'invalid-token';
            mockFirebaseAuth.verifyIdToken.mockRejectedValue(FirebaseAuthErrors.invalidIdToken());

            await expect(service.validateConnection(mockSocket)).rejects.toThrow(
                new WsException('AUTH_INVALID'),
            );
        });

        it('should log error on token validation failure', async () => {
            mockSocket.handshake.auth.token = 'invalid-token';
            const tokenError = FirebaseAuthErrors.invalidIdToken();
            mockFirebaseAuth.verifyIdToken.mockRejectedValue(tokenError);

            await expect(service.validateConnection(mockSocket)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Token validation failed for client ${mockSocket.id}`,
                tokenError.message,
                'WebsocketService',
            );
        });

        it('should handle expired tokens', async () => {
            mockSocket.handshake.auth.token = 'expired-token';
            mockFirebaseAuth.verifyIdToken.mockRejectedValue(FirebaseAuthErrors.idTokenExpired());

            await expect(service.validateConnection(mockSocket)).rejects.toThrow(
                new WsException('AUTH_INVALID'),
            );
        });
    });

    describe('validateConnectionBypass', () => {
        it('should set test user data', async () => {
            await service.validateConnectionBypass(mockSocket);

            expect(mockSocket.data.user).toEqual({
                dbId: 'test-uid',
                firebaseUid: 'test-firebase-uid',
                email: 'test@example.com',
            });
        });

        it('should log warning about bypass', async () => {
            await service.validateConnectionBypass(mockSocket);

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                `Auth bypass enabled for client ${mockSocket.id} - FOR TESTING ONLY`,
                'WebsocketService',
            );
        });

        it('should resolve without errors', async () => {
            await expect(service.validateConnectionBypass(mockSocket)).resolves.not.toThrow();
        });
    });

    describe('connection management', () => {
        beforeEach(() => {
            mockSocket.data.user = {
                dbId: 'user-123',
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };
        });

        describe('addClient', () => {
            it('should add client to connected clients', () => {
                service.addClient(mockSocket);

                const client = service.getClient(mockSocket.id);
                expect(client).toBeDefined();
                expect(client?.socket).toBe(mockSocket);
                expect(client?.userId).toBe('user-123');
            });

            it('should log client connection', () => {
                service.addClient(mockSocket);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Client connected: ${mockSocket.id} (user: user-123)`,
                    'WebsocketService',
                );
            });

            it('should increment total connections', () => {
                const initialCount = service.getTotalConnections();

                service.addClient(mockSocket);

                expect(service.getTotalConnections()).toBe(initialCount + 1);
            });
        });

        describe('removeClient', () => {
            beforeEach(() => {
                service.addClient(mockSocket);
            });

            it('should remove client from connected clients', () => {
                service.removeClient(mockSocket.id);

                const client = service.getClient(mockSocket.id);
                expect(client).toBeUndefined();
            });

            it('should log client disconnection', () => {
                service.removeClient(mockSocket.id);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    expect.stringContaining(`Client disconnected: ${mockSocket.id}`),
                    'WebsocketService',
                );
            });

            it('should decrement total connections', () => {
                const initialCount = service.getTotalConnections();

                service.removeClient(mockSocket.id);

                expect(service.getTotalConnections()).toBe(initialCount - 1);
            });
        });

        describe('getClient', () => {
            it('should return client if exists', () => {
                service.addClient(mockSocket);

                const client = service.getClient(mockSocket.id);

                expect(client).toBeDefined();
                expect(client?.socket).toBe(mockSocket);
            });

            it('should return undefined if client does not exist', () => {
                const client = service.getClient('non-existent-id');

                expect(client).toBeUndefined();
            });
        });

        describe('updateClientUserId', () => {
            beforeEach(() => {
                service.addClient(mockSocket);
            });

            it('should update client userId', () => {
                service.updateClientUserId(mockSocket.id, 'new-user-id');

                const client = service.getClient(mockSocket.id);
                expect(client?.userId).toBe('new-user-id');
            });

            it('should log userId update', () => {
                service.updateClientUserId(mockSocket.id, 'new-user-id');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Updated userId for client ${mockSocket.id} to new-user-id`,
                    'WebsocketService',
                );
            });

            it('should handle non-existent client gracefully', () => {
                expect(() =>
                    service.updateClientUserId('non-existent-id', 'new-user-id'),
                ).not.toThrow();
            });
        });

        describe('getTotalConnections', () => {
            it('should return 0 when no clients connected', () => {
                expect(service.getTotalConnections()).toBe(0);
            });

            it('should return correct count with multiple clients', () => {
                const socket2 = createMockAuthenticatedSocket('socket-2');
                const socket3 = createMockAuthenticatedSocket('socket-3');

                socket2.data.user = mockSocket.data.user;
                socket3.data.user = mockSocket.data.user;

                service.addClient(mockSocket);
                service.addClient(socket2);
                service.addClient(socket3);

                expect(service.getTotalConnections()).toBe(3);
            });
        });

        describe('getConnectionStats', () => {
            beforeEach(() => {
                Object.defineProperty(mockSocket, 'rooms', {
                    value: new Set([mockSocket.id, 'rack-rack1', 'rack-rack2']),
                    writable: true,
                });
            });

            it('should return connection statistics', () => {
                service.addClient(mockSocket);

                const stats = service.getConnectionStats();

                expect(stats.totalConnections).toBe(1);
                expect(stats.connections).toHaveLength(1);
            });

            it('should include client details', () => {
                service.addClient(mockSocket);

                const stats = service.getConnectionStats();

                expect(stats.connections[0]).toEqual({
                    clientId: mockSocket.id,
                    userId: 'user-123',
                    rooms: ['rack-rack1', 'rack-rack2'],
                });
            });

            it('should filter out client own room', () => {
                service.addClient(mockSocket);

                const stats = service.getConnectionStats();

                expect(stats.connections[0].rooms).not.toContain(mockSocket.id);
            });

            it('should return empty stats when no clients', () => {
                const stats = service.getConnectionStats();

                expect(stats).toEqual({
                    totalConnections: 0,
                    connections: [],
                });
            });
        });
    });

    describe('room management', () => {
        beforeEach(() => {
            service.setServer(mockNamespace);
        });

        describe('joinRoom', () => {
            it('should join client to rack room', async () => {
                await service.joinRoom(mockSocket, 'rack-123');

                expect(jest.spyOn(mockSocket, 'join')).toHaveBeenCalledWith('rack-rack-123');
            });

            it('should log room join', async () => {
                await service.joinRoom(mockSocket, 'rack-123');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Client ${mockSocket.id} joined room: rack-rack-123`,
                    'WebsocketService',
                );
            });
        });

        describe('leaveRoom', () => {
            beforeEach(async () => {
                await service.joinRoom(mockSocket, 'rack-123');
            });

            it('should remove client from rack room', async () => {
                await service.leaveRoom(mockSocket, 'rack-123');

                expect(jest.spyOn(mockSocket, 'leave')).toHaveBeenCalledWith('rack-rack-123');
            });

            it('should log room leave', async () => {
                await service.leaveRoom(mockSocket, 'rack-123');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Client ${mockSocket.id} left room: rack-rack-123`,
                    'WebsocketService',
                );
            });
        });

        describe('getSubscribedRacks', () => {
            it('should return subscribed rack IDs', () => {
                Object.defineProperty(mockSocket, 'rooms', {
                    value: new Set([mockSocket.id, 'rack-rack1', 'rack-rack2', 'other-room']),
                    writable: true,
                });

                const racks = service.getSubscribedRacks(mockSocket);

                expect(racks).toEqual(['rack1', 'rack2']);
            });

            it('should filter out non-rack rooms', () => {
                Object.defineProperty(mockSocket, 'rooms', {
                    value: new Set([mockSocket.id, 'rack-rack1', 'user-room']),
                    writable: true,
                });

                const racks = service.getSubscribedRacks(mockSocket);

                expect(racks).toEqual(['rack1']);
            });

            it('should filter out socket own room', () => {
                Object.defineProperty(mockSocket, 'rooms', {
                    value: new Set([mockSocket.id, 'rack-rack1']),
                    writable: true,
                });

                const racks = service.getSubscribedRacks(mockSocket);

                expect(racks).not.toContain(mockSocket.id);
            });

            it('should return empty array when no rack rooms', () => {
                Object.defineProperty(mockSocket, 'rooms', {
                    value: new Set([mockSocket.id]),
                    writable: true,
                });

                const racks = service.getSubscribedRacks(mockSocket);

                expect(racks).toEqual([]);
            });
        });

        describe('getRoomClientCount', () => {
            it('should return client count in room', () => {
                const mockRoom = new Set(['client-1', 'client-2', 'client-3']);
                mockNamespace.adapter.rooms.set('rack-rack-123', mockRoom);

                const count = service.getRoomClientCount('rack-123');

                expect(count).toBe(3);
            });

            it('should return 0 if room does not exist', () => {
                const count = service.getRoomClientCount('non-existent-rack');

                expect(count).toBe(0);
            });

            it('should return 0 if adapter not ready', () => {
                mockNamespace.adapter = null as unknown as typeof mockNamespace.adapter;

                const count = service.getRoomClientCount('rack-123');

                expect(count).toBe(0);
                expect(mockLoggerService.warn).toHaveBeenCalledWith('Namespace adapter not ready');
            });
        });
    });

    describe('subscription logic', () => {
        beforeEach(() => {
            service.setServer(mockNamespace);
            mockSocket.data.user = {
                dbId: 'user-123',
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };
            service.addClient(mockSocket);
        });

        describe('subscribeToRack', () => {
            beforeEach(() => {
                mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
                mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);
            });

            it('should verify rack ownership', async () => {
                await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(mockRacksService.verifyRackOwnership).toHaveBeenCalledWith(
                    'rack-123',
                    'user-123',
                );
            });

            it('should join rack room', async () => {
                await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(jest.spyOn(mockSocket, 'join')).toHaveBeenCalledWith('rack-rack-123');
            });

            it('should update client userId', async () => {
                await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                const client = service.getClient(mockSocket.id);
                expect(client?.userId).toBe('user-123');
            });

            it('should get latest sensor reading', async () => {
                await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(mockSensorsService.getLatestReading).toHaveBeenCalledWith('rack-123');
            });

            it('should return initial data response', async () => {
                const result = await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(result).toEqual({
                    rackId: 'rack-123',
                    data: mockSensorReading,
                });
            });

            it('should log successful subscription', async () => {
                await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Client ${mockSocket.id} successfully subscribed to rack rack-123`,
                    'WebsocketService',
                );
            });

            it('should handle null sensor reading', async () => {
                mockSensorsService.getLatestReading.mockResolvedValue(null);

                const result = await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

                expect(result.data).toBeNull();
            });

            it('should throw if rack ownership verification fails', async () => {
                mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Not authorized'));

                await expect(
                    service.subscribeToRack(mockSocket, 'rack-123', 'user-123'),
                ).rejects.toThrow('Not authorized');
            });
        });

        describe('unsubscribeFromRack', () => {
            beforeEach(async () => {
                await service.joinRoom(mockSocket, 'rack-123');
            });

            it('should leave rack room', async () => {
                await service.unsubscribeFromRack(mockSocket, 'rack-123');

                expect(jest.spyOn(mockSocket, 'leave')).toHaveBeenCalledWith('rack-rack-123');
            });

            it('should log unsubscription', async () => {
                await service.unsubscribeFromRack(mockSocket, 'rack-123');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `Client ${mockSocket.id} unsubscribed from rack rack-123`,
                    'WebsocketService',
                );
            });
        });
    });

    describe('validatePayload', () => {
        class TestDto {
            @IsString()
            value!: string;
        }

        it('should return validated DTO instance', async () => {
            const data = { value: 'test' };

            const result = await service.validatePayload(mockSocket, data, TestDto);

            expect(result).toBeInstanceOf(TestDto);
            expect(result.value).toBe('test');
        });

        it('should throw WsException on validation error', async () => {
            const invalidData = { invalid: 'data' };

            await expect(service.validatePayload(mockSocket, invalidData, TestDto)).rejects.toThrow(
                WsException,
            );
        });
    });

    describe('broadcasting', () => {
        beforeEach(() => {
            service.setServer(mockNamespace);
            const mockRoom = new Set(['client-1', 'client-2']);
            mockNamespace.adapter.rooms.set('rack-rack-123', mockRoom);
        });

        describe('broadcastSensorData', () => {
            it('should broadcast sensor data to room', () => {
                service.broadcastSensorData('rack-123', mockSensorReading);

                expect(jest.spyOn(mockNamespace, 'to')).toHaveBeenCalledWith('rack-rack-123');
                expect(jest.spyOn(mockNamespace, 'emit')).toHaveBeenCalledWith('sensorData', {
                    rackId: 'rack-123',
                    data: mockSensorReading,
                    timestamp: expect.any(String) as string,
                });
            });

            it('should log broadcast with client count', () => {
                service.broadcastSensorData('rack-123', mockSensorReading);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    'Broadcasting sensor data for rack rack-123 to 2 client(s)',
                    'WebsocketService',
                );
            });

            it('should handle broadcast error gracefully', () => {
                mockNamespace.to.mockImplementationOnce(() => {
                    throw new Error('Broadcast failed');
                });

                expect(() =>
                    service.broadcastSensorData('rack-123', mockSensorReading),
                ).not.toThrow();

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    'Failed to broadcast sensor data for rack rack-123',
                    'Broadcast failed',
                    'WebsocketService',
                );
            });

            it('should log an error if server not initialized', () => {
                const uninitializedService = new WebsocketService(
                    mockDatabaseService as unknown as DatabaseService,
                    mockFirebaseService as unknown as FirebaseService,
                    mockSensorsService as unknown as SensorsService,
                    mockRacksService as unknown as RacksService,
                    mockLoggerService as unknown as MyLoggerService,
                );

                uninitializedService.broadcastSensorData('rack-123', mockSensorReading);

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    `Failed to broadcast sensor data for rack rack-123`,
                    'WebSocket server not initialized yet',
                    'WebsocketService',
                );
            });
        });

        describe('broadcastDeviceStatus', () => {
            it('should broadcast device status to room', () => {
                service.broadcastDeviceStatus('rack-123', 'ONLINE');

                expect(jest.spyOn(mockNamespace, 'to')).toHaveBeenCalledWith('rack-rack-123');
                expect(jest.spyOn(mockNamespace, 'emit')).toHaveBeenCalledWith('deviceStatus', {
                    rackId: 'rack-123',
                    status: 'ONLINE',
                    timestamp: expect.any(String) as string,
                });
            });

            it('should log status broadcast', () => {
                service.broadcastDeviceStatus('rack-123', 'ONLINE');

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    'Broadcasting device status for rack rack-123: ONLINE',
                    'WebsocketService',
                );
            });

            it('should handle broadcast error gracefully', () => {
                mockNamespace.to.mockImplementationOnce(() => {
                    throw new Error('Broadcast failed');
                });

                expect(() => service.broadcastDeviceStatus('rack-123', 'ONLINE')).not.toThrow();

                expect(mockLoggerService.error).toHaveBeenCalled();
            });
        });

        describe('broadcastNotification', () => {
            it('should broadcast notification to room', () => {
                service.broadcastNotification('rack-123', mockNotification);

                expect(jest.spyOn(mockNamespace, 'to')).toHaveBeenCalledWith('rack-rack-123');
                expect(jest.spyOn(mockNamespace, 'emit')).toHaveBeenCalledWith('notification', {
                    rackId: 'rack-123',
                    notification: mockNotification,
                    timestamp: expect.any(String) as string,
                });
            });

            it('should log notification broadcast', () => {
                service.broadcastNotification('rack-123', mockNotification);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    'Broadcasting notification for rack rack-123',
                    'WebsocketService',
                );
            });

            it('should handle broadcast error gracefully', () => {
                mockNamespace.to.mockImplementationOnce(() => {
                    throw new Error('Broadcast failed');
                });

                expect(() =>
                    service.broadcastNotification('rack-123', mockNotification),
                ).not.toThrow();

                expect(mockLoggerService.error).toHaveBeenCalled();
            });
        });

        describe('broadcastAutomationEvent', () => {
            it('should broadcast automation event to room', () => {
                service.broadcastAutomationEvent('rack-123', mockAutomationEvent);

                expect(jest.spyOn(mockNamespace, 'to')).toHaveBeenCalledWith('rack-rack-123');
                expect(jest.spyOn(mockNamespace, 'emit')).toHaveBeenCalledWith('automationEvent', {
                    rackId: 'rack-123',
                    event: mockAutomationEvent,
                    timestamp: expect.any(String) as string,
                });
            });

            it('should log automation event broadcast', () => {
                service.broadcastAutomationEvent('rack-123', mockAutomationEvent);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    'Broadcasting automation event for rack rack-123',
                    'WebsocketService',
                );
            });

            it('should handle broadcast error gracefully', () => {
                mockNamespace.to.mockImplementationOnce(() => {
                    throw new Error('Broadcast failed');
                });

                expect(() =>
                    service.broadcastAutomationEvent('rack-123', mockAutomationEvent),
                ).not.toThrow();

                expect(mockLoggerService.error).toHaveBeenCalled();
            });
        });
    });

    describe('error scenarios', () => {
        it('should handle database connection errors during validation', async () => {
            mockSocket.handshake.auth.token = 'valid-token';
            mockFirebaseAuth.verifyIdToken.mockResolvedValue(validFirebaseToken);
            mockDatabaseService.user.findUnique.mockRejectedValue(
                new Error('Database connection failed'),
            );

            await expect(service.validateConnection(mockSocket)).rejects.toThrow(
                new WsException('AUTH_INVALID'),
            );
        });

        it('should handle missing adapter in namespace', () => {
            service.setServer(mockNamespace);
            mockNamespace.adapter = null as unknown as typeof mockNamespace.adapter;

            const count = service.getRoomClientCount('rack-123');

            expect(count).toBe(0);
        });

        it('should handle null sensor reading gracefully', async () => {
            service.setServer(mockNamespace);
            mockSocket.data.user = {
                dbId: 'user-123',
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };

            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getLatestReading.mockResolvedValue(null);

            const result = await service.subscribeToRack(mockSocket, 'rack-123', 'user-123');

            expect(result.data).toBeNull();
        });
    });

    describe('multiple clients', () => {
        it('should handle multiple concurrent connections', () => {
            const socket1 = createMockAuthenticatedSocket('socket-1');
            const socket2 = createMockAuthenticatedSocket('socket-2');
            const socket3 = createMockAuthenticatedSocket('socket-3');

            socket1.data.user = { dbId: 'user-1', firebaseUid: 'fb-1', email: 'user1@test.com' };
            socket2.data.user = { dbId: 'user-2', firebaseUid: 'fb-2', email: 'user2@test.com' };
            socket3.data.user = { dbId: 'user-3', firebaseUid: 'fb-3', email: 'user3@test.com' };

            service.addClient(socket1);
            service.addClient(socket2);
            service.addClient(socket3);

            expect(service.getTotalConnections()).toBe(3);

            const stats = service.getConnectionStats();
            expect(stats.connections).toHaveLength(3);
        });

        it('should handle client reconnection', () => {
            mockSocket.data.user = {
                dbId: 'user-123',
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };

            service.addClient(mockSocket);
            service.removeClient(mockSocket.id);
            service.addClient(mockSocket);

            expect(service.getTotalConnections()).toBe(1);
        });
    });
});
