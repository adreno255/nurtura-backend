import { Test, type TestingModule } from '@nestjs/testing';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

describe('AutomationController', () => {
    let controller: AutomationController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AutomationController],
            providers: [AutomationService],
        }).compile();

        controller = module.get<AutomationController>(AutomationController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
