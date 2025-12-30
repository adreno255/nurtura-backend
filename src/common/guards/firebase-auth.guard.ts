import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { CurrentUserPayload } from '../interfaces';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true; // Skip authentication for public routes
        }

        return super.canActivate(context);
    }

    handleRequest<TUser = CurrentUserPayload>(
        err: Error | null,
        user: TUser | false,
        _info: unknown,
        _context: ExecutionContext,
    ): TUser {
        if (err || !user) {
            throw err || new UnauthorizedException('Authentication required');
        }
        return user;
    }
}
