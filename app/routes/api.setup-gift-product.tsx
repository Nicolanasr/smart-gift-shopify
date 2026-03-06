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
            query {
                shop { id }
            }`
        );
        const shopJson = await shopResponse.json();
        const shopGid = shopJson.data?.shop?.id;
        if (!shopGid) {
            return Response.json({ error: "Could not fetch shop ID" }, { status: 500 });
        }

        // Step 2: Create the base product (Shopify auto-creates 1 default variant)
        const createProductResponse = await admin.graphql(
            `#graphql
            mutation CreateGiftProduct {
                productCreate(input: {
                    title: "Smart Gift Add-on"
                    vendor: "Smart Gift"
                    status: DRAFT
                    tags: ["smart-gift-internal"]
                }) {
                    product {
                        id
                        handle
                        variants(first: 1) {
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
            }`
        );

        const productJson = await createProductResponse.json();

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

        const productGid = product.id;
        const productHandle = product.handle;

        // The first (default) variant is our "Simple Gift Wrap"
        const defaultVariantGid = product.variants.edges[0]?.node?.id || "";
        const simpleVariantId = defaultVariantGid.split("/").pop() || "";

        // Step 3: Add "Digital Gift" variant
        const digitalResponse = await admin.graphql(
            `#graphql
            mutation CreateDigitalVariant($productId: ID!) {
                productVariantCreate(input: {
                    productId: $productId
                    price: "0.00"
                    options: ["Digital Gift"]
                }) {
                    productVariant { id title }
                    userErrors { field message }
                }
            }`,
            { variables: { productId: productGid } }
        );
        const digitalJson = await digitalResponse.json();
        const digitalVariantGid = digitalJson.data?.productVariantCreate?.productVariant?.id || "";
        const digitalVariantId = digitalVariantGid.split("/").pop() || "";

        // Step 4: Add "Printed Card" variant
        const printedResponse = await admin.graphql(
            `#graphql
            mutation CreatePrintedVariant($productId: ID!) {
                productVariantCreate(input: {
                    productId: $productId
                    price: "0.00"
                    options: ["Printed Card"]
                }) {
                    productVariant { id title }
                    userErrors { field message }
                }
            }`,
            { variables: { productId: productGid } }
        );
        const printedJson = await printedResponse.json();
        const printedVariantGid = printedJson.data?.productVariantCreate?.productVariant?.id || "";
        const printedVariantId = printedVariantGid.split("/").pop() || "";

        // Step 5: Save to database
        await prisma.shop.update({
            where: { shopDomain },
            data: {
                giftProductId: productGid,
                simpleVariantId,
                digitalVariantId,
                printedVariantId,
            } as any,
        });

        // Step 6: Create metafield definitions with PUBLIC_READ so Liquid can access them
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

        // Step 7: Set metafield values
        const metafieldsResponse = await admin.graphql(
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
                        { namespace: "smart_gift", key: "gift_product_handle", type: "single_line_text_field", value: productHandle, ownerId: shopGid },
                        { namespace: "smart_gift", key: "simple_variant_id", type: "single_line_text_field", value: simpleVariantId, ownerId: shopGid },
                        { namespace: "smart_gift", key: "digital_variant_id", type: "single_line_text_field", value: digitalVariantId, ownerId: shopGid },
                        { namespace: "smart_gift", key: "printed_variant_id", type: "single_line_text_field", value: printedVariantId, ownerId: shopGid },
                    ],
                },
            }
        );
        const metafieldsJson = await metafieldsResponse.json();
        if (metafieldsJson.data?.metafieldsSet?.userErrors?.length > 0) {
            console.warn("[auto-setup] Metafield errors:", metafieldsJson.data.metafieldsSet.userErrors);
        }

        return Response.json({
            success: true,
            product: { id: productGid, handle: productHandle },
            variants: { simpleVariantId, digitalVariantId, printedVariantId },
        });

    } catch (err: any) {
        console.error("[auto-setup] Error:", err);
        return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
};
