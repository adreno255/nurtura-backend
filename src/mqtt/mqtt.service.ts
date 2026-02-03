import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient, IClientSubscribeOptions } from 'mqtt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { DatabaseService } from '../database/database.service';
import { SensorDataDto, DeviceStatusDto, DeviceErrorDto } from './dto';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
    private client: MqttClient | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private subscribedTopics: string[] = [];

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: MyLoggerService,
        private readonly websocketGateway: WebsocketGateway,
        private readonly databaseService: DatabaseService,
    ) {}

    async onModuleInit() {
        await this.connectToMqttBroker();
    }

    private connectToMqttBroker(): Promise<void> {
        return new Promise((resolve, reject) => {
            const host = this.configService.get<string>('MQTT_HOST');
            const port = this.configService.get<number>('MQTT_PORT', 8883);
            const username = this.configService.get<string>('MQTT_USERNAME');
            const password = this.configService.get<string>('MQTT_PASSWORD');

            if (!host || !username || !password) {
                this.logger.error('MQTT credentials is not configured', '', 'MqttService');
                reject(new Error('MQTT configuration is incomplete. Check environment variables.'));
            }

            const mqttUrl = `mqtts://${host}:${port}`;
            const clientId = `nurtura-backend-${Math.random().toString(16).slice(2, 8)}`;

            this.logger.bootstrap(`Connecting to MQTT broker: ${mqttUrl}`, 'MqttService');

            this.client = mqtt.connect(mqttUrl, {
                username,
                password,
                clientId,
                rejectUnauthorized: true,
                reconnectPeriod: 5000, // 5 seconds between reconnect attempts
                connectTimeout: 30000, // 30 seconds timeout
                keepalive: 60, // Send ping every 60 seconds
                clean: true, // Start fresh session
            });

            // Setup listeners so that the server will fail fast if MQTT cannot connect
            const onConnect = () => {
                cleanup();
                this.logger.bootstrap('Connected to MQTT broker', 'MqttService');
                resolve();
            };

            const onError = (err: Error) => {
                cleanup();
                this.logger.error('Failed to connect to MQTT broker', err.message);
                reject(err);
            };

            // Helper to remove listeners so they don't hang around
            const cleanup = () => {
                this.client?.removeListener('connect', onConnect);
                this.client?.removeListener('error', onError);
            };

            // Resolve only when the first connection is established
            this.client.once('connect', onConnect);

            // Reject if it fails to connect within timeout
            this.client.once('error', onError);

            this.setupEventHandlers();
        });
    }

    private setupEventHandlers() {
        if (!this.client) return;

        // Connection established
        this.client.on('connect', () => {
            this.reconnectAttempts = 0;
            this.subscribeToTopics();
        });

        // Message received
        this.client.on('message', (topic, payload) => {
            this.logger.log(`Message received on topic: ${topic}`, 'MqttService');

            const message = payload.toString();

            this.handleIncomingMessage(topic, message).catch((error) => {
                this.logger.error(
                    `Error processing message from topic: ${topic}`,
                    error instanceof Error ? error.message : String(error),
                    'MqttService',
                );
            });
        });

        // Packet received (for debugging)
        if (this.configService.get('NODE_ENV') === 'development') {
            this.client.on('packetreceive', (packet) => {
                if (packet.cmd === 'publish') {
                    this.logger.debug(
                        `Raw packet received on topic: ${packet.topic}`,
                        'MqttService',
                    );
                }
            });
        }

        // Disconnection
        this.client.on('disconnect', () => {
            this.logger.warn('Disconnected from MQTT broker', 'MqttService');
        });

        // Reconnection
        this.client.on('reconnect', () => {
            this.reconnectAttempts++;
            this.logger.log(
                `Reconnecting to MQTT broker (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
                'MqttService',
            );

            if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                this.logger.error(
                    'Max reconnection attempts reached. Stopping reconnection.',
                    '',
                    'MqttService',
                );
                this.client?.end(true);
            }
        });

        // Connection lost
        this.client.on('offline', () => {
            this.logger.warn('MQTT client is offline', 'MqttService');
        });

        // Errors
        this.client.on('error', (error) => {
            this.logger.error('MQTT client error', error.message, 'MqttService');
        });

        // Connection closed
        this.client.on('close', () => {
            this.logger.warn('MQTT connection closed', 'MqttService');
        });
    }

    private subscribeToTopics() {
        if (!this.client || !this.client.connected) {
            this.logger.warn('Cannot subscribe: MQTT client not connected', 'MqttService');
            return;
        }

        const topics = [
            'nurtura/+/sensors', // All sensor data
            'nurtura/+/status', // Device status updates
            'nurtura/+/errors', // Error messages from devices
        ];

        const options: IClientSubscribeOptions = {
            qos: 1, // At least once delivery
        };

        topics.forEach((topic) => {
            // Prevent duplicate subscriptions (important on reconnect)
            if (this.subscribedTopics.includes(topic)) {
                this.logger.debug(`Already subscribed to topic: ${topic}, skipping`, 'MqttService');
                return;
            }

            this.client!.subscribe(topic, options, (err, granted) => {
                if (err) {
                    this.logger.error(
                        `Failed to subscribe to topic: ${topic}`,
                        err.message,
                        'MqttService',
                    );
                    return;
                }

                this.subscribedTopics.push(topic);

                const qos = granted?.[0]?.qos ?? options.qos;

                this.logger.bootstrap(`Subscribed to topic: ${topic} (QoS: ${qos})`, 'MqttService');
            });
        });
    }

    private async handleIncomingMessage(topic: string, message: string) {
        const topicParts = topic.split('/');

        // Expected format: nurtura/rack/{deviceId}/{messageType}
        if (topicParts.length < 4 || topicParts[0] !== 'nurtura') {
            this.logger.warn(`Invalid topic format: ${topic}`, 'MqttService');
            return;
        }

        const deviceId = topicParts[2];
        const messageType = topicParts[3];

        this.logger.log(
            `Processing message from device: ${deviceId}, type: ${messageType}`,
            'MqttService',
        );

        switch (messageType) {
            case 'sensors':
                await this.handleSensorData(deviceId, message);
                break;
            case 'status':
                await this.handleDeviceStatus(deviceId, message);
                break;
            case 'errors':
                await this.handleDeviceError(deviceId, message);
                break;
            default:
                this.logger.warn(
                    `Unknown message type: ${messageType} from device: ${deviceId}`,
                    'MqttService',
                );
        }
    }

    private async handleSensorData(deviceId: string, payload: string) {
        try {
            const sensorData = await this.parseAndValidate<SensorDataDto>(
                payload,
                SensorDataDto,
                deviceId,
            );

            if (!sensorData) return;

            this.logger.log(
                `Sensor data from ${deviceId}: T=${sensorData.temperature}°C, H=${sensorData.humidity}%, M=${sensorData.moisture}%, L=${sensorData.lightLevel}lx`,
                'MqttService',
            );

            // Find rack by MAC address (deviceId is MAC address)
            const rack = await this.databaseService.rack.findUnique({
                where: { macAddress: deviceId },
            });

            if (!rack) {
                this.logger.warn(`Rack not found for device: ${deviceId}`, 'MqttService');
                return;
            }

            // Store in database
            const sensorReading = await this.databaseService.sensorReading.create({
                data: {
                    rackId: rack.id,
                    temperature: sensorData.temperature,
                    humidity: sensorData.humidity,
                    moisture: sensorData.moisture,
                    lightLevel: sensorData.lightLevel,
                    timestamp: sensorData.timestamp ? new Date(sensorData.timestamp) : new Date(),
                },
            });

            this.logger.log(`Saved sensor reading to database: ${sensorReading.id}`, 'MqttService');

            // Update rack's last seen timestamp
            await this.databaseService.rack.update({
                where: { id: rack.id },
                data: {
                    lastSeenAt: new Date(),
                    status: 'ONLINE',
                    lastActivityAt: new Date(),
                },
            });

            // Broadcast to WebSocket clients
            this.websocketGateway.broadcastSensorData(rack.id, sensorReading);

            // Check automation rules
            // await this.checkAutomationRules(rack.id, sensorReading);
        } catch (error) {
            this.logger.error(
                `Error handling sensor data from device: ${deviceId}`,
                error instanceof Error ? error.message : String(error),
                'MqttService',
            );
        }
    }

    private async handleDeviceStatus(deviceId: string, payload: string) {
        try {
            const deviceStatus = await this.parseAndValidate<DeviceStatusDto>(
                payload,
                DeviceStatusDto,
                deviceId,
            );

            if (!deviceStatus) return;

            this.logger.log(
                `Device status from ${deviceId}: ${JSON.stringify(status)}`,
                'MqttService',
            );

            const rack = await this.databaseService.rack.findUnique({
                where: { macAddress: deviceId },
            });

            if (!rack) return;

            // Update device status
            await this.databaseService.rack.update({
                where: { id: rack.id },
                data: {
                    status: deviceStatus.online ? 'ONLINE' : 'OFFLINE',
                    lastSeenAt: new Date(),
                },
            });

            // Log activity
            await this.databaseService.activity.create({
                data: {
                    rackId: rack.id,
                    eventType: deviceStatus.online ? 'DEVICE_ONLINE' : 'DEVICE_OFFLINE',
                    details: `Device ${deviceId} is ${deviceStatus.online ? 'online' : 'offline'}`,
                    metadata: deviceStatus as object,
                },
            });

            // Broadcast to WebSocket clients
            this.websocketGateway.broadcastDeviceStatus(rack.id, rack.status);
        } catch (error) {
            this.logger.error(
                `Error handling device status from: ${deviceId}`,
                error instanceof Error ? error.message : String(error),
                'MqttService',
            );
        }
    }

    private async handleDeviceError(deviceId: string, payload: string) {
        try {
            const deviceError = await this.parseAndValidate<DeviceErrorDto>(
                payload,
                DeviceErrorDto,
                deviceId,
            );

            if (!deviceError) return;

            this.logger.error(
                `Device error from ${deviceId}`,
                JSON.stringify(deviceError),
                'MqttService',
            );

            const rack = await this.databaseService.rack.findUnique({
                where: { macAddress: deviceId },
            });

            if (!rack) return;

            // Create notification for user
            const alert = await this.databaseService.notification.create({
                data: {
                    userId: rack.userId,
                    rackId: rack.id,
                    type: 'ALERT',
                    status: 'UNREAD',
                    title: `Device Error: ${deviceId}`,
                    message: deviceError.message || 'Unknown error occurred',
                    metadata: deviceError as object,
                },
            });

            // Broadcast to WebSocket clients
            this.websocketGateway.broadcastAlert(rack.id, alert);
        } catch (error) {
            this.logger.error(
                `Error handling device error from: ${deviceId}`,
                error instanceof Error ? error.message : String(error),
                'MqttService',
            );
        }
    }

    private async parseAndValidate<T>(
        payload: string,
        dtoClass: new () => T,
        deviceId: string,
    ): Promise<T | null> {
        try {
            const data = JSON.parse(payload) as object;
            const dtoObj = plainToInstance(dtoClass, data);
            const errors = await validate(dtoObj as object);

            if (errors.length > 0) {
                this.logger.warn(
                    `Validation failed for ${deviceId}: ${JSON.stringify(errors)}`,
                    'MqttService',
                );
                return null;
            }
            return dtoObj;
        } catch {
            this.logger.warn('Invalid JSON payload', 'MqttService');
            return null;
        }
    }

    // TODO - Rule-based automation
    /*
    private async checkAutomationRules(rackId: string, reading: any) {
        try {
            const rules = await this.databaseService.automationRule.findMany({
                where: {
                    rackId,
                    isEnabled: true,
                },
            });

            for (const rule of rules) {
                // Check cooldown
                if (rule.lastTriggeredAt && rule.cooldownMinutes) {
                    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
                    const timeSinceLastTrigger = Date.now() - rule.lastTriggeredAt.getTime();

                    if (timeSinceLastTrigger < cooldownMs) {
                        continue; // Still in cooldown period
                    }
                }

                // Evaluate conditions
                const conditions = rule.conditions as any;
                let shouldTrigger = true;

                if (
                    conditions.moisture?.lessThan &&
                    reading.moisture >= conditions.moisture.lessThan
                ) {
                    shouldTrigger = false;
                }
                if (
                    conditions.moisture?.greaterThan &&
                    reading.moisture <= conditions.moisture.greaterThan
                ) {
                    shouldTrigger = false;
                }
                if (
                    conditions.lightLevel?.lessThan &&
                    reading.lightLevel >= conditions.lightLevel.lessThan
                ) {
                    shouldTrigger = false;
                }

                if (shouldTrigger) {
                    await this.executeAutomationRule(rackId, rule);
                }
            }
        } catch (error) {
            this.logger.error(
                `Error checking automation rules for rack: ${rackId}`,
                error instanceof Error ? error.message : String(error),
                'MqttService',
            );
        }
    }

    private async executeAutomationRule(rackId: string, rule: any) {
        try {
            const actions = rule.actions;
            const rack = await this.databaseService.rack.findUnique({ where: { id: rackId } });

            if (!rack) return;

            this.logger.log(
                `Executing automation rule: ${rule.name} for rack: ${rackId}`,
                'MqttService',
            );

            // Execute actions
            if (actions.watering) {
                await this.publishCommand(rack.macAddress, 'watering', {
                    action: 'start',
                    duration: actions.watering.duration || 5000,
                });
            }

            if (actions.growLight) {
                await this.publishCommand(rack.macAddress, 'lighting', {
                    action: actions.growLight.action,
                });
            }

            // Update rule
            await this.databaseService.automationRule.update({
                where: { id: rule.id },
                data: {
                    lastTriggeredAt: new Date(),
                    triggerCount: { increment: 1 },
                },
            });

            // Log activity
            await this.databaseService.activity.create({
                data: {
                    rackId,
                    eventType: 'AUTOMATION_TRIGGERED',
                    details: `Rule "${rule.name}" triggered`,
                    metadata: { rule, actions },
                },
            });
        } catch (error) {
            this.logger.error(
                `Error executing automation rule: ${rule.name}`,
                error instanceof Error ? error.message : String(error),
                'MqttService',
            );
        }
    }

    // Public method to publish commands to ESP32
    async publishCommand(deviceId: string, commandType: string, command: any): Promise<void> {
        if (!this.client || !this.client.connected) {
            this.logger.error('Cannot publish: MQTT client not connected', '', 'MqttService');
            throw new Error('MQTT client not connected');
        }

        const topic = `nurtura/${deviceId}/commands/${commandType}`;
        const payload = JSON.stringify(command);

        return new Promise((resolve, reject) => {
            this.client!.publish(topic, payload, { qos: 1 }, (err) => {
                if (err) {
                    this.logger.error(
                        `Failed to publish command to ${topic}`,
                        err.message,
                        'MqttService',
                    );
                    reject(err);
                } else {
                    this.logger.log(`Published command to ${topic}: ${payload}`, 'MqttService');
                    resolve();
                }
            });
        });
    }
    */

    // Health check methods
    isConnected(): boolean {
        return this.client?.connected || false;
    }

    getSubscribedTopics(): string[] {
        return this.subscribedTopics;
    }

    getConnectionStatus(): {
        connected: boolean;
        reconnectAttempts: number;
        subscribedTopics: string[];
    } {
        return {
            connected: this.isConnected(),
            reconnectAttempts: this.reconnectAttempts,
            subscribedTopics: this.subscribedTopics,
        };
    }

    async onModuleDestroy() {
        this.logger.log('Closing MQTT connection...', 'MqttService');

        if (this.client) {
            await new Promise<void>((resolve) => {
                this.client!.end(false, {}, () => {
                    this.logger.log('MQTT connection closed gracefully', 'MqttService');
                    resolve();
                });
            });
        }
    }
}
