import { Test, type TestingModule } from '@nestjs/testing';
import { SystemRulesService } from './system-rules.service';

describe('SystemRulesService', () => {
    let service: SystemRulesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SystemRulesService],
        }).compile();

        service = module.get<SystemRulesService>(SystemRulesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
