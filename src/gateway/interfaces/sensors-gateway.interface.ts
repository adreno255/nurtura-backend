import { type Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
    data: {
        user: {
            uid: string;
            email?: string;
        };
    };
}
