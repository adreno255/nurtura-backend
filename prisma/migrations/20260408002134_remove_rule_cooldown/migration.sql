/*
  Warnings:

  - You are about to drop the column `cooldown_minutes` on the `automation_rules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "automation_rules" DROP COLUMN "cooldown_minutes";
