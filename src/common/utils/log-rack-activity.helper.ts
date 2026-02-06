import { type DatabaseService } from '../../database/database.service';
import { type MyLoggerService } from '../../my-logger/my-logger.service';
import { type Prisma, type ActivityEventType } from '../../generated/prisma';

/**
 * Helper class for saving rack activity to the database
 */
export class LogRackActivityHelper {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}
    /**
     * Log activity for a specific rack
     * @param rackId - The ID of the rack
     * @param eventType - The type of activity event
     * @param details - Details about the activity
     * @param metadata - Optional metadata for the activity
     * @returns The created activity record or null if logging fails
     */
    async logActivity(
        rackId: string,
        eventType: ActivityEventType,
        details: string,
        metadata?: Prisma.InputJsonValue,
    ) {
        try {
            const activity = await this.databaseService.activity.create({
                data: {
                    rackId,
                    eventType,
                    details,
                    metadata,
                },
            });

            this.logger.log(
                `Activity logged for rack ${rackId}: ${eventType} - ${details}`,
                'RacksService',
            );

            return activity;
        } catch (error) {
            this.logger.error(
                `Error logging activity for rack ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'LogRackActivityHelper',
            );
            // Don't throw - logging failures shouldn't break the main operation
        }
    }
}
