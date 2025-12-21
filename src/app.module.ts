import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        DatabaseModule,
        // UsersModule,
        // AuthModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
