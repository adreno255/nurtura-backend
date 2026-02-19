import { BadRequestException } from '@nestjs/common';

import { MqttMessageParser } from './mqtt-parser.helper';
import { SensorDataDto } from '../../sensors/dto/sensor-data.dto';
import { DeviceStatusDto, DeviceErrorDto, ErrorSeverity, SensorType } from '../../racks/dto';

describe('MqttMessageParser', () => {
    describe('parseAndValidate - SensorDataDto', () => {
        it('should parse and validate valid sensor data payload', async () => {
            const payload = JSON.stringify({
                t: 25,
                h: 60,
                m: 40,
                l: 800,
                tm: 1700000000,
            });

            const result = await MqttMessageParser.parseAndValidate(
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
            );

            expect(result).toBeInstanceOf(SensorDataDto);
            expect(result.temperature).toBe(25);
            expect(result.humidity).toBe(60);
            expect(result.moisture).toBe(40);
            expect(result.lightLevel).toBe(800);
            expect(result.timestamp).toBe(1700000000);
        });

        it('should throw for out-of-range temperature', async () => {
            const payload = JSON.stringify({
                t: 100,
                h: 60,
                m: 40,
                l: 800,
            });

            await expect(
                MqttMessageParser.parseAndValidate(payload, SensorDataDto, 'AA:BB:CC:DD:EE:FF'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw for missing required fields', async () => {
            const payload = JSON.stringify({
                t: 25,
                h: 60,
            });

            await expect(
                MqttMessageParser.parseAndValidate(payload, SensorDataDto, 'AA:BB:CC:DD:EE:FF'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('parseAndValidate - DeviceStatusDto', () => {
        it('should parse and validate valid status payload', async () => {
            const payload = JSON.stringify({
                o: true,
                t: 1700000000,
                v: '1.0.3',
                ip: '192.168.1.10',
                s: -55,
                u: 3600,
                fm: 2048,
            });

            const result = await MqttMessageParser.parseAndValidate(
                payload,
                DeviceStatusDto,
                'AA:BB:CC:DD:EE:FF',
            );

            expect(result).toBeInstanceOf(DeviceStatusDto);
            expect(result.online).toBe(true);
            expect(result.firmwareVersion).toBe('1.0.3');
            expect(result.ipAddress).toBe('192.168.1.10');
            expect(result.signalStrength).toBe(-55);
        });

        it('should throw for invalid IP address', async () => {
            const payload = JSON.stringify({
                o: true,
                ip: '999.999.999.999',
            });

            await expect(
                MqttMessageParser.parseAndValidate(payload, DeviceStatusDto, 'AA:BB:CC:DD:EE:FF'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('parseAndValidate - DeviceErrorDto', () => {
        it('should parse and validate valid error payload', async () => {
            const payload = JSON.stringify({
                c: 'SENSOR_TIMEOUT',
                m: 'Temperature sensor did not respond',
                s: 'HIGH',
                t: 1700000000,
                st: 'TEMPERATURE',
                d: {
                    ac: 3,
                    lsr: 1699999000,
                },
            });

            const result = await MqttMessageParser.parseAndValidate(
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
            );

            expect(result).toBeInstanceOf(DeviceErrorDto);
            expect(result.code).toBe('SENSOR_TIMEOUT');
            expect(result.severity).toBe(ErrorSeverity.HIGH);
            expect(result.sensorType).toBe(SensorType.TEMPERATURE);
            expect(result.details?.attemptCount).toBe(3);
        });

        it('should throw if required fields are missing', async () => {
            const payload = JSON.stringify({
                m: 'Missing code',
                s: 'LOW',
            });

            await expect(
                MqttMessageParser.parseAndValidate(payload, DeviceErrorDto, 'AA:BB:CC:DD:EE:FF'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw for invalid enum values', async () => {
            const payload = JSON.stringify({
                c: 'ERR',
                m: 'Invalid severity',
                s: 'INVALID',
            });

            await expect(
                MqttMessageParser.parseAndValidate(payload, DeviceErrorDto, 'AA:BB:CC:DD:EE:FF'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('parseAndValidate - invalid JSON', () => {
        it('should throw BadRequestException for malformed JSON', async () => {
            const payload = '{ t: 25, h: 60 ';

            await expect(
                MqttMessageParser.parseAndValidate(payload, SensorDataDto, 'DEVICE-123'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('extractMacAddress', () => {
        it('should extract MAC address from valid topic', () => {
            const topic = 'nurtura/rack/AA:BB:CC:DD:EE:FF/sensors';

            const result = MqttMessageParser.extractMacAddress(topic);

            expect(result).toBe('AA:BB:CC:DD:EE:FF');
        });

        it('should return null for invalid topic', () => {
            const topic = 'invalid/topic';

            expect(MqttMessageParser.extractMacAddress(topic)).toBeNull();
        });
    });

    describe('extractMessageType', () => {
        it('should extract message type from valid topic', () => {
            const topic = 'nurtura/rack/AA:BB:CC:DD:EE:FF/errors';

            const result = MqttMessageParser.extractMessageType(topic);

            expect(result).toBe('errors');
        });

        it('should return null for invalid topic', () => {
            const topic = 'nurtura/rack/AA:BB:CC:DD:EE:FF';

            expect(MqttMessageParser.extractMessageType(topic)).toBeNull();
        });
    });

    describe('isValidMacAddress', () => {
        it('should validate correct MAC addresses', () => {
            expect(MqttMessageParser.isValidMacAddress('AA:BB:CC:DD:EE:FF')).toBe(true);
            expect(MqttMessageParser.isValidMacAddress('aa-bb-cc-dd-ee-ff')).toBe(true);
        });

        it('should reject invalid MAC addresses', () => {
            expect(MqttMessageParser.isValidMacAddress('INVALID')).toBe(false);
            expect(MqttMessageParser.isValidMacAddress('AA:BB:CC')).toBe(false);
        });
    });

    describe('normalizeMacAddress', () => {
        it('should normalize MAC address to uppercase colon format', () => {
            const result = MqttMessageParser.normalizeMacAddress('aa-bb-cc-dd-ee-ff');

            expect(result).toBe('AA:BB:CC:DD:EE:FF');
        });
    });

    describe('generateCommandTopic', () => {
        it('should generate watering command topic', () => {
            const topic = MqttMessageParser.generateCommandTopic('AA:BB:CC:DD:EE:FF', 'watering');

            expect(topic).toBe('nurtura/rack/AA:BB:CC:DD:EE:FF/commands/watering');
        });

        it('should generate lighting command topic', () => {
            const topic = MqttMessageParser.generateCommandTopic('AA:BB:CC:DD:EE:FF', 'lighting');

            expect(topic).toBe('nurtura/rack/AA:BB:CC:DD:EE:FF/commands/lighting');
        });
    });
});
