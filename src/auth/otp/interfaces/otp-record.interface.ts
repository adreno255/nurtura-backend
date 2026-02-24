export interface OtpRecord {
    code: string;
    expiresAt: number;
    purpose: 'registration' | 'forgot-password' | 'password-reset' | 'email-reset';
}

export interface OtpStore {
    [email: string]: OtpRecord;
}
