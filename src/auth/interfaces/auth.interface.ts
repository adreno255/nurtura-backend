export interface AuthProvidersResponse {
    providers: string[];
}

export interface OnboardingStatusResponse {
    needsOnboarding: boolean;
    providers?: string[];
    message: string;
}

export interface UpdatePasswordResponse {
    message: string;
}
