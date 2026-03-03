import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (topic !== "ORDERS_CREATE") {
        return new Response("Mismatched topic", { status: 400 });
    }

    try {
        const orderId = payload.id.toString();
        const lineItems = payload.line_items || [];

        // We want to extract any Media files attached to this order
        let mediaFilenames: string[] = [];

        for (const item of lineItems) {
            const properties = item.properties || [];
            for (const prop of properties) {
                // Look for our specific gift property keys that contain URLs
                if (['Gift Link', '_Gift QR Code', '_Gift Image'].includes(prop.name) && prop.value) {
                    const urlStr = prop.value;
                    // URLs usually look like: https://empowered-deal-app.vercel.app/v/shortId.ext or similar
                    try {
                        const urlObj = new URL(urlStr);
                        // Extract filename from the path
                        const filename = urlObj.pathname.split('/').pop();
                        if (filename && filename !== 'v') {
                            mediaFilenames.push(filename);
                        }
                    } catch (e) {
                        // Not a valid URL, ignore
                    }
                }
            }
        }

        if (mediaFilenames.length > 0) {
            console.log(`[ORDERS_CREATE] Linking ${mediaFilenames.length} media files to Order ${orderId} for Shop ${shop}`);

            // Get the shop from our DB
            const shopRecord = await prisma.shop.findUnique({
                where: { shopDomain: shop }
            });

            if (shopRecord) {
                // Update all matching media files to link them to this newly created order!
                await prisma.mediaFile.updateMany({
                    where: {
                        shopId: shopRecord.id,
                        fileName: {
                            in: mediaFilenames
                        }
                    },
                    data: {
                        orderId: orderId
                    }
                });
                console.log(`[ORDERS_CREATE] Successfully stitched media files for Order ${orderId}`);
            }
        }

        return new Response("OK", { status: 200 });

    } catch (error) {
        console.error("Error processing orders/create webhook:", error);
        // Always return 200 so Shopify doesn't retry infinitely unless it's a catastrophic setup failure
        return new Response("Internal Error", { status: 500 });
    }
};
