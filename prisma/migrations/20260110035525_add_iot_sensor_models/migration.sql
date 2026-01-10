-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_event_type" ADD VALUE 'SENSOR_READING';
ALTER TYPE "activity_event_type" ADD VALUE 'AUTOMATION_TRIGGERED';
ALTER TYPE "activity_event_type" ADD VALUE 'DEVICE_ONLINE';
ALTER TYPE "activity_event_type" ADD VALUE 'DEVICE_OFFLINE';

-- AlterTable
ALTER TABLE "racks" ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "mqtt_topic" TEXT,
ADD COLUMN     "status" "device_status" NOT NULL DEFAULT 'OFFLINE';

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
    "name" TEXT NOT NULL,
    "description" TEXT,
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
CREATE INDEX "activities_rack_id_timestamp_idx" ON "activities"("rack_id", "timestamp");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "racks_status_idx" ON "racks"("status");

-- CreateIndex
CREATE INDEX "racks_last_seen_at_idx" ON "racks"("last_seen_at");

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregated_sensor_readings" ADD CONSTRAINT "aggregated_sensor_readings_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
