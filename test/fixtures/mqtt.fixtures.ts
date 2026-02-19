/**
 * Test fixtures for MQTT service testing
 * Includes sample topics and message payloads
 */

// MQTT Topics
export const mqttTestTopics = {
    sensors: 'nurtura/rack/AA:BB:CC:DD:EE:FF/sensors',
    status: 'nurtura/rack/AA:BB:CC:DD:EE:FF/status',
    errors: 'nurtura/rack/AA:BB:CC:DD:EE:FF/errors',
    commandWatering: 'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/watering',
    commandLighting: 'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/lighting',
    commandSensors: 'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/sensors',
    invalidTopic: 'invalid/topic/format',
    unknownMessageType: 'nurtura/rack/AA:BB:CC:DD:EE:FF/unknown',
};

// MQTT Test Messages
export const mqttTestMessages = {
    validSensorData: JSON.stringify({
        temperature: 25.5,
        humidity: 60.2,
        moisture: 45.8,
        lightLevel: 350,
        timestamp: new Date().toISOString(),
    }),

    deviceOnline: JSON.stringify({
        status: 'online',
        timestamp: new Date().toISOString(),
    }),

    deviceOffline: JSON.stringify({
        status: 'offline',
        timestamp: new Date().toISOString(),
    }),

    deviceError: JSON.stringify({
        error: 'Sensor malfunction',
        errorCode: 'SENSOR_ERROR',
        timestamp: new Date().toISOString(),
    }),

    wateringCommand: JSON.stringify({
        action: 'on',
        duration: 5000,
    }),

    lightingCommand: JSON.stringify({
        action: 'off',
    }),

    sensorsCommand: JSON.stringify({
        interval: 60000,
    }),

    invalidJson: 'not valid json {[',

    emptyPayload: '{}',
};

// MAC Addresses for testing
export const mqttTestMacAddresses = {
    valid: 'AA:BB:CC:DD:EE:FF',
    alternative: '11:22:33:44:55:66',
    invalid: 'invalid-mac',
};

// Sample parsed sensor data
export const parsedSensorData = {
    temperature: 25.5,
    humidity: 60.2,
    moisture: 45.8,
    lightLevel: 350,
    timestamp: expect.any(String) as unknown as string,
};

// Sample device status
export const deviceStatus = {
    online: {
        status: 'online',
        timestamp: expect.any(String) as unknown as string,
    },
    offline: {
        status: 'offline',
        timestamp: expect.any(String) as unknown as string,
    },
    error: {
        status: 'error',
        timestamp: expect.any(String) as unknown as string,
    },
};
