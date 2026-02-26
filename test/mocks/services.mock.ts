/**
 * Services Mock Utilities
 * Reusable mocks for Services that has minimal implementation
 */

export const createMockLogRackActivityHelper = () => ({
    logActivity: jest.fn().mockResolvedValue(undefined),
});

export const createMockEventEmitter = () => ({
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
});

export const createMockAuthService = () => ({
    getProviders: jest.fn(),
    getOnboardingStatus: jest.fn(),
    updatePassword: jest.fn(),
});

export const createMockEmailService = () => ({
    sendRegistrationOtp: jest.fn(),
    sendForgotPasswordOtp: jest.fn(),
    sendPasswordResetOtp: jest.fn(),
    sendEmailResetOtp: jest.fn(),
    sendEmailResetNotification: jest.fn(),
});

export const createMockOtpService = () => ({
    sendRegistrationOtp: jest.fn(),
    sendForgotPasswordOtp: jest.fn(),
    sendPasswordResetOtp: jest.fn(),
    sendEmailResetOtp: jest.fn(),
    verifyOtp: jest.fn(),
});

export const createMockUsersService = () => ({
    checkEmailAvailability: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByFirebaseUid: jest.fn(),
    update: jest.fn(),
});

export const createMockSensorsService = () => ({
    getLatestReading: jest.fn(),
    getReadings: jest.fn(),
    getAggregatedData: jest.fn(),
    getHistory: jest.fn(),
    getStatistics: jest.fn(),
    calculateStats: jest.fn(),
    processSensorData: jest.fn(),
});

export const createMockRacksService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByMacAddress: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    verifyRackOwnership: jest.fn(),
    processDeviceStatus: jest.fn(),
    processDeviceError: jest.fn(),
    getLatestSensorReading: jest.fn(),
    getCurrentState: jest.fn(),
    getDeviceStatus: jest.fn(),
    updateDeviceStatus: jest.fn(),
    updateLastSeenAt: jest.fn(),
    getRecentActivities: jest.fn(),
});

export const createMockAutomationService = () => ({
    evaluateRules: jest.fn(),
    evaluateConditions: jest.fn(),
    executeActions: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    validateConditions: jest.fn(),
    validateActions: jest.fn(),
});
