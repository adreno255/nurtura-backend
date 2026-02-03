import { type Rack, type DeviceStatus } from '../../generated/prisma/client';

export interface RackCreatedResponse {
    message: string;
    rackId: string;
}

export interface RackUpdatedResponse {
    message: string;
}

export interface RackDeletedResponse {
    message: string;
}

export interface RackDetailsResponse {
    message: string;
    rack: Rack;
}

export interface DeviceStatusResponse {
    message: string;
    status: DeviceStatus;
    lastSeenAt: Date | null;
}

export interface CommandResponse {
    message: string;
    commandType: string;
    timestamp: Date;
}

export interface RackCurrentStateResponse {
    message: string;
    rack: {
        id: string;
        name: string;
        status: DeviceStatus;
        lastSeenAt: Date | null;
    };
    latestReading: {
        temperature: number;
        humidity: number;
        moisture: number;
        lightLevel: number;
        timestamp: Date;
    } | null;
}
