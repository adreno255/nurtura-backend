export interface SensorData {
    temperature: number;
    humidity: number;
    moisture: number;
    lightLevel: number;
}

export interface RuleConditions {
    moisture?: {
        lessThan?: number;
        greaterThan?: number;
    };
    temperature?: {
        lessThan?: number;
        greaterThan?: number;
    };
    humidity?: {
        lessThan?: number;
        greaterThan?: number;
    };
    lightLevel?: {
        lessThan?: number;
        greaterThan?: number;
    };
}

export interface RuleActions {
    watering?: {
        action: 'start' | 'stop';
        duration?: number;
    };
    growLight?: {
        action: 'on' | 'off';
    };
}
