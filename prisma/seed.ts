import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    ActivityEventType,
    NotificationStatus,
    NotificationType,
    PlantType,
    PrismaClient,
    SoilType,
} from './../src/generated/prisma/client';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = 'neonimo123@gmail.com';
    const macAddress = '00:1B:44:11:3A:B7';

    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            firebaseUid: 'gnp8GZuJTBVSMH7vITeaXj0GmJO2',
            email: 'neonimo123@gmail.com',
            firstName: 'Neo',
            middleName: 'Isaiah',
            lastName: 'Nimo',
            address: 'Block 5, Sampaguita Street, Barangay Commonwealth, Quezon City',
        },
    });

    const rack = await prisma.rack.upsert({
        where: { macAddress },
        update: {},
        create: {
            userId: user.id,
            name: 'My First Rack',
            macAddress: '00:1B:44:11:3A:B7',
        },
    });

    await prisma.notification.deleteMany({ where: { rackId: rack.id } });
    await prisma.activity.deleteMany({ where: { rackId: rack.id } });
    await prisma.automationRule.deleteMany({ where: { rackId: rack.id } });
    await prisma.aggregatedSensorReading.deleteMany({ where: { rackId: rack.id } });
    await prisma.sensorReading.deleteMany({ where: { rackId: rack.id } });
    await prisma.plant.deleteMany({ where: { rackId: rack.id } });

    await prisma.plant.createMany({
        data: [
            {
                rackId: rack.id,
                name: 'Lettuce',
                type: PlantType.LEAFY_GREENS,
                quantity: 10,
                recommendedSoil: SoilType.LOAMY,
            },
            {
                rackId: rack.id,
                name: 'Basil',
                type: PlantType.HERBS,
                quantity: 5,
                recommendedSoil: SoilType.PEATY,
            },
            {
                rackId: rack.id,
                name: 'Malabar Spinach',
                type: PlantType.TROPICAL_GREENS,
                quantity: 8,
                recommendedSoil: SoilType.SILTY,
            },
        ],
    });

    await prisma.sensorReading.createMany({
        data: [
            {
                rackId: rack.id,
                temperature: 24.5,
                humidity: 60.2,
                moisture: 40.1,
                lightLevel: 300,
            },
            {
                rackId: rack.id,
                temperature: 22.0,
                humidity: 55.0,
                moisture: 35.0,
                lightLevel: 250,
            },
            {
                rackId: rack.id,
                temperature: 26.3,
                humidity: 65.5,
                moisture: 45.2,
                lightLevel: 320,
            },
        ],
    });

    await prisma.aggregatedSensorReading.createMany({
        data: [
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T08:00:00.000Z'),
                avgTemperature: 24.5,
                avgHumidity: 60.2,
                avgMoisture: 40.1,
                avgLightLevel: 300,
                minTemperature: 22.0,
                maxTemperature: 26.3,
                minMoisture: 35.0,
                maxMoisture: 45.2,
                readingCount: 3,
            },
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T09:00:00.000Z'),
                avgTemperature: 22.0,
                avgHumidity: 55.0,
                avgMoisture: 35.0,
                avgLightLevel: 250,
                minTemperature: 21.5,
                maxTemperature: 23.0,
                minMoisture: 33.0,
                maxMoisture: 37.0,
                readingCount: 3,
            },
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T10:00:00.000Z'),
                avgTemperature: 26.3,
                avgHumidity: 65.5,
                avgMoisture: 45.2,
                avgLightLevel: 320,
                minTemperature: 25.0,
                maxTemperature: 27.5,
                minMoisture: 44.0,
                maxMoisture: 46.0,
                readingCount: 3,
            },
        ],
        skipDuplicates: true,
    });

    await prisma.automationRule.createMany({
        data: [
            {
                rackId: rack.id,
                name: 'Watering Rule',
                description: 'Auto-waters when moisture < 40%',
                isEnabled: true,
                conditions: { moisture: { lt: 40 } },
                actions: { water: true },
                cooldownMinutes: 30,
            },
            {
                rackId: rack.id,
                name: 'Lighting Rule',
                description: 'Turns on light if light level < 200',
                isEnabled: true,
                conditions: { lightLevel: { lt: 200 } },
                actions: { light: 'on' },
                cooldownMinutes: 60,
            },
            {
                rackId: rack.id,
                name: 'Humidity Alert',
                description: 'Alerts if humidity > 70%',
                isEnabled: true,
                conditions: { humidity: { gt: 70 } },
                actions: { alert: true },
                cooldownMinutes: 15,
            },
        ],
    });

    await prisma.activity.createMany({
        data: [
            {
                rackId: rack.id,
                eventType: ActivityEventType.WATERING_ON,
                details: 'Watering started on rack 1',
                metadata: { wateredBy: 'Automation Rule' },
            },
            {
                rackId: rack.id,
                eventType: ActivityEventType.DEVICE_OFFLINE,
                details: 'Device offline detected',
                metadata: { device: 'Sensor 1' },
            },
            {
                rackId: rack.id,
                eventType: ActivityEventType.AUTOMATION_TRIGGERED,
                details: 'Automation rule triggered',
                metadata: { rule: 'Humidity Alert' },
            },
        ],
    });

    await prisma.notification.createMany({
        data: [
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.INFO,
                status: NotificationStatus.UNREAD,
                title: 'Rack Update',
                message: 'Rack seed notification 1',
                metadata: { rackId: rack.id },
            },
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.ALERT,
                status: NotificationStatus.UNREAD,
                title: 'Plant Update',
                message: 'Rack seed notification 2',
                metadata: { rackId: rack.id, plant: 'Basil' },
            },
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.WARNING,
                status: NotificationStatus.UNREAD,
                title: 'Automation Update',
                message: 'Rack seed notification 3',
                metadata: { rackId: rack.id, rule: 'Humidity Alert' },
            },
        ],
    });

    console.log('Seed completed.');
}

main()
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
