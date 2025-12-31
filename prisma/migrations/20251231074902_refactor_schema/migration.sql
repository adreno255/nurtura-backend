/*
  Warnings:

  - The primary key for the `activities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `eventDetails` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `rackId` on the `activities` table. All the data in the column will be lost.
  - The primary key for the `notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `notificationType` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `rackId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notifications` table. All the data in the column will be lost.
  - The primary key for the `plants` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `datePlanted` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `lastLightOn` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `lastWateredAt` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `plantAmount` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `plantName` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `plantType` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `rackId` on the `plants` table. All the data in the column will be lost.
  - You are about to drop the column `recommendedSoil` on the `plants` table. All the data in the column will be lost.
  - The primary key for the `racks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `macAddress` on the `racks` table. All the data in the column will be lost.
  - You are about to drop the column `rackName` on the `racks` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `racks` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mac_address]` on the table `racks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `event_type` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rack_id` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `plants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rack_id` to the `plants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `plants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mac_address` to the `racks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `racks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `racks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `racks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "plant_type" AS ENUM ('ASTERACEAE', 'BASELLACEAE', 'LAMIACEAE', 'APIACEAE');

-- CreateEnum
CREATE TYPE "soil_type" AS ENUM ('LOAMY', 'SANDY', 'PEATY', 'SILTY', 'CHALKY', 'CLAY');

-- CreateEnum
CREATE TYPE "activity_event_type" AS ENUM ('LIGHT_ON', 'LIGHT_OFF', 'WATERING_ON', 'WATERING_OFF', 'SENSORS_ON', 'SENSORS_OFF', 'SYSTEM_START', 'SYSTEM_STOP');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SYSTEM', 'ALERT', 'WARNING', 'INFO', 'SUCCESS');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_rackId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_rackId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "plants" DROP CONSTRAINT "plants_rackId_fkey";

-- DropForeignKey
ALTER TABLE "racks" DROP CONSTRAINT "racks_userId_fkey";

-- AlterTable
ALTER TABLE "activities" DROP CONSTRAINT "activities_pkey",
DROP COLUMN "eventDetails",
DROP COLUMN "eventType",
DROP COLUMN "rackId",
ADD COLUMN     "details" TEXT,
ADD COLUMN     "event_type" "activity_event_type" NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "rack_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "activities_id_seq";

-- AlterTable
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_pkey",
DROP COLUMN "notificationType",
DROP COLUMN "rackId",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "rack_id" TEXT,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" "notification_type" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "notifications_id_seq";

-- AlterTable
ALTER TABLE "plants" DROP CONSTRAINT "plants_pkey",
DROP COLUMN "datePlanted",
DROP COLUMN "lastLightOn",
DROP COLUMN "lastWateredAt",
DROP COLUMN "plantAmount",
DROP COLUMN "plantName",
DROP COLUMN "plantType",
DROP COLUMN "rackId",
DROP COLUMN "recommendedSoil",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "harvest_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_light_on_at" TIMESTAMP(3),
ADD COLUMN     "last_watered_at" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "planted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rack_id" TEXT NOT NULL,
ADD COLUMN     "recommended_soil" "soil_type",
ADD COLUMN     "type" "plant_type",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "plants_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "plants_id_seq";

-- AlterTable
ALTER TABLE "racks" DROP CONSTRAINT "racks_pkey",
DROP COLUMN "macAddress",
DROP COLUMN "rackName",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "mac_address" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "racks_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "racks_id_seq";

-- DropEnum
DROP TYPE "ActivityEventType";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "PlantType";

-- DropEnum
DROP TYPE "SoilType";

-- CreateIndex
CREATE INDEX "activities_rack_id_idx" ON "activities"("rack_id");

-- CreateIndex
CREATE INDEX "activities_timestamp_idx" ON "activities"("timestamp");

-- CreateIndex
CREATE INDEX "activities_event_type_idx" ON "activities"("event_type");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "plants_rack_id_idx" ON "plants"("rack_id");

-- CreateIndex
CREATE INDEX "plants_planted_at_idx" ON "plants"("planted_at");

-- CreateIndex
CREATE UNIQUE INDEX "racks_mac_address_key" ON "racks"("mac_address");

-- CreateIndex
CREATE INDEX "racks_user_id_idx" ON "racks"("user_id");

-- CreateIndex
CREATE INDEX "racks_mac_address_idx" ON "racks"("mac_address");

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
