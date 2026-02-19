/*
  Warnings:

  - The values [SENSORS_ON,SENSORS_OFF,SYSTEM_START,SYSTEM_STOP] on the enum `activity_event_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "activity_event_type_new" AS ENUM ('RACK_ADDED', 'RACK_REMOVED', 'PLANT_ADDED', 'PLANT_REMOVED', 'PLANT_HARVESTED', 'LIGHT_ON', 'LIGHT_OFF', 'WATERING_ON', 'WATERING_OFF', 'SENSOR_READING', 'AUTOMATION_TRIGGERED', 'DEVICE_ONLINE', 'DEVICE_OFFLINE');
ALTER TABLE "activities" ALTER COLUMN "event_type" TYPE "activity_event_type_new" USING ("event_type"::text::"activity_event_type_new");
ALTER TYPE "activity_event_type" RENAME TO "activity_event_type_old";
ALTER TYPE "activity_event_type_new" RENAME TO "activity_event_type";
DROP TYPE "public"."activity_event_type_old";
COMMIT;
