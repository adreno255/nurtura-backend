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
    resolveAuthorizedRackIds: jest.fn(),
    processDeviceStatus: jest.fn(),
    processDeviceError: jest.fn(),
    getLatestSensorReading: jest.fn(),
    getCurrentState: jest.fn(),
    getDeviceStatus: jest.fn(),
    getRackActivities: jest.fn(),
    getPlantCareActivities: jest.fn(),
    getHarvestActivities: jest.fn(),
    getPlantingActivities: jest.fn(),
    harvestFromRack: jest.fn(),
    assignToRack: jest.fn(),
    unassignFromRack: jest.fn(),
    getRecentActivities: jest.fn(),
    updateDeviceStatus: jest.fn(),
    updateLastSeenAt: jest.fn(),
});

export const createMockPlantsService = () => ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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
