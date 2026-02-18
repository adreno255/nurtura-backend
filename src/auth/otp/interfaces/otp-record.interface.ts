export interface OtpRecord {
    code: string;
    expiresAt: number;
    purpose: 'registration' | 'password-reset' | 'email-reset';
}

export interface OtpStore {
    [email: string]: OtpRecord;
}
