-- CreateEnum
CREATE TYPE "plant_type" AS ENUM ('ASTERACEAE', 'BASELLACEAE', 'LAMIACEAE', 'APIACEAE');

-- CreateEnum
CREATE TYPE "soil_type" AS ENUM ('LOAMY', 'SANDY', 'PEATY', 'SILTY', 'CHALKY', 'CLAY');

-- CreateEnum
CREATE TYPE "activity_event_type" AS ENUM ('LIGHT_ON', 'LIGHT_OFF', 'WATERING_ON', 'WATERING_OFF', 'SENSORS_ON', 'SENSORS_OFF', 'SYSTEM_START', 'SYSTEM_STOP', 'SENSOR_READING', 'AUTOMATION_TRIGGERED', 'DEVICE_ONLINE', 'DEVICE_OFFLINE');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SYSTEM', 'ALERT', 'WARNING', 'INFO', 'SUCCESS');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "last_name" VARCHAR(100) NOT NULL,
    "suffix" VARCHAR(20),
    "address" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "mac_address" VARCHAR(17) NOT NULL,
    "mqtt_topic" VARCHAR(255),
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "device_status" NOT NULL DEFAULT 'OFFLINE',
    "last_activity_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "plant_type",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "recommended_soil" "soil_type",
    "planted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "harvest_at" TIMESTAMP(3),
    "last_watered_at" TIMESTAMP(3),
    "last_light_on_at" TIMESTAMP(3),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "light_level" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregated_sensor_readings" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "avg_temperature" DOUBLE PRECISION NOT NULL,
    "avg_humidity" DOUBLE PRECISION NOT NULL,
    "avg_moisture" DOUBLE PRECISION NOT NULL,
    "avg_light_level" DOUBLE PRECISION NOT NULL,
    "min_temperature" DOUBLE PRECISION NOT NULL,
    "max_temperature" DOUBLE PRECISION NOT NULL,
    "min_moisture" DOUBLE PRECISION NOT NULL,
    "max_moisture" DOUBLE PRECISION NOT NULL,
    "reading_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregated_sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "cooldown_minutes" INTEGER,
    "last_triggered_at" TIMESTAMP(3),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "event_type" "activity_event_type" NOT NULL,
    "details" VARCHAR(1000),
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rack_id" TEXT,
    "type" "notification_type" NOT NULL DEFAULT 'INFO',
    "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
    "title" VARCHAR(255) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "racks_mac_address_key" ON "racks"("mac_address");

-- CreateIndex
CREATE INDEX "racks_user_id_idx" ON "racks"("user_id");

-- CreateIndex
CREATE INDEX "racks_mac_address_idx" ON "racks"("mac_address");

-- CreateIndex
CREATE INDEX "racks_status_idx" ON "racks"("status");

-- CreateIndex
CREATE INDEX "racks_last_seen_at_idx" ON "racks"("last_seen_at");

-- CreateIndex
CREATE INDEX "plants_rack_id_idx" ON "plants"("rack_id");

-- CreateIndex
CREATE INDEX "plants_planted_at_idx" ON "plants"("planted_at");

-- CreateIndex
CREATE INDEX "sensor_readings_rack_id_timestamp_idx" ON "sensor_readings"("rack_id", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_timestamp_idx" ON "sensor_readings"("timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_rack_id_idx" ON "sensor_readings"("rack_id");

-- CreateIndex
CREATE INDEX "aggregated_sensor_readings_rack_id_hour_idx" ON "aggregated_sensor_readings"("rack_id", "hour");

-- CreateIndex
CREATE INDEX "aggregated_sensor_readings_hour_idx" ON "aggregated_sensor_readings"("hour");

-- CreateIndex
CREATE UNIQUE INDEX "aggregated_sensor_readings_rack_id_hour_key" ON "aggregated_sensor_readings"("rack_id", "hour");

-- CreateIndex
CREATE INDEX "automation_rules_rack_id_idx" ON "automation_rules"("rack_id");

-- CreateIndex
CREATE INDEX "automation_rules_is_enabled_idx" ON "automation_rules"("is_enabled");

-- CreateIndex
CREATE INDEX "activities_rack_id_idx" ON "activities"("rack_id");

-- CreateIndex
CREATE INDEX "activities_timestamp_idx" ON "activities"("timestamp");

-- CreateIndex
CREATE INDEX "activities_event_type_idx" ON "activities"("event_type");

-- CreateIndex
CREATE INDEX "activities_rack_id_timestamp_idx" ON "activities"("rack_id", "timestamp");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregated_sensor_readings" ADD CONSTRAINT "aggregated_sensor_readings_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
