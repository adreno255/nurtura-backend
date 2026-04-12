import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { type CurrentUserPayload } from '../common/interfaces';
import { createMockNotificationsService } from '../../test/mocks';
import {
    testNotificationIds,
    testNotificationUserIds,
    mockNotificationAfterRead,
    defaultNotificationQuery,
    secondPageNotificationQuery,
    paginatedNotificationsResponse,
    emptyNotificationsResponse,
    paginatedUnreadNotificationsResponse,
} from '../../test/fixtures';

describe('NotificationsController', () => {
    let controller: NotificationsController;

    const mockNotificationsService = createMockNotificationsService();

    const currentUser: CurrentUserPayload = {
        dbId: testNotificationUserIds.primary,
        firebaseUid: 'firebase-uid-001',
        email: 'user@example.com',
    };

    const testNotificationId = testNotificationIds.primary;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: mockNotificationsService,
                },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // findAll
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        it('should return paginated notifications for the authenticated user', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);

            const result = await controller.findAll(currentUser, defaultNotificationQuery);

            expect(result).toEqual(paginatedNotificationsResponse);
            expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
                currentUser.dbId,
                defaultNotificationQuery,
                undefined,
            );
            expect(mockNotificationsService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser to service', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);

            await controller.findAll(currentUser, defaultNotificationQuery);

            expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
                currentUser.dbId,
                expect.any(Object),
                undefined,
            );
        });

        it('should pass unreadOnly filter when provided', async () => {
            mockNotificationsService.findAll.mockResolvedValue(
                paginatedUnreadNotificationsResponse,
            );

            const result = await controller.findAll(currentUser, defaultNotificationQuery, true);

            expect(result).toEqual(paginatedUnreadNotificationsResponse);
            expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
                currentUser.dbId,
                defaultNotificationQuery,
                true,
            );
        });

        it('should pass unreadOnly: false when explicitly set to false', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);

            await controller.findAll(currentUser, defaultNotificationQuery, false);

            expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
                currentUser.dbId,
                defaultNotificationQuery,
                false,
            );
        });

        it('should pass pagination query parameters to service', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);

            await controller.findAll(currentUser, secondPageNotificationQuery);

            expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
                currentUser.dbId,
                secondPageNotificationQuery,
                undefined,
            );
        });

        it('should return empty paginated response when no notifications found', async () => {
            mockNotificationsService.findAll.mockResolvedValue(emptyNotificationsResponse);

            const result = await controller.findAll(currentUser, defaultNotificationQuery);

            expect(result.data).toEqual([]);
            expect(result.meta.totalItems).toBe(0);
            expect(result.unreadCount).toBe(0);
        });

        it('should return response with unreadCount field', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);

            const result = await controller.findAll(currentUser, defaultNotificationQuery);

            expect(result).toHaveProperty('unreadCount');
            expect(typeof result.unreadCount).toBe('number');
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockNotificationsService.findAll.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch notifications'),
            );

            await expect(controller.findAll(currentUser, defaultNotificationQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should not add extra logic — returns service response directly', async () => {
            const serviceResponse = paginatedNotificationsResponse;
            mockNotificationsService.findAll.mockResolvedValue(serviceResponse);

            const result = await controller.findAll(currentUser, defaultNotificationQuery);

            expect(result).toBe(serviceResponse);
        });
    });

    // ─────────────────────────────────────────────
    // hasUnreadNotifications
    // ─────────────────────────────────────────────

    describe('hasUnreadNotifications', () => {
        it('should return hasUnread: true when unread notifications exist', async () => {
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue({ hasUnread: true });

            const result = await controller.hasUnreadNotifications(currentUser);

            expect(result).toEqual({ hasUnread: true });
        });

        it('should return hasUnread: false when no unread notifications exist', async () => {
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue({ hasUnread: false });

            const result = await controller.hasUnreadNotifications(currentUser);

            expect(result).toEqual({ hasUnread: false });
        });

        it('should call service with userId from CurrentUser', async () => {
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue({ hasUnread: false });

            await controller.hasUnreadNotifications(currentUser);

            expect(mockNotificationsService.hasUnreadNotifications).toHaveBeenCalledWith(
                currentUser.dbId,
            );
            expect(mockNotificationsService.hasUnreadNotifications).toHaveBeenCalledTimes(1);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockNotificationsService.hasUnreadNotifications.mockRejectedValue(
                new InternalServerErrorException('Failed to check unread notifications'),
            );

            await expect(controller.hasUnreadNotifications(currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return the service response directly without modification', async () => {
            const serviceResponse = { hasUnread: true };
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue(serviceResponse);

            const result = await controller.hasUnreadNotifications(currentUser);

            expect(result).toBe(serviceResponse);
        });
    });

    // ─────────────────────────────────────────────
    // markAsRead
    // ─────────────────────────────────────────────

    describe('markAsRead', () => {
        it('should mark a notification as read successfully', async () => {
            const expectedResponse = {
                message: 'Notification marked as read',
                notification: mockNotificationAfterRead,
            };
            mockNotificationsService.markAsRead.mockResolvedValue(expectedResponse);

            const result = await controller.markAsRead(testNotificationId, currentUser);

            expect(result).toEqual(expectedResponse);
            expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
                testNotificationId,
                currentUser.dbId,
            );
            expect(mockNotificationsService.markAsRead).toHaveBeenCalledTimes(1);
        });

        it('should pass notificationId and userId to service', async () => {
            mockNotificationsService.markAsRead.mockResolvedValue({
                message: 'Notification marked as read',
                notification: mockNotificationAfterRead,
            });

            await controller.markAsRead(testNotificationId, currentUser);

            expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
                testNotificationId,
                currentUser.dbId,
            );
        });

        it('should return "already marked as read" response for read notifications', async () => {
            const alreadyReadResponse = {
                message: 'Notification already marked as read',
                notification: mockNotificationAfterRead,
            };
            mockNotificationsService.markAsRead.mockResolvedValue(alreadyReadResponse);

            const result = await controller.markAsRead(testNotificationId, currentUser);

            expect(result.message).toBe('Notification already marked as read');
        });

        it('should work with different notification IDs', async () => {
            const ids = [
                testNotificationIds.primary,
                testNotificationIds.secondary,
                testNotificationIds.tertiary,
            ];

            for (const id of ids) {
                mockNotificationsService.markAsRead.mockResolvedValue({
                    message: 'Notification marked as read',
                    notification: { ...mockNotificationAfterRead, id },
                });

                await controller.markAsRead(id, currentUser);

                expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
                    id,
                    currentUser.dbId,
                );
            }
        });

        it('should propagate NotFoundException from service', async () => {
            mockNotificationsService.markAsRead.mockRejectedValue(
                new NotFoundException('Notification not found'),
            );

            await expect(
                controller.markAsRead(testNotificationIds.nonExistent, currentUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockNotificationsService.markAsRead.mockRejectedValue(
                new InternalServerErrorException('Failed to mark notification as read'),
            );

            await expect(controller.markAsRead(testNotificationId, currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return service response directly without modification', async () => {
            const serviceResponse = {
                message: 'Notification marked as read',
                notification: mockNotificationAfterRead,
            };
            mockNotificationsService.markAsRead.mockResolvedValue(serviceResponse);

            const result = await controller.markAsRead(testNotificationId, currentUser);

            expect(result).toBe(serviceResponse);
        });
    });

    // ─────────────────────────────────────────────
    // markAllAsRead
    // ─────────────────────────────────────────────

    describe('markAllAsRead', () => {
        it('should mark all notifications as read successfully', async () => {
            const expectedResponse = {
                message: 'All notifications marked as read',
                updatedCount: 2,
            };
            mockNotificationsService.markAllAsRead.mockResolvedValue(expectedResponse);

            const result = await controller.markAllAsRead(currentUser);

            expect(result).toEqual(expectedResponse);
            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(currentUser.dbId);
            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledTimes(1);
        });

        it('should call service with userId from CurrentUser', async () => {
            mockNotificationsService.markAllAsRead.mockResolvedValue({
                message: 'All notifications marked as read',
                updatedCount: 0,
            });

            await controller.markAllAsRead(currentUser);

            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(currentUser.dbId);
        });

        it('should return updatedCount of 0 when there are no unread notifications', async () => {
            mockNotificationsService.markAllAsRead.mockResolvedValue({
                message: 'All notifications marked as read',
                updatedCount: 0,
            });

            const result = await controller.markAllAsRead(currentUser);

            expect(result.updatedCount).toBe(0);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockNotificationsService.markAllAsRead.mockRejectedValue(
                new InternalServerErrorException('Failed to mark all notifications as read'),
            );

            await expect(controller.markAllAsRead(currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return service response directly without modification', async () => {
            const serviceResponse = {
                message: 'All notifications marked as read',
                updatedCount: 5,
            };
            mockNotificationsService.markAllAsRead.mockResolvedValue(serviceResponse);

            const result = await controller.markAllAsRead(currentUser);

            expect(result).toBe(serviceResponse);
        });
    });

    // ─────────────────────────────────────────────
    // remove
    // ─────────────────────────────────────────────

    describe('remove', () => {
        it('should delete a notification successfully', async () => {
            const expectedResponse = { message: 'Notification deleted successfully' };
            mockNotificationsService.remove.mockResolvedValue(expectedResponse);

            const result = await controller.remove(testNotificationId, currentUser);

            expect(result).toEqual(expectedResponse);
            expect(mockNotificationsService.remove).toHaveBeenCalledWith(
                testNotificationId,
                currentUser.dbId,
            );
            expect(mockNotificationsService.remove).toHaveBeenCalledTimes(1);
        });

        it('should pass notificationId and userId to service', async () => {
            mockNotificationsService.remove.mockResolvedValue({
                message: 'Notification deleted successfully',
            });

            await controller.remove(testNotificationId, currentUser);

            expect(mockNotificationsService.remove).toHaveBeenCalledWith(
                testNotificationId,
                currentUser.dbId,
            );
        });

        it('should work with different notification IDs', async () => {
            const ids = [
                testNotificationIds.primary,
                testNotificationIds.secondary,
                testNotificationIds.tertiary,
            ];

            for (const id of ids) {
                mockNotificationsService.remove.mockResolvedValue({
                    message: 'Notification deleted successfully',
                });

                await controller.remove(id, currentUser);

                expect(mockNotificationsService.remove).toHaveBeenCalledWith(id, currentUser.dbId);
            }
        });

        it('should propagate NotFoundException from service', async () => {
            mockNotificationsService.remove.mockRejectedValue(
                new NotFoundException('Notification not found'),
            );

            await expect(
                controller.remove(testNotificationIds.nonExistent, currentUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockNotificationsService.remove.mockRejectedValue(
                new InternalServerErrorException('Failed to delete notification'),
            );

            await expect(controller.remove(testNotificationId, currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return service response directly without modification', async () => {
            const serviceResponse = { message: 'Notification deleted successfully' };
            mockNotificationsService.remove.mockResolvedValue(serviceResponse);

            const result = await controller.remove(testNotificationId, currentUser);

            expect(result).toBe(serviceResponse);
        });
    });

    // ─────────────────────────────────────────────
    // Integration — delegation pattern
    // ─────────────────────────────────────────────

    describe('integration with NotificationsService', () => {
        it('should delegate all logic to NotificationsService', async () => {
            mockNotificationsService.findAll.mockResolvedValue(paginatedNotificationsResponse);
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue({ hasUnread: true });
            mockNotificationsService.markAsRead.mockResolvedValue({
                message: 'Notification marked as read',
                notification: mockNotificationAfterRead,
            });
            mockNotificationsService.markAllAsRead.mockResolvedValue({
                message: 'All notifications marked as read',
                updatedCount: 2,
            });
            mockNotificationsService.remove.mockResolvedValue({
                message: 'Notification deleted successfully',
            });

            await controller.findAll(currentUser, defaultNotificationQuery);
            await controller.hasUnreadNotifications(currentUser);
            await controller.markAsRead(testNotificationId, currentUser);
            await controller.markAllAsRead(currentUser);
            await controller.remove(testNotificationId, currentUser);

            expect(mockNotificationsService.findAll).toHaveBeenCalled();
            expect(mockNotificationsService.hasUnreadNotifications).toHaveBeenCalled();
            expect(mockNotificationsService.markAsRead).toHaveBeenCalled();
            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalled();
            expect(mockNotificationsService.remove).toHaveBeenCalled();
        });

        it('should not add additional business logic for any endpoint', async () => {
            const findAllResponse = paginatedNotificationsResponse;
            const hasUnreadResponse = { hasUnread: true };
            const markReadResponse = {
                message: 'Notification marked as read',
                notification: mockNotificationAfterRead,
            };
            const markAllReadResponse = {
                message: 'All notifications marked as read',
                updatedCount: 2,
            };
            const removeResponse = { message: 'Notification deleted successfully' };

            mockNotificationsService.findAll.mockResolvedValue(findAllResponse);
            mockNotificationsService.hasUnreadNotifications.mockResolvedValue(hasUnreadResponse);
            mockNotificationsService.markAsRead.mockResolvedValue(markReadResponse);
            mockNotificationsService.markAllAsRead.mockResolvedValue(markAllReadResponse);
            mockNotificationsService.remove.mockResolvedValue(removeResponse);

            expect(await controller.findAll(currentUser, defaultNotificationQuery)).toBe(
                findAllResponse,
            );
            expect(await controller.hasUnreadNotifications(currentUser)).toBe(hasUnreadResponse);
            expect(await controller.markAsRead(testNotificationId, currentUser)).toBe(
                markReadResponse,
            );
            expect(await controller.markAllAsRead(currentUser)).toBe(markAllReadResponse);
            expect(await controller.remove(testNotificationId, currentUser)).toBe(removeResponse);
        });
    });

    // ─────────────────────────────────────────────
    // Error propagation
    // ─────────────────────────────────────────────

    describe('error propagation', () => {
        it('should not catch errors in findAll', async () => {
            mockNotificationsService.findAll.mockRejectedValue(
                new InternalServerErrorException('Service error'),
            );

            await expect(controller.findAll(currentUser, defaultNotificationQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should not catch errors in hasUnreadNotifications', async () => {
            mockNotificationsService.hasUnreadNotifications.mockRejectedValue(
                new InternalServerErrorException('Service error'),
            );

            await expect(controller.hasUnreadNotifications(currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should not catch NotFoundException in markAsRead', async () => {
            mockNotificationsService.markAsRead.mockRejectedValue(
                new NotFoundException('Notification not found'),
            );

            await expect(
                controller.markAsRead(testNotificationIds.nonExistent, currentUser),
            ).rejects.toThrow(NotFoundException);
        });

        it('should not catch errors in markAllAsRead', async () => {
            mockNotificationsService.markAllAsRead.mockRejectedValue(
                new InternalServerErrorException('Service error'),
            );

            await expect(controller.markAllAsRead(currentUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should not catch NotFoundException in remove', async () => {
            mockNotificationsService.remove.mockRejectedValue(
                new NotFoundException('Notification not found'),
            );

            await expect(
                controller.remove(testNotificationIds.nonExistent, currentUser),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
