import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    try {
        // Step 1: Get real shop GID first
        const shopResponse = await admin.graphql(`#graphql query { shop { id } }`);
        const shopJson = await shopResponse.json();
        const shopGid = shopJson.data?.shop?.id;

        if (!shopGid) {
            return Response.json({ error: "Could not fetch shop ID" }, { status: 500 });
        }

        // Step 2: Create the Smart Gift Add-on product with 3 variants
        const createProductResponse = await admin.graphql(
            `#graphql
            mutation createGiftProduct($input: ProductInput!) {
                productCreate(input: $input) {
                    product {
                        id
                        handle
                        variants(first: 10) {
                            edges {
                                node {
                                    id
                                    title
                                }
                            }
                        }
                    }
                    userErrors { field message }
                }
            }`,
            {
                variables: {
                    input: {
                        title: "Smart Gift Add-on",
                        vendor: "Smart Gift",
                        status: "DRAFT",
                        tags: ["smart-gift-internal"],
                        variants: [
                            { optionValues: [{ name: "Simple Gift Wrap", optionName: "Gift Type" }], price: "0.00", inventoryManagement: null },
                            { optionValues: [{ name: "Digital Gift", optionName: "Gift Type" }], price: "0.00", inventoryManagement: null },
                            { optionValues: [{ name: "Printed Card", optionName: "Gift Type" }], price: "0.00", inventoryManagement: null },
                        ],
                    },
                },
            }
        );

        const productJson = await createProductResponse.json();
        const userErrors = productJson.data?.productCreate?.userErrors || [];

        if (userErrors.length > 0) {
            return Response.json({ error: userErrors.map((e: any) => e.message).join(", ") }, { status: 400 });
        }

        const product = productJson.data?.productCreate?.product;
        if (!product) {
            return Response.json({ error: "Product creation failed — no product returned" }, { status: 500 });
        }

        // Extract numeric variant IDs from GIDs
        const variants = product.variants.edges.map((e: any) => e.node);
        const toNumericId = (gid: string) => gid.split("/").pop() || "";
        const simpleVariantId = toNumericId(variants.find((v: any) => v.title === "Simple Gift Wrap")?.id || "");
        const digitalVariantId = toNumericId(variants.find((v: any) => v.title === "Digital Gift")?.id || "");
        const printedVariantId = toNumericId(variants.find((v: any) => v.title === "Printed Card")?.id || "");

        // Step 3: Save to database
        await prisma.shop.update({
            where: { shopDomain },
            data: {
                giftProductId: product.id,
                simpleVariantId,
                digitalVariantId,
                printedVariantId,
            } as any,
        });

        // Step 4: Create metafield definitions with PUBLIC_READ so Liquid can access them
        const metafieldDefs = [
            { key: "gift_product_handle", type: "single_line_text_field" },
            { key: "simple_variant_id", type: "single_line_text_field" },
            { key: "digital_variant_id", type: "single_line_text_field" },
            { key: "printed_variant_id", type: "single_line_text_field" },
        ];

        for (const def of metafieldDefs) {
            await admin.graphql(
                `#graphql
                mutation createMetafieldDefinition($definition: MetafieldDefinitionInput!) {
                    metafieldDefinitionCreate(definition: $definition) {
                        createdDefinition { id }
                        userErrors { field message code }
                    }
                }`,
                {
                    variables: {
                        definition: {
                            name: def.key.replace(/_/g, " "),
                            namespace: "smart_gift",
                            key: def.key,
                            type: def.type,
                            ownerType: "SHOP",
                            access: { storefront: "PUBLIC_READ" },
                        },
                    },
                }
            ).catch(() => {
                // Ignore — definition may already exist
            });
        }

        // Step 5: Set metafield values on the shop
        const metaFieldsSetResponse = await admin.graphql(
            `#graphql
            mutation setMetafields($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields { id key value }
                    userErrors { field message }
                }
            }`,
            {
                variables: {
                    metafields: [
                        { namespace: "smart_gift", key: "gift_product_handle", type: "single_line_text_field", value: product.handle, ownerId: shopGid },
                        { namespace: "smart_gift", key: "simple_variant_id", type: "single_line_text_field", value: simpleVariantId, ownerId: shopGid },
                        { namespace: "smart_gift", key: "digital_variant_id", type: "single_line_text_field", value: digitalVariantId, ownerId: shopGid },
                        { namespace: "smart_gift", key: "printed_variant_id", type: "single_line_text_field", value: printedVariantId, ownerId: shopGid },
                    ],
                },
            }
        );

        const metafieldsJson = await metaFieldsSetResponse.json();
        const metafieldErrors = metafieldsJson.data?.metafieldsSet?.userErrors || [];
        if (metafieldErrors.length > 0) {
            console.warn("[auto-setup] Metafield errors (non-fatal):", metafieldErrors);
        }

        return Response.json({
            success: true,
            product: { id: product.id, handle: product.handle },
            variants: { simpleVariantId, digitalVariantId, printedVariantId },
        });

    } catch (err: any) {
        console.error("[auto-setup] Error:", err);
        return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
};
