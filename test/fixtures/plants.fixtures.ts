/**
 * Plants Test Fixtures
 * Reusable test data for plant-related tests
 */

import { PlantCategory, SoilType } from '../../src/generated/prisma';
import type { CreatePlantDto } from '../../src/plants/dto/create-plant.dto';
import type { UpdatePlantDto } from '../../src/plants/dto/update-plant.dto';
import type { AssignPlantToRackDto } from '../../src/racks/dto/rack-operations.dto';
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

export const deactivatePlantDto: UpdatePlantDto = {
    isActive: false,
};

export const validAssignPlantToRackDto: AssignPlantToRackDto = {
    rackId: 'rack-123',
    quantity: 10,
};

export const assignWithDateDto: AssignPlantToRackDto = {
    rackId: 'rack-123',
    quantity: 5,
    plantedAt: '2026-02-26T08:00:00.000Z',
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
// RACK STATE (for assignment tests)
// ─────────────────────────────────────────────

export const emptyRackForPlant = {
    id: 'rack-123',
    userId: 'user-123',
    currentPlantId: null,
    quantity: 0,
    plantedAt: null,
    harvestCount: 0,
    lastHarvestAt: null,
    currentPlant: null,
};

export const rackWithPlant = {
    ...emptyRackForPlant,
    currentPlantId: testPlantIds.primary,
    quantity: 10,
    plantedAt: new Date('2026-01-01T08:00:00.000Z'),
    currentPlant: { name: 'Lettuce' },
};

export const rackWithDifferentPlant = {
    ...emptyRackForPlant,
    currentPlantId: testPlantIds.secondary,
    quantity: 5,
    plantedAt: new Date('2026-01-10T08:00:00.000Z'),
    currentPlant: { name: 'Basil' },
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────

export const mockRackPlantingHistoryEntry = {
    id: 'history-001',
    rackId: 'rack-123',
    plantId: testPlantIds.primary,
    quantity: 10,
    plantedAt: new Date('2026-01-01T08:00:00.000Z'),
    harvestedAt: new Date('2026-02-01T08:00:00.000Z'),
    harvestCount: 1,
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    updatedAt: new Date('2026-02-01T08:00:00.000Z'),
    plant: {
        id: testPlantIds.primary,
        name: 'Lettuce',
        category: PlantCategory.LEAFY_GREENS,
        recommendedSoil: SoilType.LOAMY,
    },
};

export const mockOpenRackPlantingHistoryEntry = {
    ...mockRackPlantingHistoryEntry,
    id: 'history-002',
    harvestedAt: null,
    harvestCount: 0,
};

export const mockRackPlantingHistory = [
    mockRackPlantingHistoryEntry,
    mockOpenRackPlantingHistoryEntry,
];

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

export const assignSuccessResponse = {
    message: 'Plant assigned to rack successfully',
};

export const removeFromRackSuccessResponse = {
    message: 'Plant removed from rack successfully',
};

export const harvestSuccessResponse = {
    message: 'Plant harvested successfully',
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

export const paginatedHistoryResponse = {
    data: mockRackPlantingHistory,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: mockRackPlantingHistory.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
};
