import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { type CreateAutomationRuleDto, type UpdateAutomationRuleDto } from './dto';
import { type CurrentUserPayload } from '../common/interfaces';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
    testAutomationIds,
    validCreateAutomationRuleDto,
    validUpdateAutomationRuleDto,
    mockAutomationRule,
    mockAutomationRules,
    minimalCreateAutomationRuleDto,
    lightingCreateRuleDto,
    updateConditionsDto,
    updateActionsDto,
    disableRuleDto,
} from '../../test/fixtures/automation.fixtures';
import { testUser } from '../../test/fixtures/users.fixtures';
import { createMockAutomationService } from '../../test/mocks';

describe('AutomationController', () => {
    let controller: AutomationController;

    const currentUser: CurrentUserPayload = testUser;

    const { ruleId, plantId } = testAutomationIds;

    const mockAutomationService = createMockAutomationService();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AutomationController],
            providers: [
                {
                    provide: AutomationService,
                    useValue: mockAutomationService,
                },
            ],
        }).compile();

        controller = module.get<AutomationController>(AutomationController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createRule', () => {
        const createRuleDto: CreateAutomationRuleDto = validCreateAutomationRuleDto;

        it('should create automation rule successfully', async () => {
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: {
                    id: ruleId,
                    name: mockAutomationRule.name,
                    description: mockAutomationRule.description,
                    conditions: mockAutomationRule.conditions,
                    actions: mockAutomationRule.actions,
                    cooldownMinutes: mockAutomationRule.cooldownMinutes,
                    isEnabled: mockAutomationRule.isEnabled,
                },
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            const result = await controller.createRule(currentUser, createRuleDto);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.create).toHaveBeenCalledWith(
                currentUser.dbId,
                createRuleDto,
            );
            expect(mockAutomationService.create).toHaveBeenCalledTimes(1);
        });

        it('should pass userId from CurrentUser decorator', async () => {
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            await controller.createRule(currentUser, createRuleDto);

            expect(mockAutomationService.create).toHaveBeenCalledWith(
                currentUser.dbId,
                createRuleDto,
            );
        });

        it('should create rule with minimal fields', async () => {
            const minimalDto: CreateAutomationRuleDto = minimalCreateAutomationRuleDto;
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: {
                    id: ruleId,
                    name: minimalDto.name,
                    conditions: minimalDto.conditions,
                    actions: minimalDto.actions,
                    isEnabled: true,
                },
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            const result = await controller.createRule(currentUser, minimalDto);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.create).toHaveBeenCalledWith(currentUser.dbId, minimalDto);
        });

        it('should create lighting control rule', async () => {
            const lightingDto: CreateAutomationRuleDto = lightingCreateRuleDto;
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: {
                    id: 'rule-light-123',
                    name: lightingDto.name,
                    conditions: lightingDto.conditions,
                    actions: lightingDto.actions,
                    cooldownMinutes: lightingDto.cooldownMinutes,
                    isEnabled: true,
                },
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            const result = await controller.createRule(currentUser, lightingDto);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.create).toHaveBeenCalledWith(
                currentUser.dbId,
                lightingDto,
            );
        });

        it('should throw NotFoundException when plant not found', async () => {
            const error = new NotFoundException('Plant not found');
            mockAutomationService.create.mockRejectedValue(error);

            await expect(controller.createRule(currentUser, createRuleDto)).rejects.toThrow(error);
            expect(mockAutomationService.create).toHaveBeenCalledWith(
                currentUser.dbId,
                createRuleDto,
            );
        });

        it('should throw BadRequestException for invalid conditions', async () => {
            const error = new BadRequestException('At least one condition must be specified');
            mockAutomationService.create.mockRejectedValue(error);

            await expect(controller.createRule(currentUser, createRuleDto)).rejects.toThrow(error);
        });

        it('should throw BadRequestException for invalid actions', async () => {
            const error = new BadRequestException('At least one action must be specified');
            mockAutomationService.create.mockRejectedValue(error);

            await expect(controller.createRule(currentUser, createRuleDto)).rejects.toThrow(error);
        });

        it('should throw BadRequestException for invalid thresholds', async () => {
            const error = new BadRequestException('Moisture threshold must be between 0 and 100');
            mockAutomationService.create.mockRejectedValue(error);

            await expect(controller.createRule(currentUser, createRuleDto)).rejects.toThrow(error);
        });

        it('should propagate InternalServerErrorException', async () => {
            const error = new InternalServerErrorException('Failed to create automation rule');
            mockAutomationService.create.mockRejectedValue(error);

            await expect(controller.createRule(currentUser, createRuleDto)).rejects.toThrow(error);
        });
    });

    describe('getPlantRules', () => {
        const paginationQuery: PaginationQueryDto = {
            page: 1,
            limit: 10,
        };

        it('should retrieve paginated automation rules successfully', async () => {
            const expectedResponse = {
                data: mockAutomationRules,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 3,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.getPlantRules(plantId, currentUser, paginationQuery);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                paginationQuery,
            );
            expect(mockAutomationService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            await controller.getPlantRules(plantId, currentUser, paginationQuery);

            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                paginationQuery,
            );
        });

        it('should handle different page numbers', async () => {
            const page2Query: PaginationQueryDto = { page: 2, limit: 5 };
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 2,
                    itemsPerPage: 5,
                    totalItems: 10,
                    totalPages: 2,
                    hasNextPage: false,
                    hasPreviousPage: true,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.getPlantRules(plantId, currentUser, page2Query);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                page2Query,
            );
        });

        it('should handle custom page limits', async () => {
            const customQuery: PaginationQueryDto = { page: 1, limit: 20 };
            const expectedResponse = {
                data: mockAutomationRules,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 20,
                    totalItems: 3,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.getPlantRules(plantId, currentUser, customQuery);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                customQuery,
            );
        });

        it('should return empty data array when no rules exist', async () => {
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.getPlantRules(plantId, currentUser, paginationQuery);

            expect(result.data).toEqual([]);
            expect(result.meta.totalItems).toBe(0);
        });

        it('should throw NotFoundException when plant not found', async () => {
            const error = new NotFoundException('Plant not found');
            mockAutomationService.findAll.mockRejectedValue(error);

            await expect(
                controller.getPlantRules(plantId, currentUser, paginationQuery),
            ).rejects.toThrow(error);
            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                paginationQuery,
            );
        });

        it('should throw InternalServerErrorException on service error', async () => {
            const error = new InternalServerErrorException('Failed to retrieve automation rules');
            mockAutomationService.findAll.mockRejectedValue(error);

            await expect(
                controller.getPlantRules(plantId, currentUser, paginationQuery),
            ).rejects.toThrow(error);
        });
    });

    describe('updateRule', () => {
        const updateRuleDto: UpdateAutomationRuleDto = validUpdateAutomationRuleDto;

        it('should update automation rule successfully', async () => {
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: {
                    ...mockAutomationRule,
                    name: updateRuleDto.name,
                    description: updateRuleDto.description,
                    isEnabled: updateRuleDto.isEnabled,
                },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, updateRuleDto);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                updateRuleDto,
            );
            expect(mockAutomationService.update).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            await controller.updateRule(ruleId, currentUser, updateRuleDto);

            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                updateRuleDto,
            );
        });

        it('should update only name', async () => {
            const nameOnlyUpdate: UpdateAutomationRuleDto = { name: 'New Name' };
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: { ...mockAutomationRule, name: 'New Name' },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, nameOnlyUpdate);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                nameOnlyUpdate,
            );
        });

        it('should update conditions', async () => {
            const conditionsUpdate: UpdateAutomationRuleDto = updateConditionsDto;
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: {
                    ...mockAutomationRule,
                    conditions: conditionsUpdate.conditions,
                },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, conditionsUpdate);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                conditionsUpdate,
            );
        });

        it('should update actions', async () => {
            const actionsUpdate: UpdateAutomationRuleDto = updateActionsDto;
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: {
                    ...mockAutomationRule,
                    actions: actionsUpdate.actions,
                },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, actionsUpdate);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                actionsUpdate,
            );
        });

        it('should disable rule', async () => {
            const disableUpdate: UpdateAutomationRuleDto = disableRuleDto;
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: {
                    ...mockAutomationRule,
                    isEnabled: false,
                },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, disableUpdate);

            expect(result).toEqual(expectedResponse);
            expect(result.rule.isEnabled).toBe(false);
        });

        it('should update cooldown period', async () => {
            const cooldownUpdate: UpdateAutomationRuleDto = { cooldownMinutes: 60 };
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: {
                    ...mockAutomationRule,
                    cooldownMinutes: 60,
                },
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(ruleId, currentUser, cooldownUpdate);

            expect(result).toEqual(expectedResponse);
            expect(result.rule.cooldownMinutes).toBe(60);
        });

        it('should throw NotFoundException when rule not found', async () => {
            const error = new NotFoundException('Automation rule not found');
            mockAutomationService.update.mockRejectedValue(error);

            await expect(controller.updateRule(ruleId, currentUser, updateRuleDto)).rejects.toThrow(
                error,
            );
            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                updateRuleDto,
            );
        });

        it('should throw NotFoundException when user does not own rule', async () => {
            const error = new NotFoundException('Automation rule not found');
            mockAutomationService.update.mockRejectedValue(error);

            await expect(controller.updateRule(ruleId, currentUser, updateRuleDto)).rejects.toThrow(
                error,
            );
        });

        it('should throw BadRequestException for invalid conditions', async () => {
            const error = new BadRequestException('Moisture threshold must be between 0 and 100');
            mockAutomationService.update.mockRejectedValue(error);

            await expect(controller.updateRule(ruleId, currentUser, updateRuleDto)).rejects.toThrow(
                error,
            );
        });

        it('should throw BadRequestException for invalid actions', async () => {
            const error = new BadRequestException('Watering action must be "start" or "stop"');
            mockAutomationService.update.mockRejectedValue(error);

            await expect(controller.updateRule(ruleId, currentUser, updateRuleDto)).rejects.toThrow(
                error,
            );
        });

        it('should throw InternalServerErrorException on service error', async () => {
            const error = new InternalServerErrorException('Failed to update automation rule');
            mockAutomationService.update.mockRejectedValue(error);

            await expect(controller.updateRule(ruleId, currentUser, updateRuleDto)).rejects.toThrow(
                error,
            );
        });
    });

    describe('deleteRule', () => {
        it('should delete automation rule successfully', async () => {
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            const result = await controller.deleteRule(ruleId, currentUser);

            expect(result).toEqual(expectedResponse);
            expect(mockAutomationService.delete).toHaveBeenCalledWith(ruleId, currentUser.dbId);
            expect(mockAutomationService.delete).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to service', async () => {
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            await controller.deleteRule(ruleId, currentUser);

            expect(mockAutomationService.delete).toHaveBeenCalledWith(ruleId, currentUser.dbId);
        });

        it('should delete rule with different ruleId', async () => {
            const differentRuleId = 'rule-different-123';
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            await controller.deleteRule(differentRuleId, currentUser);

            expect(mockAutomationService.delete).toHaveBeenCalledWith(
                differentRuleId,
                currentUser.dbId,
            );
        });

        it('should throw NotFoundException when rule not found', async () => {
            const error = new NotFoundException('Automation rule not found');
            mockAutomationService.delete.mockRejectedValue(error);

            await expect(controller.deleteRule(ruleId, currentUser)).rejects.toThrow(error);
            expect(mockAutomationService.delete).toHaveBeenCalledWith(ruleId, currentUser.dbId);
        });

        it('should throw NotFoundException when user does not own rule', async () => {
            const error = new NotFoundException('Automation rule not found');
            mockAutomationService.delete.mockRejectedValue(error);

            await expect(controller.deleteRule(ruleId, currentUser)).rejects.toThrow(error);
        });

        it('should throw InternalServerErrorException on service error', async () => {
            const error = new InternalServerErrorException('Failed to delete automation rule');
            mockAutomationService.delete.mockRejectedValue(error);

            await expect(controller.deleteRule(ruleId, currentUser)).rejects.toThrow(error);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle service returning undefined', async () => {
            mockAutomationService.create.mockResolvedValue(undefined);

            const result = await controller.createRule(currentUser, validCreateAutomationRuleDto);

            expect(result).toBeUndefined();
        });

        it('should handle empty string ruleId', async () => {
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            await controller.deleteRule('', currentUser);

            expect(mockAutomationService.delete).toHaveBeenCalledWith('', currentUser.dbId);
        });

        it('should handle empty string rackId', async () => {
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            await controller.getPlantRules('', currentUser, { page: 1, limit: 10 });

            expect(mockAutomationService.findAll).toHaveBeenCalledWith('', currentUser.dbId, {
                page: 1,
                limit: 10,
            });
        });

        it('should handle empty update DTO', async () => {
            const emptyUpdate: UpdateAutomationRuleDto = {};
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            await controller.updateRule(ruleId, currentUser, emptyUpdate);

            expect(mockAutomationService.update).toHaveBeenCalledWith(
                ruleId,
                currentUser.dbId,
                emptyUpdate,
            );
        });

        it('should handle empty pagination query', async () => {
            const emptyQuery: PaginationQueryDto = {};
            const expectedResponse = {
                data: [],
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            await controller.getPlantRules(plantId, currentUser, emptyQuery);

            expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                plantId,
                currentUser.dbId,
                emptyQuery,
            );
        });
    });

    describe('authentication and authorization', () => {
        it('should use CurrentUser decorator to extract user info', async () => {
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            await controller.createRule(currentUser, validCreateAutomationRuleDto);

            // Verify that user.dbId is used (comes from CurrentUser decorator)
            expect(mockAutomationService.create).toHaveBeenCalledWith(
                currentUser.dbId,
                validCreateAutomationRuleDto,
            );
        });

        it('should pass dbId not firebaseUid to service methods', async () => {
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            await controller.deleteRule(ruleId, currentUser);

            // Should use dbId, not firebaseUid
            expect(mockAutomationService.delete).toHaveBeenCalledWith(ruleId, currentUser.dbId);
            expect(mockAutomationService.delete).not.toHaveBeenCalledWith(
                ruleId,
                currentUser.firebaseUid,
            );
        });
    });

    describe('parameter validation', () => {
        it('should accept valid ruleId format', async () => {
            const validRuleIds = ['rule-123', 'clx123abc', 'abc-def-ghi'];

            for (const testRuleId of validRuleIds) {
                mockAutomationService.delete.mockResolvedValue({
                    message: 'Automation rule deleted successfully',
                });

                await controller.deleteRule(testRuleId, currentUser);

                expect(mockAutomationService.delete).toHaveBeenCalledWith(
                    testRuleId,
                    currentUser.dbId,
                );
            }
        });

        it('should accept valid rackId format', async () => {
            const validRackIds = ['rack-123', 'clx456def', 'xyz-abc-123'];

            for (const testRackId of validRackIds) {
                mockAutomationService.findAll.mockResolvedValue({
                    data: [],
                    meta: {
                        currentPage: 1,
                        itemsPerPage: 10,
                        totalItems: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false,
                    },
                });

                await controller.getPlantRules(testRackId, currentUser, { page: 1, limit: 10 });

                expect(mockAutomationService.findAll).toHaveBeenCalledWith(
                    testRackId,
                    currentUser.dbId,
                    { page: 1, limit: 10 },
                );
            }
        });
    });

    describe('response format consistency', () => {
        it('should return consistent success response format for create', async () => {
            const expectedResponse = {
                message: 'Automation rule created successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.create.mockResolvedValue(expectedResponse);

            const result = await controller.createRule(currentUser, validCreateAutomationRuleDto);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rule');
            expect(typeof result.message).toBe('string');
        });

        it('should return consistent success response format for update', async () => {
            const expectedResponse = {
                message: 'Automation rule updated successfully',
                rule: mockAutomationRule,
            };

            mockAutomationService.update.mockResolvedValue(expectedResponse);

            const result = await controller.updateRule(
                ruleId,
                currentUser,
                validUpdateAutomationRuleDto,
            );

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('rule');
            expect(typeof result.message).toBe('string');
        });

        it('should return consistent success response format for delete', async () => {
            const expectedResponse = {
                message: 'Automation rule deleted successfully',
            };

            mockAutomationService.delete.mockResolvedValue(expectedResponse);

            const result = await controller.deleteRule(ruleId, currentUser);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should return paginated response format for findAll', async () => {
            const expectedResponse = {
                data: mockAutomationRules,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 3,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };

            mockAutomationService.findAll.mockResolvedValue(expectedResponse);

            const result = await controller.getPlantRules(plantId, currentUser, {
                page: 1,
                limit: 10,
            });

            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.meta).toHaveProperty('currentPage');
            expect(result.meta).toHaveProperty('itemsPerPage');
            expect(result.meta).toHaveProperty('totalItems');
            expect(result.meta).toHaveProperty('totalPages');
            expect(result.meta).toHaveProperty('hasNextPage');
            expect(result.meta).toHaveProperty('hasPreviousPage');
        });
    });
});
