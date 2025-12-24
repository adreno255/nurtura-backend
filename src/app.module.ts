import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        // AuthModule,
        // UsersModule,
        DatabaseModule,
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 120,
            },
        ]),
        MyLoggerModule,
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
