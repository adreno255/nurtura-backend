import {
    type Rack,
    type DeviceStatus,
    type PlantCategory,
    type SoilType,
} from '../../generated/prisma/client';

export interface RackWithPlant extends Rack {
    currentPlant: {
        id: string;
        name: string;
        category: PlantCategory | null;
        recommendedSoil: SoilType | null;
        description: string | null;
    } | null;
}

export interface RackCreatedResponse {
    message: string;
    rackId: string;
}

export interface RackUpdatedResponse {
    message: string;
    rack: Rack;
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
        waterUsed: number | null;
        timestamp: Date;
    } | null;
}
