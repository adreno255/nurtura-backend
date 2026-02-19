import { Test, type TestingModule } from '@nestjs/testing';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { WsException } from '@nestjs/websockets';
import {
    createMockLogger,
    createMockNamespace,
    createMockAuthenticatedSocket,
    createMockWebsocketService,
} from '../../test/mocks';
import {
    mockSensorReading,
    mockNotification,
    mockAutomationEvent,
    testRackIds,
    testUserIds,
    testUser,
} from '../../test/fixtures';
import { SubscribeToRackDto, UnsubscribeFromRackDto } from './dto/websocket.dto';
import { type AuthenticatedSocket } from './interfaces/websocket.interface';
import { type Namespace } from 'socket.io';

describe('WebsocketGateway', () => {
    let gateway: WebsocketGateway;

    const mockLogger = createMockLogger();
    const mockWebsocketService = createMockWebsocketService();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebsocketGateway,
                {
                    provide: WebsocketService,
                    useValue: mockWebsocketService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        gateway = module.get<WebsocketGateway>(WebsocketGateway);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('afterInit', () => {
        it('should register server with websocket service', () => {
            const mockServer = createMockNamespace();

            gateway.afterInit(mockServer);

            expect(mockWebsocketService.setServer).toHaveBeenCalledWith(mockServer);
        });

        it('should setup authentication middleware', () => {
            const mockServer = createMockNamespace();

            gateway.afterInit(mockServer);

            expect(jest.spyOn(mockServer, 'use')).toHaveBeenCalled();
        });

        it('should log successful initialization', () => {
            const mockServer = createMockNamespace();

            gateway.afterInit(mockServer);

            expect(mockLogger.log).toHaveBeenCalledWith(
                'WebSocket Gateway initialized',
                'WebsocketGateway',
            );
        });

        it('should setup middleware that validates connections', async () => {
            const mockServer = createMockNamespace();
            const mockSocket = createMockAuthenticatedSocket();
            const next = jest.fn();

            mockWebsocketService.validateConnection.mockResolvedValue(undefined);

            gateway.afterInit(mockServer);

            // Get the middleware function
            const middleware = (mockServer.use as jest.MockedFunction<Namespace['use']>).mock
                .calls[0][0] as (
                socket: AuthenticatedSocket,
                next: (err?: Error) => void,
            ) => Promise<void>;

            // Call middleware
            await middleware(mockSocket, next);

            expect(mockWebsocketService.validateConnection).toHaveBeenCalledWith(mockSocket);
            expect(next).toHaveBeenCalledWith();
        });

        it('should setup middleware that catches validation errors', async () => {
            const mockServer = createMockNamespace();
            const mockSocket = createMockAuthenticatedSocket();
            const next = jest.fn<void, [Error?]>();
            const validationError = new WsException('AUTH_INVALID');

            mockWebsocketService.validateConnection.mockRejectedValue(validationError);

            gateway.afterInit(mockServer);

            const middleware = (mockServer.use as jest.MockedFunction<Namespace['use']>).mock
                .calls[0][0] as (
                socket: AuthenticatedSocket,
                next: (err?: Error) => void,
            ) => Promise<void>;

            await middleware(mockSocket, next);
            await Promise.resolve();
            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should convert non-Error exceptions to Error in middleware', async () => {
            const mockServer = createMockNamespace();
            const mockSocket = createMockAuthenticatedSocket();
            const next = jest.fn<void, [Error?]>();

            mockWebsocketService.validateConnection.mockRejectedValue('String error');

            gateway.afterInit(mockServer);

            const middleware = (mockServer.use as jest.MockedFunction<Namespace['use']>).mock
                .calls[0][0] as (
                socket: AuthenticatedSocket,
                next: (err?: Error) => void,
            ) => Promise<void>;

            await middleware(mockSocket, next);
            await Promise.resolve();

            expect(next).toHaveBeenCalledWith(expect.any(Error));
            const error = next.mock.calls[0][0] as Error;
            expect(error.message).toBe('String error');
        });
    });

    describe('handleConnection', () => {
        it('should add client to websocket service', () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            gateway.handleConnection(mockClient);

            expect(mockWebsocketService.addClient).toHaveBeenCalledWith(mockClient);
        });

        it('should emit connected event to client', () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = {
                dbId: testUserIds.primary,
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };

            gateway.handleConnection(mockClient);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('connected', {
                message: 'Connected to sensor updates',
                userId: testUserIds.primary,
            });
        });

        it('should handle connection for multiple clients', () => {
            const client1 = createMockAuthenticatedSocket('socket-1');
            const client2 = createMockAuthenticatedSocket('socket-2');

            client1.data.user = { dbId: 'user-1', firebaseUid: 'fb-1', email: 'user1@test.com' };
            client2.data.user = { dbId: 'user-2', firebaseUid: 'fb-2', email: 'user2@test.com' };

            gateway.handleConnection(client1);
            gateway.handleConnection(client2);

            expect(mockWebsocketService.addClient).toHaveBeenCalledTimes(2);
            expect(jest.spyOn(client1, 'emit')).toHaveBeenCalledWith(
                'connected',
                expect.objectContaining({ userId: 'user-1' }),
            );
            expect(jest.spyOn(client2, 'emit')).toHaveBeenCalledWith(
                'connected',
                expect.objectContaining({ userId: 'user-2' }),
            );
        });
    });

    describe('handleDisconnect', () => {
        it('should remove client from websocket service', () => {
            const mockClient = createMockAuthenticatedSocket('socket-123');

            gateway.handleDisconnect(mockClient);

            expect(mockWebsocketService.removeClient).toHaveBeenCalledWith('socket-123');
        });

        it('should handle disconnection of multiple clients', () => {
            const client1 = createMockAuthenticatedSocket('socket-1');
            const client2 = createMockAuthenticatedSocket('socket-2');

            gateway.handleDisconnect(client1);
            gateway.handleDisconnect(client2);

            expect(mockWebsocketService.removeClient).toHaveBeenCalledTimes(2);
            expect(mockWebsocketService.removeClient).toHaveBeenNthCalledWith(1, 'socket-1');
            expect(mockWebsocketService.removeClient).toHaveBeenNthCalledWith(2, 'socket-2');
        });
    });

    describe('handleSubscribeToRack', () => {
        const subscribeDto: SubscribeToRackDto = {
            rackId: testRackIds.primary,
        };

        it('should validate payload before subscribing', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockResolvedValue({
                rackId: testRackIds.primary,
                data: mockSensorReading,
            });

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(mockWebsocketService.validatePayload).toHaveBeenCalledWith(
                mockClient,
                subscribeDto,
                SubscribeToRackDto,
            );
        });

        it('should subscribe client to rack', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = {
                dbId: testUserIds.primary,
                firebaseUid: 'firebase-uid-123',
                email: 'user@example.com',
            };

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockResolvedValue({
                rackId: testRackIds.primary,
                data: mockSensorReading,
            });

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(mockWebsocketService.subscribeToRack).toHaveBeenCalledWith(
                mockClient,
                testRackIds.primary,
                testUserIds.primary,
            );
        });

        it('should emit initial data to client', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            const initialData = {
                rackId: testRackIds.primary,
                data: mockSensorReading,
            };

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockResolvedValue(initialData);

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('initialData', initialData);
        });

        it('should emit subscription acknowledgment', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockResolvedValue({
                rackId: testRackIds.primary,
                data: mockSensorReading,
            });

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('subscribedAck', {
                rackId: testRackIds.primary,
                message: `Subscribed to rack ${testRackIds.primary}`,
            });
        });

        it('should handle validation errors', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;
            const validationError = new WsException('VALIDATION_ERROR');

            mockWebsocketService.validatePayload.mockRejectedValue(validationError);

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error subscribing client ${mockClient.id}`,
                'VALIDATION_ERROR',
                'WebsocketGateway',
            );

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to subscribe to rack',
                error: 'VALIDATION_ERROR',
            });
        });

        it('should handle subscription errors', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;
            const subscriptionError = new Error('Rack not found');

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockRejectedValue(subscriptionError);

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error subscribing client ${mockClient.id}`,
                'Rack not found',
                'WebsocketGateway',
            );

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to subscribe to rack',
                error: 'Rack not found',
            });
        });

        it('should handle non-Error exceptions', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockRejectedValue('String error');

            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to subscribe to rack',
                error: 'Unknown error',
            });
        });

        it('should subscribe to multiple racks', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            const dto1: SubscribeToRackDto = { rackId: 'rack-1' };
            const dto2: SubscribeToRackDto = { rackId: 'rack-2' };

            mockWebsocketService.validatePayload
                .mockResolvedValueOnce(dto1)
                .mockResolvedValueOnce(dto2);
            mockWebsocketService.subscribeToRack
                .mockResolvedValueOnce({ rackId: 'rack-1', data: mockSensorReading })
                .mockResolvedValueOnce({ rackId: 'rack-2', data: mockSensorReading });

            await gateway.handleSubscribeToRack(mockClient, dto1);
            await gateway.handleSubscribeToRack(mockClient, dto2);

            expect(mockWebsocketService.subscribeToRack).toHaveBeenCalledTimes(2);
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'subscribedAck',
                expect.objectContaining({ rackId: 'rack-1' }),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'subscribedAck',
                expect.objectContaining({ rackId: 'rack-2' }),
            );
        });
    });

    describe('handleUnsubscribeFromRack', () => {
        const unsubscribeDto: UnsubscribeFromRackDto = {
            rackId: testRackIds.primary,
        };

        it('should validate payload before unsubscribing', async () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValue(undefined);

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(mockWebsocketService.validatePayload).toHaveBeenCalledWith(
                mockClient,
                unsubscribeDto,
                UnsubscribeFromRackDto,
            );
        });

        it('should unsubscribe client from rack', async () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValue(undefined);

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(mockWebsocketService.unsubscribeFromRack).toHaveBeenCalledWith(
                mockClient,
                testRackIds.primary,
            );
        });

        it('should emit unsubscription acknowledgment', async () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValue(undefined);

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('unsubscribedAck', {
                rackId: testRackIds.primary,
                message: `Unsubscribed from rack ${testRackIds.primary}`,
            });
        });

        it('should handle validation errors', async () => {
            const mockClient = createMockAuthenticatedSocket();
            const validationError = new WsException('VALIDATION_ERROR');

            mockWebsocketService.validatePayload.mockRejectedValue(validationError);

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error unsubscribing client ${mockClient.id}`,
                'VALIDATION_ERROR',
                'WebsocketGateway',
            );

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to unsubscribe from rack',
                error: 'VALIDATION_ERROR',
            });
        });

        it('should handle unsubscription errors', async () => {
            const mockClient = createMockAuthenticatedSocket();
            const unsubscribeError = new Error('Rack not found');

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockRejectedValue(unsubscribeError);

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error unsubscribing client ${mockClient.id}`,
                'Rack not found',
                'WebsocketGateway',
            );

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to unsubscribe from rack',
                error: 'Rack not found',
            });
        });

        it('should handle non-Error exceptions', async () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockRejectedValue('String error');

            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('error', {
                message: 'Failed to unsubscribe from rack',
                error: 'Unknown error',
            });
        });

        it('should unsubscribe from multiple racks', async () => {
            const mockClient = createMockAuthenticatedSocket();

            const dto1: UnsubscribeFromRackDto = { rackId: 'rack-1' };
            const dto2: UnsubscribeFromRackDto = { rackId: 'rack-2' };

            mockWebsocketService.validatePayload
                .mockResolvedValueOnce(dto1)
                .mockResolvedValueOnce(dto2);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValue(undefined);

            await gateway.handleUnsubscribeFromRack(mockClient, dto1);
            await gateway.handleUnsubscribeFromRack(mockClient, dto2);

            expect(mockWebsocketService.unsubscribeFromRack).toHaveBeenCalledTimes(2);
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'unsubscribedAck',
                expect.objectContaining({ rackId: 'rack-1' }),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'unsubscribedAck',
                expect.objectContaining({ rackId: 'rack-2' }),
            );
        });
    });

    describe('handleGetStatus', () => {
        it('should get subscribed racks from service', () => {
            const mockClient = createMockAuthenticatedSocket();
            const subscribedRacks = [testRackIds.primary, testRackIds.secondary];

            mockWebsocketService.getSubscribedRacks.mockReturnValue(subscribedRacks);
            mockWebsocketService.getTotalConnections.mockReturnValue(5);

            gateway.handleGetStatus(mockClient);

            expect(mockWebsocketService.getSubscribedRacks).toHaveBeenCalledWith(mockClient);
        });

        it('should get total connections from service', () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.getSubscribedRacks.mockReturnValue([]);
            mockWebsocketService.getTotalConnections.mockReturnValue(10);

            gateway.handleGetStatus(mockClient);

            expect(mockWebsocketService.getTotalConnections).toHaveBeenCalled();
        });

        it('should emit status acknowledgment with all info', () => {
            const mockClient = createMockAuthenticatedSocket('socket-123');
            const subscribedRacks = [testRackIds.primary];

            mockWebsocketService.getSubscribedRacks.mockReturnValue(subscribedRacks);
            mockWebsocketService.getTotalConnections.mockReturnValue(3);

            gateway.handleGetStatus(mockClient);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith('statusAck', {
                connected: true,
                clientId: 'socket-123',
                subscribedRacks: [testRackIds.primary],
                totalConnections: 3,
            });
        });

        it('should handle client with no subscriptions', () => {
            const mockClient = createMockAuthenticatedSocket();

            mockWebsocketService.getSubscribedRacks.mockReturnValue([]);
            mockWebsocketService.getTotalConnections.mockReturnValue(1);

            gateway.handleGetStatus(mockClient);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'statusAck',
                expect.objectContaining({
                    subscribedRacks: [],
                }),
            );
        });

        it('should handle client with multiple subscriptions', () => {
            const mockClient = createMockAuthenticatedSocket();
            const multipleRacks = ['rack-1', 'rack-2', 'rack-3'];

            mockWebsocketService.getSubscribedRacks.mockReturnValue(multipleRacks);
            mockWebsocketService.getTotalConnections.mockReturnValue(5);

            gateway.handleGetStatus(mockClient);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'statusAck',
                expect.objectContaining({
                    subscribedRacks: multipleRacks,
                }),
            );
        });
    });

    describe('broadcastSensorData', () => {
        it('should delegate to websocket service', () => {
            gateway.broadcastSensorData(testRackIds.primary, mockSensorReading);

            expect(mockWebsocketService.broadcastSensorData).toHaveBeenCalledWith(
                testRackIds.primary,
                mockSensorReading,
            );
        });

        it('should broadcast to multiple racks', () => {
            gateway.broadcastSensorData('rack-1', mockSensorReading);
            gateway.broadcastSensorData('rack-2', mockSensorReading);

            expect(mockWebsocketService.broadcastSensorData).toHaveBeenCalledTimes(2);
        });

        it('should pass through sensor reading data', () => {
            const sensorData = {
                ...mockSensorReading,
                temperature: 30.5,
                humidity: 75.0,
            };

            gateway.broadcastSensorData(testRackIds.primary, sensorData);

            expect(mockWebsocketService.broadcastSensorData).toHaveBeenCalledWith(
                testRackIds.primary,
                sensorData,
            );
        });
    });

    describe('broadcastDeviceStatus', () => {
        it('should delegate to websocket service', () => {
            gateway.broadcastDeviceStatus(testRackIds.primary, 'ONLINE');

            expect(mockWebsocketService.broadcastDeviceStatus).toHaveBeenCalledWith(
                testRackIds.primary,
                'ONLINE',
            );
        });

        it('should broadcast different statuses', () => {
            const statuses = ['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE'];

            statuses.forEach((status) => {
                gateway.broadcastDeviceStatus(testRackIds.primary, status);
            });

            expect(mockWebsocketService.broadcastDeviceStatus).toHaveBeenCalledTimes(4);
        });

        it('should broadcast to multiple racks', () => {
            gateway.broadcastDeviceStatus('rack-1', 'ONLINE');
            gateway.broadcastDeviceStatus('rack-2', 'OFFLINE');

            expect(mockWebsocketService.broadcastDeviceStatus).toHaveBeenCalledTimes(2);
        });
    });

    describe('broadcastNotification', () => {
        it('should delegate to websocket service', () => {
            gateway.broadcastNotification(testRackIds.primary, mockNotification);

            expect(mockWebsocketService.broadcastNotification).toHaveBeenCalledWith(
                testRackIds.primary,
                mockNotification,
            );
        });

        it('should broadcast to multiple racks', () => {
            gateway.broadcastNotification('rack-1', mockNotification);
            gateway.broadcastNotification('rack-2', mockNotification);

            expect(mockWebsocketService.broadcastNotification).toHaveBeenCalledTimes(2);
        });

        it('should pass through notification data', () => {
            const notification = {
                ...mockNotification,
                title: 'Custom Alert',
                message: 'Custom message',
            };

            gateway.broadcastNotification(testRackIds.primary, notification);

            expect(mockWebsocketService.broadcastNotification).toHaveBeenCalledWith(
                testRackIds.primary,
                notification,
            );
        });
    });

    describe('broadcastAutomationEvent', () => {
        it('should delegate to websocket service', () => {
            gateway.broadcastAutomationEvent(testRackIds.primary, mockAutomationEvent);

            expect(mockWebsocketService.broadcastAutomationEvent).toHaveBeenCalledWith(
                testRackIds.primary,
                mockAutomationEvent,
            );
        });

        it('should broadcast to multiple racks', () => {
            gateway.broadcastAutomationEvent('rack-1', mockAutomationEvent);
            gateway.broadcastAutomationEvent('rack-2', mockAutomationEvent);

            expect(mockWebsocketService.broadcastAutomationEvent).toHaveBeenCalledTimes(2);
        });

        it('should pass through automation event data', () => {
            const event = {
                ...mockAutomationEvent,
                ruleName: 'Custom Rule',
                eventType: 'LIGHT_ON' as const,
            };

            gateway.broadcastAutomationEvent(testRackIds.primary, event);

            expect(mockWebsocketService.broadcastAutomationEvent).toHaveBeenCalledWith(
                testRackIds.primary,
                event,
            );
        });
    });

    describe('getConnectionStats', () => {
        it('should delegate to websocket service', () => {
            const mockStats = {
                totalConnections: 5,
                connections: [
                    {
                        clientId: 'socket-1',
                        userId: 'user-1',
                        rooms: ['rack-rack-1'],
                    },
                ],
            };

            mockWebsocketService.getConnectionStats.mockReturnValue(mockStats);

            const result = gateway.getConnectionStats();

            expect(mockWebsocketService.getConnectionStats).toHaveBeenCalled();
            expect(result).toEqual(mockStats);
        });

        it('should return empty stats when no connections', () => {
            const emptyStats = {
                totalConnections: 0,
                connections: [],
            };

            mockWebsocketService.getConnectionStats.mockReturnValue(emptyStats);

            const result = gateway.getConnectionStats();

            expect(result).toEqual(emptyStats);
        });

        it('should return stats with multiple connections', () => {
            const multipleStats = {
                totalConnections: 3,
                connections: [
                    { clientId: 'socket-1', userId: 'user-1', rooms: ['rack-rack-1'] },
                    { clientId: 'socket-2', userId: 'user-2', rooms: ['rack-rack-2'] },
                    {
                        clientId: 'socket-3',
                        userId: 'user-1',
                        rooms: ['rack-rack-1', 'rack-rack-3'],
                    },
                ],
            };

            mockWebsocketService.getConnectionStats.mockReturnValue(multipleStats);

            const result = gateway.getConnectionStats();

            expect(result.totalConnections).toBe(3);
            expect(result.connections).toHaveLength(3);
        });
    });

    describe('integration scenarios', () => {
        it('should handle full subscription flow', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            const subscribeDto: SubscribeToRackDto = { rackId: testRackIds.primary };

            mockWebsocketService.validatePayload.mockResolvedValue(subscribeDto);
            mockWebsocketService.subscribeToRack.mockResolvedValue({
                rackId: testRackIds.primary,
                data: mockSensorReading,
            });
            mockWebsocketService.getSubscribedRacks.mockReturnValue([testRackIds.primary]);
            mockWebsocketService.getTotalConnections.mockReturnValue(1);

            // Connect
            gateway.handleConnection(mockClient);

            // Subscribe
            await gateway.handleSubscribeToRack(mockClient, subscribeDto);

            // Get status
            gateway.handleGetStatus(mockClient);

            expect(mockWebsocketService.addClient).toHaveBeenCalledWith(mockClient);
            expect(mockWebsocketService.subscribeToRack).toHaveBeenCalled();
            expect(mockWebsocketService.getSubscribedRacks).toHaveBeenCalledWith(mockClient);
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'connected',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'initialData',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'subscribedAck',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'statusAck',
                expect.any(Object),
            );
        });

        it('should handle full unsubscription flow', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            const unsubscribeDto: UnsubscribeFromRackDto = { rackId: testRackIds.primary };

            mockWebsocketService.validatePayload.mockResolvedValue(unsubscribeDto);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValue(undefined);
            mockWebsocketService.getSubscribedRacks.mockReturnValue([]);

            // Unsubscribe
            await gateway.handleUnsubscribeFromRack(mockClient, unsubscribeDto);

            // Get status
            gateway.handleGetStatus(mockClient);

            expect(mockWebsocketService.unsubscribeFromRack).toHaveBeenCalledWith(
                mockClient,
                testRackIds.primary,
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'unsubscribedAck',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'statusAck',
                expect.objectContaining({ subscribedRacks: [] }),
            );
        });

        it('should handle connection lifecycle', () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            // Connect
            gateway.handleConnection(mockClient);

            // Disconnect
            gateway.handleDisconnect(mockClient);

            expect(mockWebsocketService.addClient).toHaveBeenCalledWith(mockClient);
            expect(mockWebsocketService.removeClient).toHaveBeenCalledWith(mockClient.id);
        });

        it('should handle multiple clients simultaneously', async () => {
            const client1 = createMockAuthenticatedSocket('socket-1');
            const client2 = createMockAuthenticatedSocket('socket-2');

            client1.data.user = { dbId: 'user-1', firebaseUid: 'fb-1', email: 'user1@test.com' };
            client2.data.user = { dbId: 'user-2', firebaseUid: 'fb-2', email: 'user2@test.com' };

            const dto1: SubscribeToRackDto = { rackId: 'rack-1' };
            const dto2: SubscribeToRackDto = { rackId: 'rack-2' };

            mockWebsocketService.validatePayload.mockResolvedValue(dto1).mockResolvedValue(dto2);
            mockWebsocketService.subscribeToRack
                .mockResolvedValueOnce({ rackId: 'rack-1', data: mockSensorReading })
                .mockResolvedValueOnce({ rackId: 'rack-2', data: mockSensorReading });

            // Connect both clients
            gateway.handleConnection(client1);
            gateway.handleConnection(client2);

            // Subscribe both clients
            await gateway.handleSubscribeToRack(client1, dto1);
            await gateway.handleSubscribeToRack(client2, dto2);

            expect(mockWebsocketService.addClient).toHaveBeenCalledTimes(2);
            expect(mockWebsocketService.subscribeToRack).toHaveBeenCalledTimes(2);
        });
    });

    describe('error resilience', () => {
        it('should continue operating after subscription error', async () => {
            const mockClient = createMockAuthenticatedSocket();
            mockClient.data.user = testUser;

            const dto: SubscribeToRackDto = { rackId: testRackIds.primary };

            // First subscription fails
            mockWebsocketService.validatePayload.mockRejectedValueOnce(new Error('First error'));

            // Second subscription succeeds
            mockWebsocketService.validatePayload.mockResolvedValueOnce(dto);
            mockWebsocketService.subscribeToRack.mockResolvedValueOnce({
                rackId: testRackIds.primary,
                data: mockSensorReading,
            });

            await gateway.handleSubscribeToRack(mockClient, dto);
            await gateway.handleSubscribeToRack(mockClient, dto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'error',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'subscribedAck',
                expect.any(Object),
            );
        });

        it('should continue operating after unsubscription error', async () => {
            const mockClient = createMockAuthenticatedSocket();

            const dto: UnsubscribeFromRackDto = { rackId: testRackIds.primary };

            // First unsubscription fails
            mockWebsocketService.validatePayload.mockRejectedValueOnce(new Error('First error'));

            // Second unsubscription succeeds
            mockWebsocketService.validatePayload.mockResolvedValueOnce(dto);
            mockWebsocketService.unsubscribeFromRack.mockResolvedValueOnce(undefined);

            await gateway.handleUnsubscribeFromRack(mockClient, dto);
            await gateway.handleUnsubscribeFromRack(mockClient, dto);

            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'error',
                expect.any(Object),
            );
            expect(jest.spyOn(mockClient, 'emit')).toHaveBeenCalledWith(
                'unsubscribedAck',
                expect.any(Object),
            );
        });
    });
});
