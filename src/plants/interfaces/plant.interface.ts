import { type Plant, type PlantType } from '../../generated/prisma';

export interface PlantCreatedResponse {
    message: string;
    plant: Plant;
}

export interface PlantUpdatedResponse {
    message: string;
    plant: Plant;
}

export interface PlantDeletedResponse {
    message: string;
}

export interface PlantDetailsResponse {
    message: string;
    plant: Plant;
}

export interface PlantQueryParams {
    type?: PlantType;
    isActive?: boolean;
}
