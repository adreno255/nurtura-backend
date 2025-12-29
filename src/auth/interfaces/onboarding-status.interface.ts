export interface OnboardingStatusResponse {
    needsOnboarding: boolean;
    providers?: string[];
    message: string;
}
