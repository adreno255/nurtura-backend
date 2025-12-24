import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('root', () => {
        it('should return API server details', () => {
            expect(appController.getStatus()).toBe({
                name: 'Nurtura API Server',
                status: 'ok',
                environment: 'development',
                version: '0.0.1',
            });
        });
    });
});
