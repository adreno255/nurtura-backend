import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { FirebaseModule } from './firebase/firebase.module';
import { CommonModule } from './common/common.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { UsersModule } from './users/users.module';
import { MqttModule } from './mqtt/mqtt.module';
import { AppService } from './app.service';
import { SensorsModule } from './sensors/sensors.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RacksModule } from './racks/racks.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: process.env.NODE_ENV === 'production',
            envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
            validationSchema: envValidationSchema,
            validationOptions: {
                abortEarly: false,
                allowUnknown: true,
            },
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: process.env.NODE_ENV === 'test' ? 120 : 30,
                blockDuration: 60000, // If they hit 30/min, they are banned for 1 minute
            },
        ]),
        MyLoggerModule,
        DatabaseModule,
        CommonModule,
        EmailModule,
        FirebaseModule,
        AuthModule,
        UsersModule,
        MqttModule,
        SensorsModule,
        WebsocketModule,
        RacksModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        AllExceptionsFilter,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: FirebaseAuthGuard,
        },
    ],
})
export class AppModule {}
