import { prisma } from "../db.server";

export interface TrackMediaParams {
  shopDomain: string;
  fileName: string;
  fileType: "image" | "video" | "audio" | "document";
  s3Key: string;
  fileSize: number;
  orderId?: string;
  giftRecipient?: string;
}

export interface UsageStats {
  plan: string;
  isBetaUser: boolean;
  mediaFilesUsed: number;
  freeLimit: number;
  overage: number;
  usageFee: number;
  billingMonth: string;
}

/**
 * Track a media file upload for billing purposes
 */
export async function trackMediaUpload(params: TrackMediaParams) {
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"
  
  try {
    // Find or create shop
    const shop = await prisma.shop.upsert({
      where: { shopDomain: params.shopDomain },
      create: { 
        shopDomain: params.shopDomain,
        currentPlan: "free",
        isBetaUser: false,
      },
      update: {},
    });
    
    // Create media file record
    await prisma.mediaFile.create({
      data: {
        shopId: shop.id,
        fileName: params.fileName,
        fileType: params.fileType,
        s3Key: params.s3Key,
        fileSize: params.fileSize,
        orderId: params.orderId,
        giftRecipient: params.giftRecipient,
        billingMonth: currentMonth,
        isCounted: true,
      },
    });
    
    // Update usage counter
    await prisma.usage.upsert({
      where: {
        shopId_billingMonth: {
          shopId: shop.id,
          billingMonth: currentMonth,
        },
      },
      create: {
        shopId: shop.id,
        billingMonth: currentMonth,
        mediaFilesCount: 1,
        giftOrdersCount: 0,
        usageFee: 0,
      },
      update: {
        mediaFilesCount: { increment: 1 },
      },
    });
    
    return { success: true, shopId: shop.id };
  } catch (error) {
    console.error("Error tracking media upload:", error);
    // Don't fail the upload if tracking fails
    return { success: false, error: String(error) };
  }
}

/**
 * Get current month usage statistics for a shop
 */
export async function getCurrentUsage(shopDomain: string): Promise<UsageStats | null> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  try {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: {
        usage: {
          where: { billingMonth: currentMonth },
        },
      },
    });
    
    if (!shop) {
      return null;
    }
    
    const usage = shop.usage[0] || { 
      mediaFilesCount: 0, 
      giftOrdersCount: 0, 
      usageFee: 0 
    };
    
    // Calculate overage based on plan
    const plan = shop.currentPlan;
    let freeLimit: number;
    
    switch (plan) {
      case "pro":
        freeLimit = 100;
        break;
      case "scale":
        freeLimit = 1000;
        break;
      case "free":
      default:
        freeLimit = 25;
        break;
    }
    
    const overage = Math.max(0, usage.mediaFilesCount - freeLimit);
    const usageFee = overage * 0.10;
    
    return {
      plan: shop.currentPlan,
      isBetaUser: shop.isBetaUser,
      mediaFilesUsed: usage.mediaFilesCount,
      freeLimit,
      overage,
      usageFee,
      billingMonth: currentMonth,
    };
  } catch (error) {
    console.error("Error getting usage stats:", error);
    return null;
  }
}

/**
 * Get shop details by domain
 */
export async function getShop(shopDomain: string) {
  return await prisma.shop.findUnique({
    where: { shopDomain },
  });
}

/**
 * Get or create shop record
 */
export async function getOrCreateShop(shopDomain: string) {
  return await prisma.shop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      currentPlan: "free",
      isBetaUser: false,
    },
    update: {},
  });
}

/**
 * Update shop's billing plan
 */
export async function updateShopPlan(
  shopDomain: string,
  plan: "free" | "pro" | "scale",
  subscriptionId?: string
) {
  return await prisma.shop.update({
    where: { shopDomain },
    data: {
      currentPlan: plan,
      subscriptionId: subscriptionId || null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark shop as beta user (grandfathered)
 */
export async function markShopAsBeta(shopDomain: string) {
  return await prisma.shop.update({
    where: { shopDomain },
    data: {
      isBetaUser: true,
      currentPlan: "pro", // Give them pro features for free
      updatedAt: new Date(),
    },
  });
}
