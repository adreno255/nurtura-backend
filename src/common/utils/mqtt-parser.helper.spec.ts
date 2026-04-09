import { BadRequestException } from '@nestjs/common';
import { type EventEmitter2 } from '@nestjs/event-emitter';

import { MqttMessageParser } from './mqtt-parser.helper';
import { SensorDataDto } from '../../sensors/dto/sensor-data.dto';
import {
    DeviceStatusDto,
    DeviceErrorDto,
    ErrorSeverity,
    HardwareType,
    ErrorCode,
} from '../../racks/dto';
import { NotificationType, type Rack } from '../../generated/prisma';

const mockRack = {
    id: 'cmnngfrav00003wuu012xn9g7',
    user: {
        id: 'cmnovyrzs0000zguu27y669or',
        email: 'user@example.com',
    },
} as Rack & { user: { id: string; email: string } };

const mockEventEmitter = {
    emit: jest.fn(),
} as unknown as EventEmitter2;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('MqttMessageParser', () => {
    describe('parseAndValidate - SensorDataDto', () => {
        it('should parse and validate valid sensor data payload', async () => {
            const payload = JSON.stringify({
                t: 25,
                h: 60,
                m: 40,
                l: 800,
                tm: new Date(1700000000000).toISOString(),
            });

            const result = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            );

            expect(result).toBeInstanceOf(SensorDataDto);
            expect(result.temperature).toBe(25);
            expect(result.humidity).toBe(60);
            expect(result.moisture).toBe(40);
            expect(result.lightLevel).toBe(800);
            expect(result.timestamp).toBe(new Date(1700000000000).toISOString());
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should include waterUsed when provided', async () => {
            const payload = JSON.stringify({
                t: 25,
                h: 60,
                m: 40,
                l: 800,
                wu: 150,
                tm: new Date(1700000000000).toISOString(),
            });

            const result = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            );

            expect(result.waterUsed).toBe(150);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw and emit notification for out-of-range temperature', async () => {
            const payload = JSON.stringify({
                t: 100,
                h: 60,
                m: 40,
                l: 800,
                tm: new Date(1700000000000).toISOString(),
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Validation failed for device AA:BB:CC:DD:EE:FF/);
            expect(message).toMatch(/Temperature is too high \(max 60°C\)/);

            expect(jest.spyOn(mockEventEmitter, 'emit')).toHaveBeenCalledTimes(1);
            expect(jest.spyOn(mockEventEmitter, 'emit')).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    userId: mockRack.user.id,
                    rackId: mockRack.id,
                    type: NotificationType.ERROR,
                    title: 'Environment Irregularity Detected',
                    message: expect.stringContaining(
                        'Temperature is too high (max 60°C)',
                    ) as string,
                    metadata: expect.objectContaining({
                        screen: `/(tabs)/(racks)/${mockRack.id}`,
                    }) as object,
                }),
            );
        });

        it('should throw and emit notification for multiple out-of-range fields', async () => {
            const payload = JSON.stringify({
                t: 100,
                h: -5,
                m: 40,
                l: 800,
                tm: new Date(1700000000000).toISOString(),
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Temperature is too high \(max 60°C\)/);
            expect(message).toMatch(/Humidity is too low \(min 0%\)/);

            expect(jest.spyOn(mockEventEmitter, 'emit')).toHaveBeenCalledTimes(1);
            expect(jest.spyOn(mockEventEmitter, 'emit')).toHaveBeenCalledWith(
                'createNotification',
                expect.objectContaining({
                    message: expect.stringContaining(
                        'Temperature is too high (max 60°C)',
                    ) as string,
                }),
            );
        });

        it('should throw and emit notification for missing required fields', async () => {
            const payload = JSON.stringify({
                t: 25,
                h: 60,
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Validation failed for device AA:BB:CC:DD:EE:FF/);
            expect(jest.spyOn(mockEventEmitter, 'emit')).toHaveBeenCalledTimes(1);
        });
    });

    describe('parseAndValidate - DeviceStatusDto', () => {
        it('should parse and validate valid status payload', async () => {
            const payload = JSON.stringify({
                o: true,
                t: new Date(1700000000000).toISOString(),
                v: '1.0.3',
                ip: '192.168.1.10',
                u: 3600,
            });

            const result = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceStatusDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            );

            expect(result).toBeInstanceOf(DeviceStatusDto);
            expect(result.online).toBe(true);
            expect(result.firmwareVersion).toBe('1.0.3');
            expect(result.ipAddress).toBe('192.168.1.10');
            expect(result.uptime).toBe(3600);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw but NOT emit notification for invalid IP address', async () => {
            const payload = JSON.stringify({
                o: true,
                ip: '999.999.999.999',
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceStatusDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Validation failed for device AA:BB:CC:DD:EE:FF/);

            // Should NOT emit — only SensorDataDto triggers notifications
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw but NOT emit notification for missing required online field', async () => {
            const payload = JSON.stringify({
                v: '1.0.3',
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceStatusDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });
    });

    describe('parseAndValidate - DeviceErrorDto', () => {
        it('should parse and validate valid error payload', async () => {
            const payload = JSON.stringify({
                c: 'SENSOR_TIMEOUT',
                m: 'Temperature sensor did not respond',
                s: 'HIGH',
                tm: new Date(1700000000000).toISOString(),
                ht: 'TEMPERATURE',
                d: {
                    ac: 3,
                    lsr: 1699999000,
                },
            });

            const result = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            );

            expect(result).toBeInstanceOf(DeviceErrorDto);
            expect(result.code).toBe(ErrorCode.SENSOR_TIMEOUT);
            expect(result.severity).toBe(ErrorSeverity.HIGH);
            expect(result.hardwareType).toBe(HardwareType.TEMPERATURE);
            expect(result.details?.attemptCount).toBe(3);
            expect(result.details?.lastSuccessfulRead).toBe(1699999000);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should parse valid error payload without optional fields', async () => {
            const payload = JSON.stringify({
                c: 'PUMP_FAILURE',
                m: 'Water pump failed to start',
                s: 'CRITICAL',
            });

            const result = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            );

            expect(result).toBeInstanceOf(DeviceErrorDto);
            expect(result.code).toBe(ErrorCode.PUMP_FAILURE);
            expect(result.severity).toBe(ErrorSeverity.CRITICAL);
            expect(result.hardwareType).toBeUndefined();
            expect(result.details).toBeUndefined();
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw but NOT emit for missing required fields', async () => {
            const payload = JSON.stringify({
                m: 'Missing code and severity',
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Validation failed for device AA:BB:CC:DD:EE:FF/);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw but NOT emit for invalid ErrorSeverity enum', async () => {
            const payload = JSON.stringify({
                c: 'SENSOR_FAILURE',
                m: 'Something broke',
                s: 'INVALID_SEVERITY',
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Validation failed for device AA:BB:CC:DD:EE:FF/);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });

        it('should throw but NOT emit for invalid ErrorCode enum', async () => {
            const payload = JSON.stringify({
                c: 'NOT_A_REAL_CODE',
                m: 'Bad error code',
                s: 'LOW',
            });

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                DeviceErrorDto,
                'AA:BB:CC:DD:EE:FF',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });
    });

    describe('parseAndValidate - invalid JSON', () => {
        it('should throw BadRequestException for malformed JSON', async () => {
            const payload = '{ t: 25, h: 60 ';

            const error = await MqttMessageParser.parseAndValidate(
                mockRack,
                payload,
                SensorDataDto,
                'DEVICE-123',
                mockEventEmitter,
            ).catch((e: BadRequestException) => e);

            expect(error).toBeInstanceOf(BadRequestException);

            const body = (error as BadRequestException).getResponse() as
                | string
                | { message: string };
            const message = typeof body === 'string' ? body : body.message;

            expect(message).toMatch(/Invalid JSON payload from device DEVICE-123/);

            // JSON parse errors should never trigger a notification
            expect(jest.spyOn(mockEventEmitter, 'emit')).not.toHaveBeenCalled();
        });
    });

    describe('extractMacAddress', () => {
        it('should extract MAC address from valid topic', () => {
            expect(
                MqttMessageParser.extractMacAddress('nurtura/rack/AA:BB:CC:DD:EE:FF/sensors'),
            ).toBe('AA:BB:CC:DD:EE:FF');
        });

        it('should return null for topic with too few segments', () => {
            expect(MqttMessageParser.extractMacAddress('invalid/topic')).toBeNull();
        });

        it('should return null for topic with wrong prefix', () => {
            expect(
                MqttMessageParser.extractMacAddress('other/rack/AA:BB:CC:DD:EE:FF/sensors'),
            ).toBeNull();
        });
    });

    describe('extractMessageType', () => {
        it('should extract message type from valid topic', () => {
            expect(
                MqttMessageParser.extractMessageType('nurtura/rack/AA:BB:CC:DD:EE:FF/errors'),
            ).toBe('errors');
        });

        it('should return null for topic missing message type segment', () => {
            expect(
                MqttMessageParser.extractMessageType('nurtura/rack/AA:BB:CC:DD:EE:FF'),
            ).toBeNull();
        });
    });

    describe('isValidMacAddress', () => {
        it('should accept colon-separated uppercase MAC', () => {
            expect(MqttMessageParser.isValidMacAddress('AA:BB:CC:DD:EE:FF')).toBe(true);
        });

        it('should accept hyphen-separated lowercase MAC', () => {
            expect(MqttMessageParser.isValidMacAddress('aa-bb-cc-dd-ee-ff')).toBe(true);
        });

        it('should reject a plain string', () => {
            expect(MqttMessageParser.isValidMacAddress('INVALID')).toBe(false);
        });

        it('should reject a truncated MAC', () => {
            expect(MqttMessageParser.isValidMacAddress('AA:BB:CC')).toBe(false);
        });
    });

    describe('normalizeMacAddress', () => {
        it('should convert hyphen-separated lowercase to colon-separated uppercase', () => {
            expect(MqttMessageParser.normalizeMacAddress('aa-bb-cc-dd-ee-ff')).toBe(
                'AA:BB:CC:DD:EE:FF',
            );
        });

        it('should leave already-normalized MAC unchanged', () => {
            expect(MqttMessageParser.normalizeMacAddress('AA:BB:CC:DD:EE:FF')).toBe(
                'AA:BB:CC:DD:EE:FF',
            );
        });
    });

    describe('generateCommandTopic', () => {
        it('should generate watering command topic', () => {
            expect(MqttMessageParser.generateCommandTopic('AA:BB:CC:DD:EE:FF', 'watering')).toBe(
                'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/watering',
            );
        });

        it('should generate lighting command topic', () => {
            expect(MqttMessageParser.generateCommandTopic('AA:BB:CC:DD:EE:FF', 'lighting')).toBe(
                'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/lighting',
            );
        });

        it('should generate sensors command topic', () => {
            expect(MqttMessageParser.generateCommandTopic('AA:BB:CC:DD:EE:FF', 'sensors')).toBe(
                'nurtura/rack/AA:BB:CC:DD:EE:FF/commands/sensors',
            );
        });
    });
});
