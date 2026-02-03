import { type Socket } from 'socket.io';
import { type SensorReading } from '../../generated/prisma';

export interface AuthenticatedSocket extends Socket {
    data: {
        user: {
            uid: string;
            email: string;
        };
    };
}

export interface ConnectedClient {
    socket: AuthenticatedSocket;
    userId: string;
}

export interface ConnectionStats {
    totalConnections: number;
    connections: {
        clientId: string;
        userId: string;
        rooms: string[];
    }[];
}

export interface InitialDataResponse {
    rackId: string;
    data: SensorReading | null;
}
