import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
    let controller: AppController;

    const mockAppService = {
        getStatus: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                {
                    provide: AppService,
                    useValue: mockAppService,
                },
            ],
        }).compile();

        controller = module.get<AppController>(AppController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getStatus', () => {
        it('should call appService.getStatus', () => {
            const mockStatus = {
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'development',
                version: '0.0.1',
            };

            mockAppService.getStatus.mockReturnValue(mockStatus);

            controller.getStatus();

            expect(mockAppService.getStatus).toHaveBeenCalledTimes(1);
        });

        it('should return the result from appService.getStatus', () => {
            const mockStatus = {
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'production',
                version: '1.2.3',
            };

            mockAppService.getStatus.mockReturnValue(mockStatus);

            const result = controller.getStatus();

            expect(result).toEqual(mockStatus);
        });

        it('should delegate to appService without modification', () => {
            const mockStatus = {
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'test',
                version: '2.0.0',
            };

            mockAppService.getStatus.mockReturnValue(mockStatus);

            const result = controller.getStatus();

            expect(result).toBe(mockStatus);
        });
    });
});
