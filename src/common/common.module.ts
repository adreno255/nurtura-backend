import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { FirebaseJwtStrategy } from './strategies/firebase-jwt.strategy';
import { FirebaseModule } from '../firebase/firebase.module';
import { DatabaseModule } from '../database/database.module';
import { LogRackActivityHelper } from './utils/log-rack-activity.helper';

@Global()
@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
        FirebaseModule,
        DatabaseModule,
    ],
    providers: [FirebaseJwtStrategy, LogRackActivityHelper],
    exports: [FirebaseJwtStrategy, PassportModule, LogRackActivityHelper],
})
export class CommonModule {}
