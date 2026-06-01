-- CreateEnum
CREATE TYPE "HousekeepingPriority" AS ENUM ('normal', 'arrival_today', 'urgent');

-- AlterTable
ALTER TABLE "HousekeepingTask"
ADD COLUMN     "priority" "HousekeepingPriority" NOT NULL DEFAULT 'normal',
ADD COLUMN     "pauseReason" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "checklistJson" JSONB,
ADD COLUMN     "suppliesJson" JSONB,
ADD COLUMN     "issueNotes" TEXT,
ADD COLUMN     "lostFoundNotes" TEXT,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "HousekeepingTask_hotelId_priority_idx" ON "HousekeepingTask"("hotelId", "priority");
