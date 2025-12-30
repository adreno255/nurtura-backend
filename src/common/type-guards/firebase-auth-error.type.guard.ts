import { type FirebaseAuthError } from '../interfaces';

export function isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
    return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
