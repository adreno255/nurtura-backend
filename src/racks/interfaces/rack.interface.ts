import {
    type Rack,
    type DeviceStatus,
    type WateringState,
    type LightState,
} from '../../generated/prisma/client';

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

export interface RackExistsResponse {
    exists: boolean;
    rack?: Rack;
}

export interface AssignPlantToRackCheckResponse {
    hasWarning: boolean;
    latestTemperatureReading: number | null;
    maxTemperatureThreshold: number | null;
}

export interface AssignPlantToRackResponse {
    message: string;
}

export interface RackActuatorState {
    watering: WateringState;
    light: LightState;
}

export interface RackWithCurrentPlant extends Partial<Rack> {
    currentPlant?: {
        id: string;
        name: string;
    } | null;
}

export interface RackWithUserAndCurrentPlant extends Rack {
    userId: string;
    currentPlant?: {
        id: string;
        name: string;
    } | null;
}
