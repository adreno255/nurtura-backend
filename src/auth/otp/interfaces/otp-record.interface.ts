export interface OtpRecord {
    code: string;
    expiresAt: number;
    purpose: 'registration' | 'forgot-password';
}

export interface OtpStore {
    [email: string]: OtpRecord;
}
