import { type Plant, type PlantCategory } from '../../generated/prisma';

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
    category?: PlantCategory;
    isActive?: boolean;
}
