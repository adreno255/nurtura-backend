import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    app.enableCors();

    const configService = app.get<ConfigService>(ConfigService);
    const port = configService.get<number>('PORT') ?? 3000;

    await app.listen(port);

    console.log(`Server running on http://localhost:${port}`);
}

void bootstrap();
