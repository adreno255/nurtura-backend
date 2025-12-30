export interface CurrentUserPayload {
    firebaseUid: string;
    email: string;
}

export interface RequestWithUser extends Request {
    user: CurrentUserPayload;
}
