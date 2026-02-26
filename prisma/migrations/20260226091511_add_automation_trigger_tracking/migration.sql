-- AlterTable
ALTER TABLE "automation_rules" ADD COLUMN     "last_triggered_at" TIMESTAMP(3),
ADD COLUMN     "trigger_count" INTEGER NOT NULL DEFAULT 0;
