import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    try {
        // Step 1: Get real shop GID
        const shopResponse = await admin.graphql(
            `#graphql
            query GetShopId {
                shop { id }
            }`
        );
        const shopJson = await shopResponse.json();
        const shopGid = shopJson.data?.shop?.id;
        if (!shopGid) {
            return Response.json({ error: "Could not fetch shop ID" }, { status: 500 });
        }

        // Step 2: Create product with 3 variants — Shopify API 2025-10 syntax
        // 2025-10 uses productCreate(product: ProductCreateInput!) instead of (input: ProductInput!)
        // productOptions.values is [String!] not [{name: String!}]
        // variants use optionValues: [{optionName, name}]
        const createProductResponse = await admin.graphql(
            `#graphql
            mutation CreateGiftProduct($product: ProductCreateInput!) {
                productCreate(product: $product) {
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
                    product: {
                        title: "Smart Gift Add-on",
                        vendor: "Smart Gift",
                        status: "DRAFT",
                        tags: ["smart-gift-internal"],
                        productOptions: [
                            {
                                name: "Gift Type",
                                values: ["Simple Gift Wrap", "Digital Gift", "Printed Card"],
                            },
                        ],
                        variants: [
                            {
                                optionValues: [{ optionName: "Gift Type", name: "Simple Gift Wrap" }],
                                price: "0.00",
                            },
                            {
                                optionValues: [{ optionName: "Gift Type", name: "Digital Gift" }],
                                price: "0.00",
                            },
                            {
                                optionValues: [{ optionName: "Gift Type", name: "Printed Card" }],
                                price: "0.00",
                            },
                        ],
                    },
                },
            }
        );

        const productJson = await createProductResponse.json();

        // Check top-level GraphQL errors
        if (productJson.errors?.length > 0) {
            return Response.json(
                { error: "GraphQL: " + productJson.errors.map((e: any) => e.message).join(", ") },
                { status: 400 }
            );
        }

        const userErrors = productJson.data?.productCreate?.userErrors || [];
        if (userErrors.length > 0) {
            return Response.json(
                { error: userErrors.map((e: any) => e.message).join(", ") },
                { status: 400 }
            );
        }

        const product = productJson.data?.productCreate?.product;
        if (!product) {
            return Response.json({ error: "Product creation failed — no product returned" }, { status: 500 });
        }

        // Extract numeric variant IDs
        const variants = product.variants.edges.map((e: any) => e.node);
        const toNumericId = (gid: string) => gid.split("/").pop() || "";
        const simpleVariantId = toNumericId(variants.find((v: any) => v.title === "Simple Gift Wrap")?.id || "");
        const digitalVariantId = toNumericId(variants.find((v: any) => v.title === "Digital Gift")?.id || "");
        const printedVariantId = toNumericId(variants.find((v: any) => v.title === "Printed Card")?.id || "");

        // Step 3: Save to database
        try {
            await prisma.shop.update({
                where: { shopDomain },
                data: {
                    giftProductId: product.id,
                    simpleVariantId,
                    digitalVariantId,
                    printedVariantId,
                } as any,
            });
        } catch (dbErr: any) {
            // Non-fatal: DB might not have new columns yet if migration hasn't run
            console.warn("[auto-setup] DB update failed (migration pending?):", dbErr?.message);
        }

        // Step 4: Create metafield definitions with PUBLIC_READ
        for (const key of ["gift_product_handle", "simple_variant_id", "digital_variant_id", "printed_variant_id"]) {
            await admin.graphql(
                `#graphql
                mutation CreateMetafieldDef($definition: MetafieldDefinitionInput!) {
                    metafieldDefinitionCreate(definition: $definition) {
                        createdDefinition { id }
                        userErrors { field message code }
                    }
                }`,
                {
                    variables: {
                        definition: {
                            name: key.replace(/_/g, " "),
                            namespace: "smart_gift",
                            key,
                            type: "single_line_text_field",
                            ownerType: "SHOP",
                            access: { storefront: "PUBLIC_READ" },
                        },
                    },
                }
            ).catch(() => { /* already exists — ignore */ });
        }

        // Step 5: Set metafield values
        await admin.graphql(
            `#graphql
            mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
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
