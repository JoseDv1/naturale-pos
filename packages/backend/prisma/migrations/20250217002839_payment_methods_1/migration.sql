/*
  Warnings:

  - Added the required column `paymentMethod` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "paymentMethod" "payment_methods" NOT NULL;
