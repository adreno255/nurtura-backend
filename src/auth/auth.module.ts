import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpController } from './otp/otp.controller';
import { OtpService } from './otp/otp.service';

@Module({
    controllers: [AuthController, OtpController],
    providers: [AuthService, OtpService],
})
export class AuthModule {}
