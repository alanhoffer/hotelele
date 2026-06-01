-- CreateEnum
CREATE TYPE "OccupantAgeCategory" AS ENUM ('adult', 'child');

-- CreateTable
CREATE TABLE "ReservationOccupant" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "ageCategory" "OccupantAgeCategory" NOT NULL DEFAULT 'adult',
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationOccupant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationOccupant_hotelId_reservationId_idx" ON "ReservationOccupant"("hotelId", "reservationId");

-- CreateIndex
CREATE INDEX "ReservationOccupant_hotelId_documentNumber_idx" ON "ReservationOccupant"("hotelId", "documentNumber");

-- AddForeignKey
ALTER TABLE "ReservationOccupant" ADD CONSTRAINT "ReservationOccupant_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationOccupant" ADD CONSTRAINT "ReservationOccupant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
