/**
 * Firebase Mock Utilities
 * Reusable mocks for Firebase Auth and Firestore
 */

export const createMockFirebaseAuth = () => ({
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    verifyIdToken: jest.fn(),
});

export const createMockFirebaseService = (mockAuth = createMockFirebaseAuth()) => ({
    getAuth: jest.fn(() => mockAuth),
    getFirestore: jest.fn(),
});

export const createMockFirebaseUser = (overrides = {}) => ({
    uid: 'test-firebase-uid',
    email: 'test@example.com',
    emailVerified: true,
    displayName: 'Test User',
    photoURL: null,
    disabled: false,
    metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString(),
    },
    providerData: [
        {
            providerId: 'password',
            uid: 'test@example.com',
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: null,
            phoneNumber: null,
        },
    ],
    ...overrides,
});

export const createMockDecodedToken = (overrides = {}) => ({
    uid: 'test-firebase-uid',
    email: 'test@example.com',
    email_verified: true,
    auth_time: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
});

export function createFirebaseAuthError(code: string, message: string): Error {
    const firebaseError = new Error(message);
    Object.assign(firebaseError, { code: `auth/${code}` });

    return firebaseError;
}

export const FirebaseAuthErrors = {
    userNotFound: () => createFirebaseAuthError('user-not-found', 'User not found'),
    emailAlreadyExists: () =>
        createFirebaseAuthError('email-already-exists', 'Email already exists'),
    invalidPassword: () => createFirebaseAuthError('weak-password', 'Password is too weak'),
    invalidEmail: () => createFirebaseAuthError('invalid-email', 'Invalid email format'),
    invalidIdToken: () => createFirebaseAuthError('invalid-id-token', 'Invalid token'),
    idTokenExpired: () => createFirebaseAuthError('id-token-expired', 'Expired token'),
};
