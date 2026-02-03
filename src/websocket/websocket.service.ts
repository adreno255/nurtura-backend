import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorsService } from '../sensors/sensors.service';
import { RacksService } from '../racks/racks.service';
import { type DecodedIdToken } from 'firebase-admin/auth';
import { type Notification, type SensorReading } from '../generated/prisma';
import {
    type AuthenticatedSocket,
    type ConnectedClient,
    type ConnectionStats,
    type InitialDataResponse,
} from './interfaces/websocket.interface';

@Injectable()
export class WebsocketService {
    private server: Server | null = null;
    private connectedClients = new Map<string, ConnectedClient>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly sensorsService: SensorsService,
        private readonly racksService: RacksService,
        private readonly logger: MyLoggerService,
    ) {}

    // ==================== Server Initialization ====================

    setServer(server: Server): void {
        this.server = server;
        this.logger.log('WebSocket server instance registered', 'WebsocketService');
    }

    private ensureServerInitialized(): Server {
        if (!this.server) {
            throw new Error('WebSocket server not initialized');
        }
        return this.server;
    }

    // ==================== Authentication ====================

    async validateConnection(socket: AuthenticatedSocket): Promise<void> {
        const rawToken = (socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization) as string;

        if (!rawToken) {
            this.logger.warn(
                `Client ${socket.id} attempted connection without auth token`,
                'WebsocketService',
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
                email: decoded.email ?? '',
            };

            this.logger.log(`Token validated for user: ${decoded.uid}`, 'WebsocketService');
        } catch (error) {
            this.logger.error(
                `Token validation failed for client ${socket.id}`,
                error instanceof Error ? error.message : String(error),
                'WebsocketService',
            );

            throw new WsException('AUTH_INVALID');
        }
    }

    // For testing purposes only - bypasses Firebase authentication
    async validateConnectionBypass(socket: AuthenticatedSocket): Promise<void> {
        await new Promise<void>((resolve) => {
            socket.data.user = {
                uid: 'test-uid',
                email: 'test@example.com',
            };

            this.logger.warn(
                `Auth bypass enabled for client ${socket.id} - FOR TESTING ONLY`,
                'WebsocketService',
            );

            resolve();
        });
    }

    // ==================== Connection Management ====================

    addClient(socket: AuthenticatedSocket): void {
        this.connectedClients.set(socket.id, {
            socket,
            userId: socket.data.user.uid,
        });

        this.logger.log(
            `Client connected: ${socket.id} (user: ${socket.data.user.uid})`,
            'WebsocketService',
        );
    }

    removeClient(clientId: string): void {
        this.connectedClients.delete(clientId);

        this.logger.log(
            `Client disconnected: ${clientId} (Remaining: ${this.connectedClients.size})`,
            'WebsocketService',
        );
    }

    getClient(clientId: string): ConnectedClient | undefined {
        return this.connectedClients.get(clientId);
    }

    updateClientUserId(clientId: string, userId: string): void {
        const clientInfo = this.connectedClients.get(clientId);
        if (clientInfo) {
            clientInfo.userId = userId;
            this.logger.log(
                `Updated userId for client ${clientId} to ${userId}`,
                'WebsocketService',
            );
        }
    }

    getTotalConnections(): number {
        return this.connectedClients.size;
    }

    getConnectionStats(): ConnectionStats {
        return {
            totalConnections: this.connectedClients.size,
            connections: Array.from(this.connectedClients.entries()).map(([id, info]) => ({
                clientId: id,
                userId: info.userId,
                rooms: Array.from(info.socket.rooms).filter((room) => room !== id),
            })),
        };
    }

    // ==================== Room Management ====================

    async joinRoom(socket: AuthenticatedSocket, rackId: string): Promise<void> {
        await socket.join(`rack-${rackId}`);
        this.logger.log(`Client ${socket.id} joined room: rack-${rackId}`, 'WebsocketService');
    }

    async leaveRoom(socket: AuthenticatedSocket, rackId: string): Promise<void> {
        await socket.leave(`rack-${rackId}`);
        this.logger.log(`Client ${socket.id} left room: rack-${rackId}`, 'WebsocketService');
    }

    getSubscribedRacks(socket: AuthenticatedSocket): string[] {
        return Array.from(socket.rooms)
            .filter((room) => room !== socket.id && room.startsWith('rack-'))
            .map((room) => room.replace('rack-', ''));
    }

    getRoomClientCount(rackId: string): number {
        const server = this.ensureServerInitialized();
        const room = `rack-${rackId}`;
        const clientsInRoom = server.sockets.adapter.rooms.get(room);
        return clientsInRoom?.size || 0;
    }

    // ==================== Subscription Logic ====================

    async subscribeToRack(
        socket: AuthenticatedSocket,
        rackId: string,
        userId: string,
    ): Promise<InitialDataResponse> {
        // Verify ownership
        await this.racksService.verifyRackOwnership(rackId, userId);

        // Join room
        await this.joinRoom(socket, rackId);

        // Update client info
        this.updateClientUserId(socket.id, userId);

        // Get latest data
        const latestReading = await this.sensorsService.getLatestReading(rackId);

        this.logger.log(
            `Client ${socket.id} successfully subscribed to rack ${rackId}`,
            'WebsocketService',
        );

        return {
            rackId,
            data: latestReading,
        };
    }

    async unsubscribeFromRack(socket: AuthenticatedSocket, rackId: string): Promise<void> {
        await this.leaveRoom(socket, rackId);

        this.logger.log(`Client ${socket.id} unsubscribed from rack ${rackId}`, 'WebsocketService');
    }

    // ==================== Broadcasting ====================

    broadcastSensorData(rackId: string, data: SensorReading): void {
        const server = this.ensureServerInitialized();
        const room = `rack-${rackId}`;
        const clientCount = this.getRoomClientCount(rackId);

        this.logger.log(
            `Broadcasting sensor data for rack ${rackId} to ${clientCount} client(s)`,
            'WebsocketService',
        );

        server.to(room).emit('sensorData', {
            rackId,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    broadcastDeviceStatus(rackId: string, status: string): void {
        const server = this.ensureServerInitialized();
        const room = `rack-${rackId}`;

        this.logger.log(
            `Broadcasting device status for rack ${rackId}: ${status}`,
            'WebsocketService',
        );

        server.to(room).emit('deviceStatus', {
            rackId,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    broadcastAlert(rackId: string, notification: Notification): void {
        const server = this.ensureServerInitialized();
        const room = `rack-${rackId}`;

        this.logger.log(`Broadcasting alert for rack ${rackId}`, 'WebsocketService');

        server.to(room).emit('alert', {
            rackId,
            notification,
            timestamp: new Date().toISOString(),
        });
    }

    /*
    broadcastAutomationEvent(rackId: string, event: any): void {
        const server = this.ensureServerInitialized();
        const room = `rack-${rackId}`;

        this.logger.log(`Broadcasting automation event for rack ${rackId}`, 'WebsocketService');

        server.to(room).emit('automationEvent', {
            rackId,
            event,
            timestamp: new Date().toISOString(),
        });
    }
    */
}
