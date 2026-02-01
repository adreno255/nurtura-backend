import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
    WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { FirebaseService } from '../firebase/firebase.service';
import { SensorsService } from '../sensors/sensors.service';
import { DecodedIdToken } from 'firebase-admin/auth';
import { type AuthenticatedSocket } from './interfaces/sensors-gateway.interface';
import { Notification, SensorReading } from '../generated/prisma';

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        credentials: true,
    },
    namespace: 'sensors',
})
export class SensorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedClients = new Map<string, { socket: AuthenticatedSocket; userId: string }>();

    constructor(
        private readonly logger: MyLoggerService,
        private readonly firebaseService: FirebaseService,
        private readonly sensorsService: SensorsService,
    ) {}

    // This runs when the Gateway starts
    afterInit(server: Server) {
        server.use((socket: Socket, next) => {
            this.validateConnection(socket)
                .then(() => next()) // Success: Proceed to handleConnection
                .catch((err) => {
                    const error = err instanceof Error ? err : new Error(String(err));
                    next(error);
                }); // Failure: Sends error to client & disconnects
        });
    }

    private async validateConnection(socket: AuthenticatedSocket): Promise<void> {
        const rawToken = (socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization) as string;

        if (!rawToken) {
            this.logger.warn(
                `Client ${socket.id} attempted connection without auth token`,
                'SensorGateway',
            );

            throw new WsException('AUTH_MISSING');
        }

        try {
            const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

            const decoded: DecodedIdToken = await this.firebaseService
                .getAuth()
                .verifyIdToken(token);

            socket.data.user = {
                uid: decoded.uid,
                email: decoded.email,
            };
        } catch (error) {
            this.logger.error(
                `Error handling connection for client ${socket.id}`,
                error instanceof Error ? error.message : String(error),
                'SensorGateway',
            );

            throw new WsException('AUTH_INVALID');
        }
    }

    // Use this if you want to bypass Authorization headers
    /*
    private async validateConnection(socket: AuthenticatedSocket): Promise<void> {
        await new Promise<void>((resolve) => {
            socket.data.user = {
                uid: 'test-uid',
                email: 'test@example.com',
            };

            resolve();
        });
    }
    */

    // Handle client connection
    handleConnection(client: AuthenticatedSocket) {
        this.connectedClients.set(client.id, {
            socket: client,
            userId: client.data.user.uid,
        });

        this.logger.log(
            `Client connected: ${client.id} (user: ${client.data.user.uid})`,
            'SensorGateway',
        );

        client.emit('connected', {
            message: 'Connected to sensor updates',
            userId: client.data.user.uid,
        });
    }

    // Handle client disconnection
    handleDisconnect(client: AuthenticatedSocket) {
        this.connectedClients.delete(client.id);

        this.logger.log(
            `Client disconnected: ${client.id} (Remaining: ${this.connectedClients.size})`,
            'SensorGateway',
        );
    }

    // Subscribe to specific rack's sensor updates
    @SubscribeMessage('subscribeToRack')
    async handleSubscribeToRack(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { rackId: string; userId: string },
    ) {
        try {
            const { rackId, userId } = data;

            await this.sensorsService.verifyRackOwnership(rackId, userId);

            // Join room for this rack
            await client.join(`rack-${rackId}`);

            // Update client info
            const clientInfo = this.connectedClients.get(client.id);
            if (clientInfo) {
                clientInfo.userId = userId;
            }

            this.logger.log(`Client ${client.id} subscribed to rack: ${rackId}`, 'SensorGateway');

            // Send latest sensor data immediately
            const latestReading = await this.sensorsService.getLatestReading(rackId);

            client.emit('initialData', {
                rackId,
                data: latestReading,
            });

            // Send acknowledgment
            client.emit('subscribed', {
                rackId,
                message: `Subscribed to rack ${rackId}`,
            });
        } catch (error) {
            this.logger.error(
                `Error subscribing client ${client.id}`,
                error instanceof Error ? error.message : String(error),
                'SensorGateway',
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
        @MessageBody() data: { rackId: string },
    ) {
        try {
            const { rackId } = data;

            await client.leave(`rack-${rackId}`);

            this.logger.log(
                `Client ${client.id} unsubscribed from rack: ${rackId}`,
                'SensorGateway',
            );

            client.emit('unsubscribed', {
                rackId,
                message: `Unsubscribed from rack ${rackId}`,
            });
        } catch (error) {
            this.logger.error(
                `Error unsubscribing client ${client.id}`,
                error instanceof Error ? error.message : String(error),
                'SensorGateway',
            );
        }
    }

    // Get current connection status
    @SubscribeMessage('getStatus')
    handleGetStatus(@ConnectedSocket() client: AuthenticatedSocket) {
        const rooms = Array.from(client.rooms).filter((room) => room !== client.id);

        client.emit('status', {
            connected: true,
            clientId: client.id,
            subscribedRacks: rooms.map((room) => room.replace('rack-', '')),
            totalConnections: this.connectedClients.size,
        });
    }

    // Broadcast new sensor data to all subscribed clients
    broadcastSensorData(rackId: string, data: SensorReading) {
        const room = `rack-${rackId}`;
        const clientsInRoom = this.server.sockets.adapter.rooms.get(room);
        const clientCount = clientsInRoom?.size || 0;

        this.logger.log(
            `Broadcasting sensor data for rack ${rackId} to ${clientCount} client(s)`,
            'SensorGateway',
        );

        this.server.to(room).emit('sensorData', {
            rackId,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    // Broadcast device status update
    broadcastDeviceStatus(rackId: string, status: string) {
        const room = `rack-${rackId}`;

        this.logger.log(
            `Broadcasting device status for rack ${rackId}: ${status}`,
            'SensorGateway',
        );

        this.server.to(room).emit('deviceStatus', {
            rackId,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    // Broadcast alert/notification
    broadcastAlert(rackId: string, notification: Notification) {
        const room = `rack-${rackId}`;

        this.logger.log(`Broadcasting alert for rack ${rackId}`, 'SensorGateway');

        this.server.to(room).emit('alert', {
            rackId,
            notification,
            timestamp: new Date().toISOString(),
        });
    }

    /*
    // Broadcast automation event
    broadcastAutomationEvent(rackId: string, event: any) {
        const room = `rack-${rackId}`;

        this.logger.log(`Broadcasting automation event for rack ${rackId}`, 'SensorGateway');

        this.server.to(room).emit('automationEvent', {
            rackId,
            event,
            timestamp: new Date().toISOString(),
        });
    }
    */

    // Get connection statistics
    getConnectionStats() {
        return {
            totalConnections: this.connectedClients.size,
            connections: Array.from(this.connectedClients.entries()).map(([id, info]) => ({
                clientId: id,
                userId: info.userId,
                rooms: Array.from(info.socket.rooms).filter((room) => room !== id),
            })),
        };
    }
}
