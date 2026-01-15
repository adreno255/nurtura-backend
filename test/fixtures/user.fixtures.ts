/**
 * User Test Fixtures
 * Reusable test data for user-related tests
 */

import { type CreateUserDto } from '../../src/users/dto/create-user.dto';
import { type User } from '../../src/users/interfaces/user.interface';

/**
 * Valid CreateUserDto with all fields
 */
export const validCreateUserDto: CreateUserDto = {
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    block: 'Block 5',
    street: 'Sampaguita St',
    barangay: 'Brgy Commonwealth',
    city: 'Quezon City',
};

/**
 * CreateUserDto without optional fields
 */
export const minimalCreateUserDto: CreateUserDto = {
    firstName: 'John',
    lastName: 'Doe',
    block: 'Block 5',
    street: 'Sampaguita St',
    barangay: 'Brgy Commonwealth',
    city: 'Quezon City',
};

/**
 * CreateUserDto with different address
 */
export const alternativeUserDto: CreateUserDto = {
    firstName: 'Alice',
    middleName: 'Marie',
    lastName: 'Johnson',
    block: 'Block 10',
    street: 'Orchid Ave',
    barangay: 'Brgy Greenfield',
    city: 'Makati',
};

/**
 * Incomplete User entity (will be passed to database)
 */
export const inputUser = {
    firebaseUid: 'test-firebase-uid',
    email: 'test@example.com',
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
};

/**
 * Complete User entity (as returned from database)
 */
export const validUser: User = {
    id: 'user-id-123',
    firebaseUid: 'test-firebase-uid',
    email: 'test@example.com',
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * User without optional fields
 */
export const minimalUser: User = {
    id: 'user-id-123',
    firebaseUid: 'test-firebase-uid',
    email: 'test@example.com',
    firstName: 'John',
    middleName: null,
    lastName: 'Doe',
    suffix: null,
    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * User with different data
 */
export const alternativeUser: User = {
    id: 'user-id-789',
    firebaseUid: 'firebase-uid-789',
    email: 'alice.johnson@example.com',
    firstName: 'Alice',
    middleName: 'Marie',
    lastName: 'Johnson',
    suffix: null,
    address: 'Block 10, Orchid Ave, Brgy Greenfield, Makati',
    createdAt: new Date('2025-01-03T00:00:00.000Z'),
    updatedAt: new Date('2025-01-03T00:00:00.000Z'),
};

/**
 * Array of multiple users for list tests
 */
export const multipleUsers: User[] = [validUser, minimalUser, alternativeUser];

/**
 * Common test emails
 */
export const testEmails = {
    valid: 'test@example.com',
    alternative: 'user@test.com',
    withPlus: 'test+tag@example.com',
    withDots: 'test.user@example.com',
    subdomain: 'user@mail.example.com',
};

/**
 * Common Firebase UIDs
 */
export const testFirebaseUids = {
    primary: 'test-firebase-uid',
    secondary: 'firebase-uid-abc123',
    alternative: 'uid-xyz789',
};
