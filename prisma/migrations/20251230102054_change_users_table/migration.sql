/*
  Warnings:

  - You are about to drop the `activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rack` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_rackId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_rackId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "plant" DROP CONSTRAINT "plant_rackId_fkey";

-- DropForeignKey
ALTER TABLE "rack" DROP CONSTRAINT "rack_userId_fkey";

-- DropTable
DROP TABLE "activity";

-- DropTable
DROP TABLE "plant";

-- DropTable
DROP TABLE "rack";

-- DropTable
DROP TABLE "user";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "suffix" TEXT,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "rackName" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" SERIAL NOT NULL,
    "rackId" INTEGER NOT NULL,
    "plantName" TEXT NOT NULL,
    "plantType" "PlantType",
    "plantAmount" INTEGER,
    "recommendedSoil" "SoilType",
    "datePlanted" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastWateredAt" TIMESTAMP(3),
    "lastLightOn" TIMESTAMP(3),

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "rackId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" "ActivityEventType" NOT NULL,
    "eventDetails" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
