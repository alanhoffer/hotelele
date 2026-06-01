-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "depositMethod" "PaymentMethod",
ADD COLUMN     "depositPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositReference" TEXT;
