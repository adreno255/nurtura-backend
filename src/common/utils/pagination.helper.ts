import { type PaginationQueryDto } from '../dto/pagination-query.dto';
import { type PaginationMeta, type PaginatedResponse } from '../interfaces/pagination.interface';

export class PaginationHelper {
    /**
     * Calculate pagination metadata
     */
    static calculateMeta(page: number, limit: number, totalItems: number): PaginationMeta {
        const totalPages = Math.ceil(totalItems / limit);

        return {
            currentPage: page,
            itemsPerPage: limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        };
    }

    /**
     * Calculate skip value for Prisma queries
     */
    static calculateSkip(page: number, limit: number): number {
        return (page - 1) * limit;
    }

    /**
     * Create a paginated response
     */
    static createResponse<T>(
        data: T[],
        totalItems: number,
        query: PaginationQueryDto,
    ): PaginatedResponse<T> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        return {
            data,
            meta: this.calculateMeta(page, limit, totalItems),
        };
    }

    /**
     * Get Prisma pagination options from query
     */
    static getPrismaOptions(query: PaginationQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        return {
            skip: this.calculateSkip(page, limit),
            take: limit,
        };
    }
}
