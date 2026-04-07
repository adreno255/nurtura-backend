import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    ActivityEventType,
    NotificationStatus,
    NotificationType,
    PlantCategory,
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
    const macAddress2 = '00:1B:44:11:3A:B8';
    const macAddress3 = '00:1B:44:11:3A:B9';

    // ============================================
    // USER
    // ============================================

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

    // ============================================
    // RACKS
    // ============================================

    const rack = await prisma.rack.upsert({
        where: { macAddress },
        update: {},
        create: {
            userId: user.id,
            name: 'My First Rack',
            macAddress,
            mqttTopic: 'nurtura/rack/00-1b-44-11-3a-b7',
        },
    });

    const rack2 = await prisma.rack.upsert({
        where: { macAddress: macAddress2 },
        update: {},
        create: {
            userId: user.id,
            name: 'Kitchen Herb Rack',
            macAddress: macAddress2,
            mqttTopic: 'nurtura/rack/00-1b-44-11-3a-b8',
            description: 'Dedicated rack for growing herbs in the kitchen',
        },
    });

    const rack3 = await prisma.rack.upsert({
        where: { macAddress: macAddress3 },
        update: {},
        create: {
            userId: user.id,
            name: 'Balcony Rack',
            macAddress: macAddress3,
            mqttTopic: 'nurtura/rack/00-1b-44-11-3a-b9',
            description: 'Empty rack on the balcony, ready for planting',
        },
    });

    console.log('✓ Racks created/updated');

    // ============================================
    // CLEAN UP
    // ============================================

    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.activity.deleteMany({
        where: { rackId: { in: [rack.id, rack2.id, rack3.id] } },
    });
    await prisma.rackPlantingHistory.deleteMany({
        where: { rackId: { in: [rack.id, rack2.id, rack3.id] } },
    });
    await prisma.automationRule.deleteMany({});
    await prisma.aggregatedSensorReading.deleteMany({
        where: { rackId: { in: [rack.id, rack2.id, rack3.id] } },
    });
    await prisma.sensorReading.deleteMany({
        where: { rackId: { in: [rack.id, rack2.id, rack3.id] } },
    });
    await prisma.plant.deleteMany({});

    console.log('✓ Old data cleaned up');

    // ============================================
    // PLANTS WITH AUTOMATION RULES
    // ============================================

    const lettuce = await prisma.plant.create({
        data: {
            name: 'Lettuce',
            category: PlantCategory.LEAFY_GREENS,
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
                conditions: { moisture: { lessThan: 60 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 80%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 80 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - Temperature Too High',
                description: 'Alert when temperature exceeds 18°C',
                isEnabled: true,
                conditions: { temperature: { greaterThan: 18 } },
                actions: {},
                cooldownMinutes: 120,
            },
            {
                plantId: lettuce.id,
                name: 'Lettuce - Low Light',
                description: 'Turn on grow lights when light drops below 16,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 16000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Lettuce created with automation rules');

    const malabarSpinach = await prisma.plant.create({
        data: {
            name: 'Malabar Spinach',
            category: PlantCategory.TROPICAL_GREENS,
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
                conditions: { moisture: { lessThan: 70 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 90%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 90 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - Temperature Too Low',
                description: 'Alert when temperature drops below 24°C',
                isEnabled: true,
                conditions: { temperature: { lessThan: 24 } },
                actions: {},
                cooldownMinutes: 120,
            },
            {
                plantId: malabarSpinach.id,
                name: 'Malabar Spinach - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 80000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Malabar Spinach created with automation rules');

    const basil = await prisma.plant.create({
        data: {
            name: 'Basil',
            category: PlantCategory.HERBS,
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
                conditions: { moisture: { lessThan: 50 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: basil.id,
                name: 'Basil - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 70 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: basil.id,
                name: 'Basil - Low Light',
                description: 'Turn on grow lights when light drops below 15,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 15000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Basil created with automation rules');

    const oregano = await prisma.plant.create({
        data: {
            name: 'Oregano',
            category: PlantCategory.HERBS,
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
                conditions: { moisture: { lessThan: 30 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 120,
            },
            {
                plantId: oregano.id,
                name: 'Oregano - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 50%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 50 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: oregano.id,
                name: 'Oregano - Low Light',
                description: 'Turn on grow lights when light drops below 32,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 32000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Oregano created with automation rules');

    const rosemary = await prisma.plant.create({
        data: {
            name: 'Rosemary',
            category: PlantCategory.HERBS,
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
                conditions: { moisture: { lessThan: 20 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 180,
            },
            {
                plantId: rosemary.id,
                name: 'Rosemary - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 40%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 40 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: rosemary.id,
                name: 'Rosemary - Low Light',
                description: 'Turn on grow lights when light drops below 30,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 30000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Rosemary created with automation rules');

    const cilantro = await prisma.plant.create({
        data: {
            name: 'Cilantro',
            category: PlantCategory.ROOT_AND_STALK,
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
                conditions: { moisture: { lessThan: 50 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: cilantro.id,
                name: 'Cilantro - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 70 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: cilantro.id,
                name: 'Cilantro - Low Light',
                description: 'Turn on grow lights when light drops below 32,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 32000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Cilantro created with automation rules');

    const celery = await prisma.plant.create({
        data: {
            name: 'Celery',
            category: PlantCategory.ROOT_AND_STALK,
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
                conditions: { moisture: { lessThan: 70 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: celery.id,
                name: 'Celery - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 90%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 90 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: celery.id,
                name: 'Celery - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 80000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Celery created with automation rules');

    const parsley = await prisma.plant.create({
        data: {
            name: 'Parsley',
            category: PlantCategory.ROOT_AND_STALK,
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
                conditions: { moisture: { lessThan: 50 } },
                actions: { watering: { action: 'watering_start' } },
                cooldownMinutes: 60,
            },
            {
                plantId: parsley.id,
                name: 'Parsley - High Moisture Stop',
                description: 'Stop watering when moisture exceeds 70%',
                isEnabled: true,
                conditions: { moisture: { greaterThan: 70 } },
                actions: { watering: { action: 'watering_stop' } },
                cooldownMinutes: 30,
            },
            {
                plantId: parsley.id,
                name: 'Parsley - Low Light',
                description: 'Turn on grow lights when light drops below 80,000 lux',
                isEnabled: true,
                conditions: { lightLevel: { lessThan: 80000 } },
                actions: { growLight: { action: 'light_on' } },
                cooldownMinutes: 30,
            },
        ],
    });

    console.log('✓ Parsley created with automation rules');

    // ============================================
    // RACK 1 — Lettuce planted, with history
    // ============================================

    const rack1PlantedAt = new Date('2026-01-10T08:00:00.000Z');
    const rack1HarvestedAt = new Date('2026-02-10T08:00:00.000Z');
    const rack1ReplantedAt = new Date('2026-02-15T08:00:00.000Z');

    await prisma.rack.update({
        where: { id: rack.id },
        data: {
            currentPlantId: lettuce.id,
            quantity: 10,
            plantedAt: rack1ReplantedAt,
            harvestCount: 1,
            lastHarvestAt: rack1HarvestedAt,
            lastActivityAt: rack1ReplantedAt,
            status: 'ONLINE',
        },
    });

    // History: first cycle harvested, second cycle active
    await prisma.rackPlantingHistory.createMany({
        data: [
            {
                rackId: rack.id,
                plantId: lettuce.id,
                quantity: 10,
                plantedAt: rack1PlantedAt,
                harvestedAt: rack1HarvestedAt,
                harvestCount: 1,
            },
            {
                rackId: rack.id,
                plantId: lettuce.id,
                quantity: 10,
                plantedAt: rack1ReplantedAt,
                harvestedAt: null,
                harvestCount: 0,
            },
        ],
    });

    await prisma.activity.createMany({
        data: [
            // Rack registered
            {
                rackId: rack.id,
                eventType: ActivityEventType.RACK_ADDED,
                details: `Rack "${rack.name}" registered`,
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    userId: user.id,
                },
                timestamp: new Date('2026-01-09T08:00:00.000Z'),
            },
            // First planting
            {
                rackId: rack.id,
                eventType: ActivityEventType.PLANT_ADDED,
                details: `Plant "Lettuce" added to rack`,
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId: lettuce.id,
                    plantName: 'Lettuce',
                    quantity: 10,
                    plantedAt: rack1PlantedAt.toISOString(),
                },
                timestamp: rack1PlantedAt,
            },
            // Watering on — automation
            {
                rackId: rack.id,
                eventType: ActivityEventType.WATERING_START,
                details:
                    'Watering start triggered by automation rule "Lettuce - Low Moisture Alert"',
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    source: 'automation',
                    ruleId: 'rule-lettuce-low-moisture',
                    ruleName: 'Lettuce - Low Moisture Alert',
                },
                timestamp: new Date('2026-01-15T10:00:00.000Z'),
            },
            // Watering off — automation
            {
                rackId: rack.id,
                eventType: ActivityEventType.WATERING_STOP,
                details:
                    'Watering stop triggered by automation rule "Lettuce - High Moisture Stop"',
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    source: 'automation',
                    ruleId: 'rule-lettuce-high-moisture',
                    ruleName: 'Lettuce - High Moisture Stop',
                },
                timestamp: new Date('2026-01-15T10:05:00.000Z'),
            },
            // Light on — automation
            {
                rackId: rack.id,
                eventType: ActivityEventType.LIGHT_ON,
                details: 'Grow light on triggered by automation rule "Lettuce - Low Light"',
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    source: 'automation',
                    ruleId: 'rule-lettuce-low-light',
                    ruleName: 'Lettuce - Low Light',
                },
                timestamp: new Date('2026-01-20T06:00:00.000Z'),
            },
            // Light off — automation
            {
                rackId: rack.id,
                eventType: ActivityEventType.LIGHT_OFF,
                details: 'Grow light off triggered by automation rule "Lettuce - Low Light"',
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    source: 'automation',
                    ruleId: 'rule-lettuce-low-light',
                    ruleName: 'Lettuce - Low Light',
                },
                timestamp: new Date('2026-01-20T18:00:00.000Z'),
            },
            // Harvest
            {
                rackId: rack.id,
                eventType: ActivityEventType.PLANT_HARVESTED,
                details: `Plant "Lettuce" harvested from rack`,
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId: lettuce.id,
                    plantName: 'Lettuce',
                    harvestCount: 1,
                    quantity: 10,
                    harvestedAt: rack1HarvestedAt.toISOString(),
                },
                timestamp: rack1HarvestedAt,
            },
            // Replant after harvest
            {
                rackId: rack.id,
                eventType: ActivityEventType.PLANT_ADDED,
                details: `Plant "Lettuce" added to rack`,
                metadata: {
                    rackName: rack.name,
                    macAddress: rack.macAddress,
                    plantId: lettuce.id,
                    plantName: 'Lettuce',
                    quantity: 10,
                    plantedAt: rack1ReplantedAt.toISOString(),
                },
                timestamp: rack1ReplantedAt,
            },
        ],
    });

    console.log('✓ Rack 1 (Lettuce) activities and history created');

    // ============================================
    // RACK 2 — Basil planted, with crop rotation
    // ============================================

    const rack2FirstPlantedAt = new Date('2026-01-05T08:00:00.000Z');
    const rack2ChangedAt = new Date('2026-02-01T08:00:00.000Z');

    await prisma.rack.update({
        where: { id: rack2.id },
        data: {
            currentPlantId: basil.id,
            quantity: 8,
            plantedAt: rack2ChangedAt,
            harvestCount: 0,
            lastActivityAt: rack2ChangedAt,
            status: 'ONLINE',
        },
    });

    // History: oregano removed (crop rotation), basil active
    await prisma.rackPlantingHistory.createMany({
        data: [
            {
                rackId: rack2.id,
                plantId: oregano.id,
                quantity: 6,
                plantedAt: rack2FirstPlantedAt,
                harvestedAt: null, // removed, not harvested
                harvestCount: 0,
            },
            {
                rackId: rack2.id,
                plantId: basil.id,
                quantity: 8,
                plantedAt: rack2ChangedAt,
                harvestedAt: null,
                harvestCount: 0,
            },
        ],
    });

    await prisma.activity.createMany({
        data: [
            // Rack registered
            {
                rackId: rack2.id,
                eventType: ActivityEventType.RACK_ADDED,
                details: `Rack "${rack2.name}" registered`,
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    userId: user.id,
                },
                timestamp: new Date('2026-01-04T08:00:00.000Z'),
            },
            // Oregano planted
            {
                rackId: rack2.id,
                eventType: ActivityEventType.PLANT_ADDED,
                details: `Plant "Oregano" added to rack`,
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    plantId: oregano.id,
                    plantName: 'Oregano',
                    quantity: 6,
                    plantedAt: rack2FirstPlantedAt.toISOString(),
                },
                timestamp: rack2FirstPlantedAt,
            },
            // Crop rotation — oregano removed
            {
                rackId: rack2.id,
                eventType: ActivityEventType.PLANT_REMOVED,
                details: 'Plant removed from rack (replaced during crop rotation)',
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    removedPlantId: oregano.id,
                    removedPlantName: 'Oregano',
                    replacedByPlantId: basil.id,
                    replacedByPlantName: 'Basil',
                },
                timestamp: rack2ChangedAt,
            },
            // Crop rotation — basil assigned
            {
                rackId: rack2.id,
                eventType: ActivityEventType.PLANT_CHANGED,
                details: `Plant changed from previous to "Basil"`,
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    previousPlantId: oregano.id,
                    previousPlantName: 'Oregano',
                    newPlantId: basil.id,
                    newPlantName: 'Basil',
                    quantity: 8,
                },
                timestamp: rack2ChangedAt,
            },
            // Watering on
            {
                rackId: rack2.id,
                eventType: ActivityEventType.WATERING_START,
                details: 'Watering start triggered by automation rule "Basil - Low Moisture"',
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    source: 'automation',
                    ruleId: 'rule-basil-low-moisture',
                    ruleName: 'Basil - Low Moisture',
                },
                timestamp: new Date('2026-02-10T09:00:00.000Z'),
            },
            // Watering off
            {
                rackId: rack2.id,
                eventType: ActivityEventType.WATERING_STOP,
                details: 'Watering stop triggered by automation rule "Basil - High Moisture Stop"',
                metadata: {
                    rackName: rack2.name,
                    macAddress: rack2.macAddress,
                    source: 'automation',
                    ruleId: 'rule-basil-high-moisture',
                    ruleName: 'Basil - High Moisture Stop',
                },
                timestamp: new Date('2026-02-10T09:04:00.000Z'),
            },
        ],
    });

    console.log('✓ Rack 2 (Basil, crop rotation from Oregano) activities and history created');

    // ============================================
    // RACK 3 — Empty, only rack-level activity
    // ============================================

    await prisma.rack.update({
        where: { id: rack3.id },
        data: {
            currentPlantId: null,
            quantity: 0,
            plantedAt: null,
            status: 'OFFLINE',
            lastActivityAt: new Date('2026-03-01T08:00:00.000Z'),
        },
    });

    await prisma.activity.createMany({
        data: [
            {
                rackId: rack3.id,
                eventType: ActivityEventType.RACK_ADDED,
                details: `Rack "${rack3.name}" registered`,
                metadata: {
                    rackName: rack3.name,
                    macAddress: rack3.macAddress,
                    userId: user.id,
                },
                timestamp: new Date('2026-03-01T08:00:00.000Z'),
            },
        ],
    });

    console.log('✓ Rack 3 (empty) activity created');

    // ============================================
    // SENSOR READINGS (Rack 1 and Rack 2)
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
            {
                rackId: rack2.id,
                temperature: 22.1,
                humidity: 55.0,
                moisture: 52.3,
                lightLevel: 14000,
            },
            {
                rackId: rack2.id,
                temperature: 23.4,
                humidity: 57.0,
                moisture: 48.0,
                lightLevel: 13000,
            },
        ],
    });

    console.log('✓ Sensor readings created');

    // ============================================
    // AGGREGATED SENSOR READINGS (Rack 1 and Rack 2)
    // ============================================

    await prisma.aggregatedSensorReading.createMany({
        data: [
            {
                rackId: rack.id,
                hour: new Date('2026-01-15T08:00:00.000Z'),
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
                hour: new Date('2026-01-15T09:00:00.000Z'),
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
                rackId: rack2.id,
                hour: new Date('2026-02-10T09:00:00.000Z'),
                avgTemperature: 22.8,
                avgHumidity: 56.0,
                avgMoisture: 50.2,
                avgLightLevel: 13500,
                minTemperature: 22.1,
                maxTemperature: 23.4,
                minMoisture: 48.0,
                maxMoisture: 52.3,
                readingCount: 2,
            },
        ],
        skipDuplicates: true,
    });

    console.log('✓ Aggregated sensor readings created');

    // ============================================
    // NOTIFICATIONS
    // ============================================

    await prisma.notification.createMany({
        data: [
            {
                userId: user.id,
                rackId: rack3.id,
                type: NotificationType.ERROR,
                status: NotificationStatus.UNREAD,
                title: 'Rack Disconnected',
                message: 'Balcony Rack has been disconnected.',
                metadata: {
                    screen: `/(tabs)/(racks)/${rack3.id}`,
                    rackId: rack3.id,
                    rackName: rack3.name,
                    macAddress: rack3.macAddress,
                },
            },
            {
                userId: user.id,
                rackId: rack3.id,
                type: NotificationType.ERROR,
                status: NotificationStatus.READ,
                title: 'Sensor Failure',
                message: 'Sensor failure detected in Balcony Rack.',
                metadata: {
                    screen: `/(tabs)/(racks)/${rack3.id}`,
                    rackId: rack3.id,
                    rackName: rack3.name,
                    macAddress: rack3.macAddress,
                },
            },
        ],
    });

    console.log('✓ Notifications created');

    // ============================================
    // SUMMARY
    // ============================================

    const plantCount = await prisma.plant.count();
    const ruleCount = await prisma.automationRule.count();
    const activityCount = await prisma.activity.count();

    console.log('\n✓ Seed completed successfully!');
    console.log(`   - ${plantCount} plants created`);
    console.log(`   - ${ruleCount} automation rules created`);
    console.log(`   - 3 racks (Rack 1: Lettuce active, Rack 2: Basil active, Rack 3: empty)`);
    console.log(`   - ${activityCount} activity records created`);
    console.log(`   - Sample sensor readings, aggregated readings, and notifications added`);
}

main()
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
