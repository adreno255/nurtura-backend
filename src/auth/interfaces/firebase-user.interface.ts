export interface FirebaseUserInfo {
    uid: string;
    email: string;
    emailVerified: boolean;
    providerData: Array<{
        providerId: string;
        uid: string;
        email?: string;
    }>;
}

export interface FirebaseAuthError extends Error {
    code: string;
    message: string;
}
