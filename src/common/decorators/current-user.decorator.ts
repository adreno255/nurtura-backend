import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type CurrentUserPayload, type RequestWithUser } from '../interfaces';

export const CurrentUser = createParamDecorator(
    (data: keyof CurrentUserPayload | undefined, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;
        return data ? user?.[data] : user;
    },
);
