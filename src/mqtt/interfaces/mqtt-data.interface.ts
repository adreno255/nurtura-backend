export interface SensorData {
    temperature: number;
    humidity: number;
    moisture: number;
    lightLevel: number;
    timestamp?: number;
}

export interface DeviceStatus {
    online: boolean;
    timestamp?: number;
    firmwareVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    signalStrength?: number; // WiFi signal strength in dBm (e.g., -70)
    uptime?: number; // Milliseconds since device boot
    freeMemory?: number; // Available heap memory in bytes
}

export interface DeviceError {
    code: string; // Error code (e.g., 'SENSOR_READ_FAIL', 'WIFI_DISCONNECT')
    message: string; // Human-readable error message
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp?: number;
    sensorType?: 'TEMPERATURE' | 'HUMIDITY' | 'MOISTURE' | 'LIGHT'; // Which sensor failed
    details?: {
        attemptCount?: number; // How many times it retried
        lastSuccessfulRead?: number; // Timestamp of last successful reading
        errorData?: any; // Any additional error context
    };
}
