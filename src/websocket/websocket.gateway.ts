import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { WebsocketService } from './websocket.service';
import { type AuthenticatedSocket } from './interfaces/websocket.interface';
import { SubscribeToRackDto, UnsubscribeFromRackDto } from './dto/websocket.dto';
import type { Notification, SensorReading } from '../generated/prisma';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
    cors: {
        origin: '*',
        credentials: true,
    },
    namespace: 'sensors',
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Namespace;

    constructor(
        private readonly logger: MyLoggerService,
        private readonly websocketService: WebsocketService,
    ) {}

    // ==================== Server Initialization ====================

    // Initialize gateway and setup middleware
    afterInit(server: Namespace): void {
        // Register server instance with service
        this.websocketService.setServer(server);

        // Setup authentication middleware
        server.use((socket: Socket, next) => {
            this.websocketService
                .validateConnection(socket as AuthenticatedSocket)
                .then(() => next())
                .catch((err) => {
                    const error = err instanceof Error ? err : new Error(String(err));
                    next(error);
                });
        });

        this.logger.log('WebSocket Gateway initialized', 'WebsocketGateway');
    }

    // Handle client connection
    handleConnection(client: AuthenticatedSocket): void {
        this.websocketService.addClient(client);

        client.emit('connected', {
            message: 'Connected to sensor updates',
            userId: client.data.user.dbId,
        });
    }

    // Handle client disconnection
    handleDisconnect(client: AuthenticatedSocket): void {
        this.websocketService.removeClient(client.id);
    }

    // ==================== Client-specific Events ====================

    // Subscribe to specific rack's sensor updates
    @SubscribeMessage('subscribeToRack')
    async handleSubscribeToRack(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: SubscribeToRackDto,
    ) {
        try {
            const { rackId } = data;

            // Subscribe and get initial data
            const initialData = await this.websocketService.subscribeToRack(
                client,
                rackId,
                client.data.user.dbId,
            );

            // Send initial data
            client.emit('initialData', initialData);

            // Send subscription acknowledgment
            client.emit('subscribed', {
                rackId,
                message: `Subscribed to rack ${rackId}`,
            });
        } catch (error) {
            this.logger.error(
                `Error subscribing client ${client.id}`,
                error instanceof Error ? error.message : String(error),
                'WebsocketGateway',
            );

            client.emit('error', {
                message: 'Failed to subscribe to rack',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // Unsubscribe from rack updates
    @SubscribeMessage('unsubscribeFromRack')
    async handleUnsubscribeFromRack(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: UnsubscribeFromRackDto,
    ) {
        try {
            const { rackId } = data;

            await this.websocketService.unsubscribeFromRack(client, rackId);

            client.emit('unsubscribed', {
                rackId,
                message: `Unsubscribed from rack ${rackId}`,
            });
        } catch (error) {
            this.logger.error(
                `Error unsubscribing client ${client.id}`,
                error instanceof Error ? error.message : String(error),
                'WebsocketGateway',
            );

            client.emit('error', {
                message: 'Failed to unsubscribe from rack',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // Get current connection status
    @SubscribeMessage('getStatus')
    handleGetStatus(@ConnectedSocket() client: AuthenticatedSocket) {
        const subscribedRacks = this.websocketService.getSubscribedRacks(client);

        client.emit('status', {
            connected: true,
            clientId: client.id,
            subscribedRacks,
            totalConnections: this.websocketService.getTotalConnections(),
        });
    }

    // ==================== Public Events for External Services ====================
    // These are called by other services (e.g., SensorsService, RacksService) to broadcast updates to clients

    @OnEvent('broadcastSensorData')
    broadcastSensorData(rackId: string, data: SensorReading) {
        this.websocketService.broadcastSensorData(rackId, data);
    }

    broadcastDeviceStatus(rackId: string, status: string) {
        this.websocketService.broadcastDeviceStatus(rackId, status);
    }

    broadcastAlert(rackId: string, notification: Notification) {
        this.websocketService.broadcastAlert(rackId, notification);
    }

    // broadcastAutomationEvent(rackId: string, event: any) {
    //     this.websocketService.broadcastAutomationEvent(rackId, event);
    // }

    getConnectionStats() {
        return this.websocketService.getConnectionStats();
    }
}
