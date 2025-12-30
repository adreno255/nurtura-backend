export interface CurrentUserPayload {
    uid: string;
    email: string;
}

export interface RequestWithUser extends Request {
    user: CurrentUserPayload;
}
