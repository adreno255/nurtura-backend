export interface User {
    id: string;
    firebaseUid: string;
    email: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    address: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserInfo {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    email: string;
    address: string;
    block: string;
    street: string;
    barangay: string;
    city: string;
}

export interface EmailAvailabilityResponse {
    available: boolean;
    message: string;
}

export interface UserCreatedResponse {
    message: string;
    userId: string;
}

export interface UserInfoResponse {
    message: string;
    userInfo: UserInfo;
}
