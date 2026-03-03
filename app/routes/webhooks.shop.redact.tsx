import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Shopify MUST receive a 200 OK, even if we crash, as long as reasonable effort was made to drop data
    try {
        // Delete all associated application sessions
        await prisma.session.deleteMany({
            where: { shop }
        });

        // Delete the Shop record. Prisma schema has `onDelete: Cascade` for Usage, so those disappear.
        // MediaFiles won't cascade automatically based on string matching unless explicitly relations mapped, 
        // so we manually clean them out.
        await prisma.mediaFile.deleteMany({
            where: {
                shopId: shop
            }
        });

        // Try to delete the shop record if it explicitly exists as `shopDomain`
        try {
            await prisma.shop.delete({
                where: { shopDomain: shop }
            });
            console.log(`[GDPR] Successfully wiped all data for ${shop}`);
        } catch (e) {
            console.log(`[GDPR] Shop ${shop} did not explicitly exist in db, skipping deletion.`);
        }
    } catch (err) {
        console.error(`[GDPR] Error attempting to redact shop data:`, err);
    }

    // Always 200 back to Shopify to avoid mandatory penalities
    return new Response("OK", { status: 200 });
};
