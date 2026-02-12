export interface OtpRecord {
    code: string;
    expiresAt: number;
    purpose: 'registration' | 'forgot-password' | 'email-reset';
}

export interface OtpStore {
    [email: string]: OtpRecord;
}
