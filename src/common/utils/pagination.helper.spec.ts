import { PaginationHelper } from './pagination.helper';
import { type PaginationQueryDto } from '../dto/pagination-query.dto';

describe('PaginationHelper', () => {
    describe('calculateMeta', () => {
        it('should calculate metadata for first page', () => {
            const result = PaginationHelper.calculateMeta(1, 10, 45);

            expect(result).toEqual({
                currentPage: 1,
                itemsPerPage: 10,
                totalItems: 45,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: false,
            });
        });

        it('should calculate metadata for middle page', () => {
            const result = PaginationHelper.calculateMeta(3, 10, 45);

            expect(result).toEqual({
                currentPage: 3,
                itemsPerPage: 10,
                totalItems: 45,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: true,
            });
        });

        it('should calculate metadata for last page', () => {
            const result = PaginationHelper.calculateMeta(5, 10, 45);

            expect(result).toEqual({
                currentPage: 5,
                itemsPerPage: 10,
                totalItems: 45,
                totalPages: 5,
                hasNextPage: false,
                hasPreviousPage: true,
            });
        });

        it('should handle exact page division', () => {
            const result = PaginationHelper.calculateMeta(2, 10, 20);

            expect(result).toEqual({
                currentPage: 2,
                itemsPerPage: 10,
                totalItems: 20,
                totalPages: 2,
                hasNextPage: false,
                hasPreviousPage: true,
            });
        });

        it('should handle empty results', () => {
            const result = PaginationHelper.calculateMeta(1, 10, 0);

            expect(result).toEqual({
                currentPage: 1,
                itemsPerPage: 10,
                totalItems: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            });
        });

        it('should handle single page of results', () => {
            const result = PaginationHelper.calculateMeta(1, 10, 5);

            expect(result).toEqual({
                currentPage: 1,
                itemsPerPage: 10,
                totalItems: 5,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            });
        });

        it('should handle large page sizes', () => {
            const result = PaginationHelper.calculateMeta(1, 100, 450);

            expect(result).toEqual({
                currentPage: 1,
                itemsPerPage: 100,
                totalItems: 450,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: false,
            });
        });
    });

    describe('calculateSkip', () => {
        it('should calculate skip for first page', () => {
            const result = PaginationHelper.calculateSkip(1, 10);
            expect(result).toBe(0);
        });

        it('should calculate skip for second page', () => {
            const result = PaginationHelper.calculateSkip(2, 10);
            expect(result).toBe(10);
        });

        it('should calculate skip for page 5', () => {
            const result = PaginationHelper.calculateSkip(5, 10);
            expect(result).toBe(40);
        });

        it('should calculate skip with different page sizes', () => {
            expect(PaginationHelper.calculateSkip(1, 20)).toBe(0);
            expect(PaginationHelper.calculateSkip(2, 20)).toBe(20);
            expect(PaginationHelper.calculateSkip(3, 50)).toBe(100);
        });

        it('should handle page size of 1', () => {
            const result = PaginationHelper.calculateSkip(10, 1);
            expect(result).toBe(9);
        });
    });

    describe('createResponse', () => {
        it('should create paginated response with defaults', () => {
            const data = [{ id: '1' }, { id: '2' }];
            const query: PaginationQueryDto = {};

            const result = PaginationHelper.createResponse(data, 25, query);

            expect(result.data).toEqual(data);
            expect(result.meta).toEqual({
                currentPage: 1,
                itemsPerPage: 10,
                totalItems: 25,
                totalPages: 3,
                hasNextPage: true,
                hasPreviousPage: false,
            });
        });

        it('should create paginated response with custom values', () => {
            const data = [{ id: '1' }, { id: '2' }];
            const query: PaginationQueryDto = { page: 2, limit: 5 };

            const result = PaginationHelper.createResponse(data, 25, query);

            expect(result.data).toEqual(data);
            expect(result.meta).toEqual({
                currentPage: 2,
                itemsPerPage: 5,
                totalItems: 25,
                totalPages: 5,
                hasNextPage: true,
                hasPreviousPage: true,
            });
        });

        it('should handle empty data array', () => {
            const data: any[] = [];
            const query: PaginationQueryDto = { page: 1, limit: 10 };

            const result = PaginationHelper.createResponse(data, 0, query);

            expect(result.data).toEqual([]);
            expect(result.meta.totalItems).toBe(0);
            expect(result.meta.totalPages).toBe(0);
        });

        it('should handle last page correctly', () => {
            const data = [{ id: '1' }];
            const query: PaginationQueryDto = { page: 3, limit: 10 };

            const result = PaginationHelper.createResponse(data, 21, query);

            expect(result.meta).toEqual({
                currentPage: 3,
                itemsPerPage: 10,
                totalItems: 21,
                totalPages: 3,
                hasNextPage: false,
                hasPreviousPage: true,
            });
        });
    });

    describe('getPrismaOptions', () => {
        it('should return Prisma options with defaults', () => {
            const query: PaginationQueryDto = {};

            const result = PaginationHelper.getPrismaOptions(query);

            expect(result).toEqual({
                skip: 0,
                take: 10,
            });
        });

        it('should return Prisma options with custom values', () => {
            const query: PaginationQueryDto = { page: 3, limit: 20 };

            const result = PaginationHelper.getPrismaOptions(query);

            expect(result).toEqual({
                skip: 40,
                take: 20,
            });
        });

        it('should handle page 1 correctly', () => {
            const query: PaginationQueryDto = { page: 1, limit: 15 };

            const result = PaginationHelper.getPrismaOptions(query);

            expect(result).toEqual({
                skip: 0,
                take: 15,
            });
        });

        it('should handle large page numbers', () => {
            const query: PaginationQueryDto = { page: 100, limit: 50 };

            const result = PaginationHelper.getPrismaOptions(query);

            expect(result).toEqual({
                skip: 4950,
                take: 50,
            });
        });
    });

    describe('integration scenarios', () => {
        it('should work for a complete pagination flow', () => {
            // Simulate getting page 2 with 10 items per page from 45 total items
            const query: PaginationQueryDto = { page: 2, limit: 10 };
            const totalItems = 45;
            const mockData = Array.from({ length: 10 }, (_, i) => ({ id: `${i + 11}` }));

            // Get Prisma options
            const { skip, take } = PaginationHelper.getPrismaOptions(query);
            expect(skip).toBe(10);
            expect(take).toBe(10);

            // Create response
            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.data.length).toBe(10);
            expect(response.meta.currentPage).toBe(2);
            expect(response.meta.hasNextPage).toBe(true);
            expect(response.meta.hasPreviousPage).toBe(true);
        });

        it('should work for last page with partial results', () => {
            const query: PaginationQueryDto = { page: 5, limit: 10 };
            const totalItems = 45;
            const mockData = Array.from({ length: 5 }, (_, i) => ({ id: `${i + 41}` }));

            const { skip, take } = PaginationHelper.getPrismaOptions(query);
            expect(skip).toBe(40);
            expect(take).toBe(10);

            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.data.length).toBe(5);
            expect(response.meta.currentPage).toBe(5);
            expect(response.meta.hasNextPage).toBe(false);
            expect(response.meta.hasPreviousPage).toBe(true);
        });

        it('should work for first page', () => {
            const query: PaginationQueryDto = { page: 1, limit: 10 };
            const totalItems = 45;
            const mockData = Array.from({ length: 10 }, (_, i) => ({ id: `${i + 1}` }));

            const { skip, take } = PaginationHelper.getPrismaOptions(query);
            expect(skip).toBe(0);
            expect(take).toBe(10);

            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.data.length).toBe(10);
            expect(response.meta.currentPage).toBe(1);
            expect(response.meta.hasNextPage).toBe(true);
            expect(response.meta.hasPreviousPage).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle page beyond total pages', () => {
            const query: PaginationQueryDto = { page: 10, limit: 10 };
            const totalItems = 45;
            const mockData: any[] = [];

            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.data).toEqual([]);
            expect(response.meta.currentPage).toBe(10);
            expect(response.meta.hasNextPage).toBe(false);
        });

        it('should handle very small limit', () => {
            const query: PaginationQueryDto = { page: 1, limit: 1 };
            const totalItems = 45;
            const mockData = [{ id: '1' }];

            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.meta.totalPages).toBe(45);
            expect(response.meta.hasNextPage).toBe(true);
        });

        it('should handle very large limit', () => {
            const query: PaginationQueryDto = { page: 1, limit: 100 };
            const totalItems = 45;
            const mockData = Array.from({ length: 45 }, (_, i) => ({ id: `${i + 1}` }));

            const response = PaginationHelper.createResponse(mockData, totalItems, query);

            expect(response.meta.totalPages).toBe(1);
            expect(response.meta.hasNextPage).toBe(false);
        });
    });
});
