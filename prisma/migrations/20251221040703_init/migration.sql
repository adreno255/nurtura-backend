-- CreateEnum
CREATE TYPE "PlantType" AS ENUM ('ASTERACEAE', 'BASELLACEAE', 'LAMIACEAE', 'APIACEAE');

-- CreateEnum
CREATE TYPE "SoilType" AS ENUM ('LOAMY', 'SANDY', 'PEATY', 'SILTY', 'CHALKY', 'CLAY');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('LIGHT_ON', 'LIGHT_OFF', 'WATERING_ON', 'WATERING_OFF', 'SENSORS_ON', 'SENSORS_OFF');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ALERT', 'INFO');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "suffix" TEXT,
    "email" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3),
    "address" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rack" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "rackName" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,

    CONSTRAINT "rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant" (
    "id" SERIAL NOT NULL,
    "rackId" INTEGER NOT NULL,
    "plantName" TEXT NOT NULL,
    "plantType" "PlantType",
    "plantAmount" INTEGER,
    "recommendedSoil" "SoilType",
    "datePlanted" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastWateredAt" TIMESTAMP(3),
    "lastLightOn" TIMESTAMP(3),

    CONSTRAINT "plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" SERIAL NOT NULL,
    "rackId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" "ActivityEventType" NOT NULL,
    "eventDetails" TEXT,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "rackId" INTEGER,
    "message" TEXT NOT NULL,
    "notificationType" "NotificationType",

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "rack" ADD CONSTRAINT "rack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant" ADD CONSTRAINT "plant_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
