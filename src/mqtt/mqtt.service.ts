import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient, IClientSubscribeOptions } from 'mqtt';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { SensorsService } from '../sensors/sensors.service';
import { RacksService } from '../racks/racks.service';
import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
    private client: MqttClient | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private subscribedTopics: string[] = [];

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: MyLoggerService,
        private readonly sensorsService: SensorsService,
        private readonly racksService: RacksService,
    ) {}

    async onModuleInit() {
        await this.connectToMqttBroker();
    }

    // ==================== Connection Management ====================

    private connectToMqttBroker(): Promise<void> {
        return new Promise((resolve, reject) => {
            const host = this.configService.get<string>('MQTT_HOST');
            const port = this.configService.get<number>('MQTT_PORT', 8883);
            const username = this.configService.get<string>('MQTT_USERNAME');
            const password = this.configService.get<string>('MQTT_PASSWORD');

            if (!host || !username || !password) {
                this.logger.error('MQTT credentials not configured', '', 'MqttService');
                reject(new Error('MQTT configuration is incomplete. Check environment variables.'));
                return;
            }

            const mqttUrl = `mqtts://${host}:${port}`;
            const clientId = `nurtura-backend-${Math.random().toString(16).slice(2, 8)}`;

            this.logger.bootstrap(`Connecting to MQTT broker: ${mqttUrl}`, 'MqttService');

            this.client = mqtt.connect(mqttUrl, {
                username,
                password,
                clientId,
                rejectUnauthorized: true,
                reconnectPeriod: 5000,
                connectTimeout: 30000,
                keepalive: 60,
                clean: true,
            });

            // Setup one-time listeners for initial connection
            const onConnect = () => {
                cleanup();
                this.logger.bootstrap('Connected to MQTT broker', 'MqttService');
                resolve();
            };

            const onError = (err: Error) => {
                cleanup();
                this.logger.error('Failed to connect to MQTT broker', err.message, 'MqttService');
                reject(err);
            };

            const cleanup = () => {
                this.client?.removeListener('connect', onConnect);
                this.client?.removeListener('error', onError);
            };

            this.client.once('connect', onConnect);
            this.client.once('error', onError);

            this.setupEventHandlers();
        });
    }

    private setupEventHandlers() {
        if (!this.client) return;

        // Connection established
        this.client.on('connect', () => {
            this.reconnectAttempts = 0;
            this.logger.log('MQTT client connected', 'MqttService');
            this.subscribeToTopics();
        });

        // Message received - Route to appropriate service
        this.client.on('message', (topic, payload) => {
            const message = payload.toString();
            this.logger.log(`Message received on topic: ${topic}`, 'MqttService');

            this.routeMessage(topic, message).catch((error) => {
                this.logger.error(
                    `Error routing message from topic: ${topic}`,
                    error instanceof Error ? error.message : String(error),
                    'MqttService',
                );
            });
        });

        // Packet received (debugging in development)
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
            'nurtura/rack/+/sensors', // Sensor data from devices
            'nurtura/rack/+/status', // Device status updates
            'nurtura/rack/+/errors', // Error messages from devices
        ];

        const options: IClientSubscribeOptions = {
            qos: 1, // At least once delivery
        };

        topics.forEach((topic) => {
            // Prevent duplicate subscriptions on reconnect
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

    // ==================== Message Routing ====================

    private async routeMessage(topic: string, message: string) {
        const macAddress = MqttMessageParser.extractMacAddress(topic);

        const messageType = MqttMessageParser.extractMessageType(topic);

        if (!macAddress || !messageType) {
            this.logger.warn(
                `Invalid topic format, cannot extract MAC address or message type in: ${topic}`,
                'MqttService',
            );

            throw new Error('Invalid topic format');
        }

        this.logger.log(
            `Routing message from device: ${macAddress}, type: ${messageType}`,
            'MqttService',
        );

        // Route to appropriate service based on message type
        switch (messageType) {
            case 'sensors':
                await this.sensorsService.processSensorData(macAddress, message);
                break;
            case 'status':
                await this.racksService.processDeviceStatus(macAddress, message);
                break;
            case 'errors':
                await this.racksService.processDeviceError(macAddress, message);
                break;
            default:
                this.logger.warn(
                    `Unknown message type: ${messageType} from device: ${macAddress}`,
                    'MqttService',
                );
        }
    }

    // ==================== Outbound Commands ====================

    /**
     * Publish a command to a device
     * Called by: AutomationService, RacksService (manual control)
     */
    async publishCommand(
        macAddress: string,
        commandType: 'watering' | 'lighting' | 'sensors',
        payload: object,
    ): Promise<void> {
        if (!this.client || !this.client.connected) {
            this.logger.error('Cannot publish: MQTT client not connected', '', 'MqttService');
            throw new Error('MQTT client not connected');
        }

        const topic = MqttMessageParser.generateCommandTopic(macAddress, commandType);
        const message = JSON.stringify(payload);

        return new Promise((resolve, reject) => {
            this.client!.publish(topic, message, { qos: 1 }, (err) => {
                if (err) {
                    this.logger.error(
                        `Failed to publish command to ${topic}`,
                        err.message,
                        'MqttService',
                    );
                    reject(err);
                } else {
                    this.logger.log(`Published command to ${topic}: ${message}`, 'MqttService');
                    resolve();
                }
            });
        });
    }

    // ==================== Health Check ====================

    isConnected(): boolean {
        return this.client?.connected || false;
    }

    getSubscribedTopics(): string[] {
        return [...this.subscribedTopics];
    }

    getConnectionStatus(): {
        connected: boolean;
        reconnectAttempts: number;
        subscribedTopics: string[];
    } {
        return {
            connected: this.isConnected(),
            reconnectAttempts: this.reconnectAttempts,
            subscribedTopics: this.getSubscribedTopics(),
        };
    }

    // ==================== Lifecycle ====================

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
