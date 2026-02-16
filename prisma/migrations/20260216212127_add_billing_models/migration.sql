-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT,
    "currentPlan" TEXT NOT NULL DEFAULT 'free',
    "billingCycle" TEXT,
    "subscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "isBetaUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "mediaFilesCount" INTEGER NOT NULL DEFAULT 0,
    "giftOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "usageFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "orderId" TEXT,
    "giftRecipient" TEXT,
    "billingMonth" TEXT NOT NULL,
    "isCounted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "Usage_shopId_idx" ON "Usage"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_shopId_billingMonth_key" ON "Usage"("shopId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_s3Key_key" ON "MediaFile"("s3Key");

-- CreateIndex
CREATE INDEX "MediaFile_shopId_billingMonth_idx" ON "MediaFile"("shopId", "billingMonth");

-- CreateIndex
CREATE INDEX "MediaFile_s3Key_idx" ON "MediaFile"("s3Key");

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
