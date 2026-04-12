/**
 * Plants Test Fixtures
 * Reusable test data for plant-related tests
 */

import { PlantCategory, SoilType } from '../../src/generated/prisma';
import type { CreatePlantDto } from '../../src/plants/dto/create-plant.dto';
import type { UpdatePlantDto } from '../../src/plants/dto/update-plant.dto';
import type { PlantCategoryQueryDto } from '../../src/plants/dto/plant-category-query.dto';

// ─────────────────────────────────────────────
// IDs
// ─────────────────────────────────────────────

export const testPlantIds = {
    primary: 'plant-abc123',
    secondary: 'plant-def456',
    inactive: 'plant-inactive-789',
    nonExistent: 'plant-nonexistent-000',
};

// ─────────────────────────────────────────────
// BASE PLANT OBJECTS
// ─────────────────────────────────────────────

export const mockPlant = {
    id: testPlantIds.primary,
    name: 'Lettuce',
    category: PlantCategory.LEAFY_GREENS,
    recommendedSoil: SoilType.LOAMY,
    maxTemperature: 25,
    maxLightLevel: 20000,
    description: 'A crispy leafy green perfect for salads.',
    isActive: true,
    createdAt: new Date('2026-01-15T08:00:00.000Z'),
    updatedAt: new Date('2026-01-15T08:00:00.000Z'),
};

export const mockInactivePlant = {
    ...mockPlant,
    id: testPlantIds.inactive,
    name: 'Wilted Herb',
    category: PlantCategory.HERBS,
    isActive: false,
};

export const mockHerbPlant = {
    id: testPlantIds.secondary,
    name: 'Basil',
    category: PlantCategory.HERBS,
    recommendedSoil: SoilType.PEATY,
    description: 'An aromatic herb used in Italian cuisine.',
    isActive: true,
    createdAt: new Date('2026-01-20T08:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:30:00.000Z'),
};

/** Collection of plants for list-based tests */
export const mockPlants = [mockPlant, mockHerbPlant];

// ─────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────

export const validCreatePlantDto: CreatePlantDto = {
    name: 'Lettuce',
    category: PlantCategory.LEAFY_GREENS,
    recommendedSoil: SoilType.LOAMY,
    description: 'A crispy leafy green perfect for salads.',
};

export const minimalCreatePlantDto: CreatePlantDto = {
    name: 'Mystery Plant',
};

export const validUpdatePlantDto: UpdatePlantDto = {
    name: 'Updated Lettuce',
    category: PlantCategory.LEAFY_GREENS,
    recommendedSoil: SoilType.SANDY,
    description: 'Updated description.',
    isActive: true,
};

// ─────────────────────────────────────────────
// QUERY DTOs
// ─────────────────────────────────────────────

export const defaultPlantQuery: PlantCategoryQueryDto = {
    page: 1,
    limit: 10,
};

export const leafyGreensQuery: PlantCategoryQueryDto = {
    category: PlantCategory.LEAFY_GREENS,
    page: 1,
    limit: 10,
};

export const activeOnlyQuery: PlantCategoryQueryDto = {
    isActive: true,
    page: 1,
    limit: 10,
};

export const herbsActiveQuery: PlantCategoryQueryDto = {
    category: PlantCategory.HERBS,
    isActive: true,
    page: 1,
    limit: 10,
};

// ─────────────────────────────────────────────
// SERVICE RESPONSES
// ─────────────────────────────────────────────

export const plantCreatedResponse = {
    message: 'Plant created successfully',
    plant: mockPlant,
};

export const plantUpdatedResponse = {
    message: 'Plant updated successfully',
    plant: { ...mockPlant, ...validUpdatePlantDto },
};

export const plantDeletedResponse = {
    message: 'Plant deleted successfully',
};

export const plantDetailsResponse = {
    message: 'Plant retrieved successfully',
    plant: mockPlant,
};

// ─────────────────────────────────────────────
// PAGINATED RESPONSE
// ─────────────────────────────────────────────

export const paginatedPlantsResponse = {
    data: mockPlants,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: mockPlants.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
};
