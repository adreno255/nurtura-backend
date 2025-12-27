import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: envValidationSchema,
            validationOptions: {
                abortEarly: false,
                allowUnknown: true,
            },
        }),
        DatabaseModule,
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 120,
            },
        ]),
        MyLoggerModule,
        AuthModule,
        EmailModule,
        FirebaseModule,
    ],
    controllers: [AppController],
    providers: [
        AllExceptionsFilter,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}
