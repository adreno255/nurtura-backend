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

    // Create/Update User
    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            firebaseUid: 'Ft1S6yUjNlNk6wSroDcF1tLPdT33',
            email: 'neonimo123@gmail.com',
            firstName: 'Neo',
            middleName: 'Isaiah',
            lastName: 'Nimo',
            address: 'Block 5, Sampaguita Street, Barangay Commonwealth, Quezon City',
        },
    });

    console.log('✓ User created/updated');

    // Create/Update Rack
    const rack = await prisma.rack.upsert({
        where: { macAddress },
        update: {},
        create: {
            userId: user.id,
            name: 'My First Rack',
            macAddress: '00:1B:44:11:3A:B7',
        },
    });

    console.log('✓ Rack created/updated');

    // Clean up existing data
    await prisma.notification.deleteMany({ where: { rackId: rack.id } });
    await prisma.activity.deleteMany({ where: { rackId: rack.id } });
    await prisma.rackPlantHistory.deleteMany({ where: { rackId: rack.id } });
    await prisma.automationRule.deleteMany({});
    await prisma.aggregatedSensorReading.deleteMany({ where: { rackId: rack.id } });
    await prisma.sensorReading.deleteMany({ where: { rackId: rack.id } });
    await prisma.plant.deleteMany({});

    console.log('✓ Old data cleaned up');

    // ============================================
    // CREATE PLANTS WITH AUTOMATION RULES
    // ============================================

    // 1. LETTUCE
    const lettuce = await prisma.plant.create({
        data: {
            name: 'Lettuce',
            type: PlantType.LEAFY_GREENS,
            recommendedSoil: SoilType.LOAMY,
            description: 'Cool-season leafy green, ideal for salads',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: lettuce.id,
                name: 'Lettuce - Low Moisture Alert',
                description: 'Start watering when moisture drops below 60%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 60 },
                },
                actions: {
                    watering: { action: 'start', duration: 5000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 80%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 80 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - Temperature Too High',
                description: 'Alert when temperature exceeds 18°C',
                isEnabled: true,
                conditions: {
                    temperature: { greaterThan: 18 },
                },
                actions: {},
                cooldownMinutes: 120,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - Low Light',
                description: 'Turn on grow lights when light drops below 16,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 16000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Lettuce created with automation rules');

    // 2. MALABAR SPINACH
    const malabarSpinach = await prisma.plant.create({
        data: {
            name: 'Malabar Spinach',
            type: PlantType.TROPICAL_GREENS,
            recommendedSoil: SoilType.SILTY,
            description: 'Heat-loving tropical vine with edible leaves',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - Low Moisture',
                description: 'Start watering when moisture drops below 70%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 70 },
                },
                actions: {
                    watering: { action: 'start', duration: 7000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 90%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 90 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - Temperature Too Low',
                description: 'Alert when temperature drops below 24°C',
                isEnabled: true,
                conditions: {
                    temperature: { lessThan: 24 },
                },
                actions: {},
                cooldownMinutes: 120,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 80000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Malabar Spinach created with automation rules');

    // 3. BASIL
    const basil = await prisma.plant.create({
        data: {
            name: 'Basil',
            type: PlantType.HERBS,
            recommendedSoil: SoilType.PEATY,
            description: 'Aromatic herb, popular in Mediterranean cuisine',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: basil.id,
                name: 'Basil - Low Moisture',
                description: 'Start watering when moisture drops below 50%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 50 },
                },
                actions: {
                    watering: { action: 'start', duration: 4000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: basil.id,
                name: 'Basil - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 70 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: basil.id,
                name: 'Basil - Low Light',
                description: 'Turn on grow lights when light drops below 15,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 15000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Basil created with automation rules');

    // 4. OREGANO
    const oregano = await prisma.plant.create({
        data: {
            name: 'Oregano',
            type: PlantType.HERBS,
            recommendedSoil: SoilType.SANDY,
            description: 'Drought-tolerant Mediterranean herb',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: oregano.id,
                name: 'Oregano - Low Moisture',
                description: 'Start watering when moisture drops below 30%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 30 },
                },
                actions: {
                    watering: { action: 'start', duration: 3000 },
                },
                cooldownMinutes: 120,
            },
            {
                plantId: oregano.id,
                name: 'Oregano - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 50%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 50 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: oregano.id,
                name: 'Oregano - Low Light',
                description: 'Turn on grow lights when light drops below 32,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 32000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Oregano created with automation rules');

    // 5. ROSEMARY
    const rosemary = await prisma.plant.create({
        data: {
            name: 'Rosemary',
            type: PlantType.HERBS,
            recommendedSoil: SoilType.SANDY,
            description: 'Hardy evergreen herb with needle-like leaves',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: rosemary.id,
                name: 'Rosemary - Low Moisture',
                description: 'Start watering when moisture drops below 20%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 20 },
                },
                actions: {
                    watering: { action: 'start', duration: 3000 },
                },
                cooldownMinutes: 180,
            },
            {
                plantId: rosemary.id,
                name: 'Rosemary - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 40%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 40 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: rosemary.id,
                name: 'Rosemary - Low Light',
                description: 'Turn on grow lights when light drops below 30,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 30000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Rosemary created with automation rules');

    // 6. CILANTRO
    const cilantro = await prisma.plant.create({
        data: {
            name: 'Cilantro',
            type: PlantType.ROOT_AND_STALK,
            recommendedSoil: SoilType.LOAMY,
            description: 'Fast-growing herb with distinctive flavor',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: cilantro.id,
                name: 'Cilantro - Low Moisture',
                description: 'Start watering when moisture drops below 50%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 50 },
                },
                actions: {
                    watering: { action: 'start', duration: 4000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: cilantro.id,
                name: 'Cilantro - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 70 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: cilantro.id,
                name: 'Cilantro - Low Light',
                description: 'Turn on grow lights when light drops below 32,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 32000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Cilantro created with automation rules');

    // 7. CELERY
    const celery = await prisma.plant.create({
        data: {
            name: 'Celery',
            type: PlantType.ROOT_AND_STALK,
            recommendedSoil: SoilType.LOAMY,
            description: 'Moisture-loving vegetable with crunchy stalks',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: celery.id,
                name: 'Celery - Low Moisture',
                description: 'Start watering when moisture drops below 70%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 70 },
                },
                actions: {
                    watering: { action: 'start', duration: 6000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: celery.id,
                name: 'Celery - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 90%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 90 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: celery.id,
                name: 'Celery - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 80000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Celery created with automation rules');

    // 8. PARSLEY
    const parsley = await prisma.plant.create({
        data: {
            name: 'Parsley',
            type: PlantType.ROOT_AND_STALK,
            recommendedSoil: SoilType.LOAMY,
            description: 'Biennial herb, popular garnish and ingredient',
            isActive: true,
        },
    });

    await prisma.automationRule.createMany({
        data: [
            {
                plantId: parsley.id,
                name: 'Parsley - Low Moisture',
                description: 'Start watering when moisture drops below 50%',
                isEnabled: true,
                conditions: {
                    moisture: { lessThan: 50 },
                },
                actions: {
                    watering: { action: 'start', duration: 5000 },
                },
                cooldownMinutes: 60,
            },
            {
                plantId: parsley.id,
                name: 'Parsley - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: {
                    moisture: { greaterThan: 70 },
                },
                actions: {
                    watering: { action: 'stop' },
                },
                cooldownMinutes: 30,
            },
            {
                plantId: parsley.id,
                name: 'Parsley - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: {
                    lightLevel: { lessThan: 80000 },
                },
                actions: {
                    growLight: { action: 'on' },
                },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Parsley created with automation rules');

    // ============================================
    // PLANT LETTUCE IN THE RACK (Example)
    // ============================================

    await prisma.rack.update({
        where: { id: rack.id },
        data: {
            currentPlantId: lettuce.id,
            quantity: 10,
            plantedAt: new Date(),
        },
    });

    console.log('✓ Lettuce planted in rack');

    // ============================================
    // CREATE SENSOR READINGS
    // ============================================

    await prisma.sensorReading.createMany({
        data: [
            {
                rackId: rack.id,
                temperature: 15.5,
                humidity: 60.2,
                moisture: 65.1,
                lightLevel: 20000,
            },
            {
                rackId: rack.id,
                temperature: 14.0,
                humidity: 58.0,
                moisture: 62.0,
                lightLevel: 18000,
            },
            {
                rackId: rack.id,
                temperature: 16.3,
                humidity: 62.5,
                moisture: 68.2,
                lightLevel: 22000,
            },
        ],
    });

    console.log('✓ Sensor readings created');

    // ============================================
    // CREATE AGGREGATED SENSOR READINGS
    // ============================================

    await prisma.aggregatedSensorReading.createMany({
        data: [
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T08:00:00.000Z'),
                avgTemperature: 15.5,
                avgHumidity: 60.2,
                avgMoisture: 65.1,
                avgLightLevel: 20000,
                minTemperature: 14.0,
                maxTemperature: 16.3,
                minMoisture: 62.0,
                maxMoisture: 68.2,
                readingCount: 3,
            },
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T09:00:00.000Z'),
                avgTemperature: 14.8,
                avgHumidity: 59.0,
                avgMoisture: 64.0,
                avgLightLevel: 19000,
                minTemperature: 13.5,
                maxTemperature: 15.8,
                minMoisture: 61.0,
                maxMoisture: 67.0,
                readingCount: 3,
            },
            {
                rackId: rack.id,
                hour: new Date('2026-01-01T10:00:00.000Z'),
                avgTemperature: 16.2,
                avgHumidity: 61.5,
                avgMoisture: 66.5,
                avgLightLevel: 21000,
                minTemperature: 15.0,
                maxTemperature: 17.2,
                minMoisture: 64.0,
                maxMoisture: 69.0,
                readingCount: 3,
            },
        ],
        skipDuplicates: true,
    });

    console.log('✓ Aggregated sensor readings created');

    // ============================================
    // CREATE ACTIVITIES
    // ============================================

    await prisma.activity.createMany({
        data: [
            {
                rackId: rack.id,
                eventType: ActivityEventType.PLANT_ADDED,
                details: 'Planted 10x Lettuce',
                metadata: { plantId: lettuce.id, quantity: 10 },
            },
            {
                rackId: rack.id,
                eventType: ActivityEventType.WATERING_ON,
                details: 'Watering started - Moisture below threshold',
                metadata: { triggeredBy: 'Automation Rule: Lettuce - Low Moisture Alert' },
            },
            {
                rackId: rack.id,
                eventType: ActivityEventType.DEVICE_ONLINE,
                details: 'Device came online',
                metadata: { device: 'ESP32 Sensor Unit' },
            },
            {
                rackId: rack.id,
                eventType: ActivityEventType.AUTOMATION_TRIGGERED,
                details: 'Automation rule triggered: Low Light',
                metadata: { rule: 'Lettuce - Low Light', action: 'Grow light turned on' },
            },
        ],
    });

    console.log('✓ Activities created');

    // ============================================
    // CREATE NOTIFICATIONS
    // ============================================

    await prisma.notification.createMany({
        data: [
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.SUCCESS,
                status: NotificationStatus.UNREAD,
                title: 'Lettuce Planted',
                message: 'Successfully planted 10 Lettuce plants in My First Rack',
                metadata: { plantId: lettuce.id, quantity: 10 },
            },
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.INFO,
                status: NotificationStatus.UNREAD,
                title: 'Automation Active',
                message: 'Watering automation triggered - Moisture was below 60%',
                metadata: { rule: 'Lettuce - Low Moisture Alert' },
            },
            {
                userId: user.id,
                rackId: rack.id,
                type: NotificationType.ALERT,
                status: NotificationStatus.UNREAD,
                title: 'Light Level Low',
                message: 'Grow lights turned on automatically - Light was below 16,000 lux',
                metadata: { rule: 'Lettuce - Low Light' },
            },
        ],
    });

    console.log('✓ Notifications created');

    // ============================================
    // SUMMARY
    // ============================================

    const plantCount = await prisma.plant.count();
    const ruleCount = await prisma.automationRule.count();

    console.log('\n Seed completed successfully!');
    console.log(`   - ${plantCount} plants created`);
    console.log(`   - ${ruleCount} automation rules created`);
    console.log(`   - 1 rack with Lettuce planted`);
    console.log(`   - Sample sensor readings, activities, and notifications added`);
}

main()
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
