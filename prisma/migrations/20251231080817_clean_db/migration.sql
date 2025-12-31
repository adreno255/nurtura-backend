/*
  Warnings:

  - You are about to drop the `activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `racks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_rack_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_rack_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "plants" DROP CONSTRAINT "plants_rack_id_fkey";

-- DropForeignKey
ALTER TABLE "racks" DROP CONSTRAINT "racks_user_id_fkey";

-- DropTable
DROP TABLE "activities";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "plants";

-- DropTable
DROP TABLE "racks";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "activity_event_type";

-- DropEnum
DROP TYPE "notification_status";

-- DropEnum
DROP TYPE "notification_type";

-- DropEnum
DROP TYPE "plant_type";

-- DropEnum
DROP TYPE "soil_type";
