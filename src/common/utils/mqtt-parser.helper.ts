import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

/**
 * Helper class for parsing and validating MQTT messages
 */
export class MqttMessageParser {
    /**
     * Parse and validate MQTT message payload
     * @param payload - Raw message payload (string)
     * @param dtoClass - DTO class to validate against
     * @param deviceId - Device identifier (for error logging)
     * @returns Validated DTO instance or null if validation fails
     */
    static async parseAndValidate<T extends object>(
        payload: string,
        dtoClass: new () => T,
        deviceId: string,
    ): Promise<T> {
        // Parse JSON
        let data: object;
        try {
            data = JSON.parse(payload) as object;
        } catch (error) {
            throw new BadRequestException(
                `Invalid JSON payload from device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        // Transform to DTO instance
        const dtoInstance = plainToInstance(dtoClass, data);

        // Validate DTO
        const errors: ValidationError[] = await validate(dtoInstance as object);

        if (errors.length > 0) {
            const errorMessages = errors
                .map((error) => Object.values(error.constraints || {}).join(', '))
                .join('; ');

            throw new BadRequestException(
                `Validation failed for device ${deviceId}: ${errorMessages}`,
            );
        }

        return dtoInstance;
    }

    /**
     * Extract MAC address from MQTT topic
     * @param topic - MQTT topic string
     * @returns MAC address or null if invalid topic
     */
    static extractMacAddress(topic: string): string | null {
        const parts = topic.split('/');

        // Expected format: nurtura/rack/{macAddress}/{messageType}
        if (parts.length < 4 || parts[0] !== 'nurtura' || parts[1] !== 'rack') {
            return null;
        }

        return parts[2];
    }

    /**
     * Extract message type from MQTT topic
     * @param topic - MQTT topic string
     * @returns Message type or null if invalid topic
     */
    static extractMessageType(topic: string): string | null {
        const parts = topic.split('/');

        // Expected format: nurtura/rack/{macAddress}/{messageType}
        if (parts.length < 4 || parts[0] !== 'nurtura' || parts[1] !== 'rack') {
            return null;
        }

        return parts[3];
    }

    /**
     * Validate MAC address format
     * @param macAddress - MAC address string
     * @returns true if valid, false otherwise
     */
    static isValidMacAddress(macAddress: string): boolean {
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        return macRegex.test(macAddress);
    }

    /**
     * Normalize MAC address to consistent format (uppercase with colons)
     * @param macAddress - MAC address string
     * @returns Normalized MAC address
     */
    static normalizeMacAddress(macAddress: string): string {
        return macAddress.toUpperCase().replace(/-/g, ':');
    }

    /**
     * Generate MQTT topic for command publishing
     * @param macAddress - Device MAC address
     * @param commandType - Type of command (watering, lighting, sensors)
     * @returns MQTT topic string
     */
    static generateCommandTopic(
        macAddress: string,
        commandType: 'watering' | 'lighting' | 'sensors',
    ): string {
        return `nurtura/rack/${macAddress}/commands/${commandType}`;
    }
}
