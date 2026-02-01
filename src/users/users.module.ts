import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
    imports: [DatabaseModule, FirebaseModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
