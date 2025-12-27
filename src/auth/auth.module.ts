import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpController } from './otp/otp.controller';
import { OtpService } from './otp/otp.service';
import { EmailModule } from 'src/email/email.module';
import { MyLoggerModule } from 'src/my-logger/my-logger.module';

@Module({
    imports: [EmailModule, MyLoggerModule],
    controllers: [AuthController, OtpController],
    providers: [AuthService, OtpService],
    exports: [AuthService, OtpService],
})
export class AuthModule {}
