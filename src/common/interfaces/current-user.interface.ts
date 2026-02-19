export interface CurrentUserPayload {
    dbId: string;
    firebaseUid: string;
    email: string;
}

export interface RequestWithUser extends Request {
    user: CurrentUserPayload;
}
