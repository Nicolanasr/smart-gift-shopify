import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, topic, admin, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    try {
        // Get the deleted product GID
        const deletedProductNumericId = (payload as any)?.id?.toString();
        const deletedProductGid = `gid://shopify/Product/${deletedProductNumericId}`;

        // Look up this shop's gift product in DB
        const shopRecord: any = await db.shop.findUnique({ where: { shopDomain: shop } }).catch(() => null);

        // Only act if this is the shop's configured gift product
        if (!shopRecord?.giftProductId || shopRecord.giftProductId !== deletedProductGid) {
            return new Response();
        }

        console.log(`[products/delete] Gift product deleted for ${shop} — clearing setup`);

        // Clear DB fields
        await db.shop.update({
            where: { shopDomain: shop },
            data: {
                giftProductId: null,
                simpleVariantId: null,
                digitalVariantId: null,
                printedVariantId: null,
            } as any,
        }).catch((e: any) => console.warn("[products/delete] DB clear failed:", e?.message));

        // Clear shop metafields via Admin API (if admin client is available)
        if (admin) {
            // Get shop GID first
            const shopResponse = await admin.graphql(`#graphql query { shop { id } }`);
            const shopJson = await shopResponse.json();
            const shopGid = shopJson.data?.shop?.id;

            if (shopGid) {
                // Delete all smart_gift metafields
                for (const key of ["gift_product_handle", "simple_variant_id", "digital_variant_id", "printed_variant_id"]) {
                    await admin.graphql(
                        `#graphql
                        mutation DeleteMetafield($metafields: [MetafieldIdentifierInput!]!) {
                            metafieldsDelete(metafields: $metafields) {
                                deletedMetafields { key namespace ownerId }
                                userErrors { field message }
                            }
                        }`,
                        {
                            variables: {
                                metafields: [{ ownerId: shopGid, namespace: "smart_gift", key }],
                            },
                        }
                    ).catch(() => { /* ignore if metafield doesn't exist */ });
                }
                console.log(`[products/delete] Metafields cleared for ${shop}`);
            }
        }
    } catch (err: any) {
        console.error("[products/delete] Error:", err?.message);
    }

    return new Response();
};
