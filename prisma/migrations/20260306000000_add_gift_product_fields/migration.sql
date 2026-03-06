-- AlterTable: Add gift product fields to Shop
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "giftProductId" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "simpleVariantId" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "digitalVariantId" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "printedVariantId" TEXT;
