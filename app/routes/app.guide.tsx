import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: any) => {
    const { admin, session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    // Check 1: Gift Product
    const productResponse = await admin.graphql(
        `#graphql
        query findGiftProduct {
            products(first: 10, query: "title:*Gift*") {
                edges {
                    node {
                        id
                        title
                        handle
                        status
                    }
                }
            }
        }`
    );
    const productJson = await productResponse.json();
    const products = productJson.data?.products?.edges?.map((edge: any) => edge.node) || [];
    const giftProduct = products.length > 0 ? products[0] : null;

    // Check 2: Theme Settings (App Embed Status)
    let appEmbedEnabled = false;
    let productLinked = false;
    let activeThemeName = "";
    const debugLogs: string[] = [];

    try {
        debugLogs.push("Fetching recent themes...");
        // Get Themes (Main + Drafts) - Sort locally since sortKey isn't supported
        const themeResponse = await admin.graphql(
            `#graphql
            query getThemes {
                themes(first: 10) {
                    edges {
                        node {
                            id
                            name
                            role
                            updatedAt
                        }
                    }
                }
            }`
        );
        const themeJson = await themeResponse.json();

        let themes = themeJson.data?.themes?.edges?.map((e: any) => e.node) || [];

        // Sort by updatedAt descending
        if (themes.length > 0 && themes[0].updatedAt) {
            themes.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }

        // Take top 3
        themes = themes.slice(0, 3);

        debugLogs.push(`Found ${themes.length} recent themes: ${themes.map((t: any) => t.name).join(", ")}`);

        // Check each theme until we find it enabled
        for (const theme of themes) {
            debugLogs.push(`Checking theme: ${theme.name} (${theme.role})`);
            const assetResponse = await admin.graphql(
                `#graphql
                query getThemeSettings($id: ID!) {
                    theme(id: $id) {
                        files(filenames: ["config/settings_data.json"]) {
                            nodes {
                                body {
                                    ... on OnlineStoreThemeFileBodyText {
                                        content
                                    }
                                }
                            }
                        }
                    }
                }`,
                { variables: { id: theme.id } }
            );
            const assetJson = await assetResponse.json();
            // Parse response from "files" query
            const files = assetJson.data?.theme?.files?.nodes || [];
            const settingsString = files.length > 0 ? files[0].body?.content : null;

            if (settingsString) {
                // Strip comments (/* ... */ and // ...) from JSON before parsing
                const jsonWithCommentsStripped = settingsString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m: string, g: string) => g ? "" : m);

                let settingsData;
                try {
                    settingsData = JSON.parse(jsonWithCommentsStripped);
                } catch (e) {
                    debugLogs.push(`  ❌ Error parsing JSON: ${e}`);
                    debugLogs.push(`  First 100 chars: ${jsonWithCommentsStripped.substring(0, 100)}...`);
                    continue; // Skip this theme if JSON is invalid
                }

                const blocks = settingsData.current?.blocks || {};

                // Find our App Embed Block (look for "gift_globals" in the type)
                const embedBlockId = Object.keys(blocks).find(key =>
                    blocks[key].type && blocks[key].type.includes("gift_globals")
                );

                if (embedBlockId) {
                    const block = blocks[embedBlockId];
                    debugLogs.push(`  Found App Embed Block: ${embedBlockId} (Disabled: ${block.disabled})`);

                    // In Shopify Theme settings, "disabled": true means off. If undefined/false, it's on.
                    if (block.disabled !== true) {
                        appEmbedEnabled = true;
                        activeThemeName = theme.name;

                        // Check if a product is linked in settings
                        if (block.settings && block.settings.gift_product) {
                            productLinked = true;
                            debugLogs.push(`  Product Linked: Yes (${block.settings.gift_product})`);
                        } else {
                            debugLogs.push(`  Product Linked: No`);
                        }

                        debugLogs.push(`  ✅ ENABLED in this theme!`);
                        // If we found it enabled, stop checking other themes
                        break;
                    } else {
                        debugLogs.push(`  ❌ Block is explicitly disabled.`);
                    }
                } else {
                    debugLogs.push(`  ⚠️ App Embed block NOT found in settings_data.json`);
                }
            } else {
                debugLogs.push(`  ❌ Could not fetch settings_data.json`);
            }
        }
    } catch (e) {
        console.error("Error checking theme settings:", e);
        debugLogs.push(`Error: ${e}`);
    }

    // Load gift product state from DB
    let shopRecord: any = null;
    try {
        shopRecord = await prisma.shop.findUnique({ where: { shopDomain } });
    } catch (e) {
        console.error("Could not load shop record:", e);
    }

    return {
        giftProductFound: !!giftProduct,
        giftProduct,
        appEmbedEnabled,
        productLinked,
        activeThemeName,
        debugLogs,
        shopSetup: shopRecord ? {
            done: !!shopRecord.giftProductId,
            simpleVariantId: shopRecord.simpleVariantId,
            digitalVariantId: shopRecord.digitalVariantId,
            printedVariantId: shopRecord.printedVariantId,
        } : null,
    };
};

export default function Guide() {
    const { giftProductFound, giftProduct, appEmbedEnabled, productLinked, activeThemeName, debugLogs, shopSetup } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<any>();
    const isCreating = fetcher.state !== "idle";
    const createResult = fetcher.data;

    return (
        <s-page heading="Setup Guide & Onboarding">
            <s-layout>
                <s-layout-section>
                    <s-card>
                        <div style={{ padding: "20px" }}>
                            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>👋 Welcome to Smart Gift!</h2>
                            <p style={{ marginBottom: "20px", lineHeight: "1.5", color: "#4b5563" }}>
                                Follow this interactive guide to get the Gift Widget up and running.
                                Complete the checklist below to ensure everything is configured correctly.
                            </p>

                            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600" }}>🚀 Setup Checklist</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                                    {/* Step 1 Status */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{
                                            width: "24px", height: "24px", borderRadius: "50%",
                                            background: appEmbedEnabled ? "#dcfce7" : "#e2e8f0",
                                            color: appEmbedEnabled ? "#166534" : "#64748b",
                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px"
                                        }}>{appEmbedEnabled ? "✓" : "1"}</div>
                                        <div style={{ flex: 1 }}>
                                            <span>Enable "Smart Gift Globals" App Embed</span>
                                            {appEmbedEnabled && <div style={{ fontSize: "12px", color: "#166534" }}>Detected in: {activeThemeName}</div>}
                                        </div>
                                        {appEmbedEnabled ? (
                                            <span style={{ fontSize: "12px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "12px" }}>Enabled</span>
                                        ) : (
                                            <span style={{ fontSize: "12px", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "12px" }}>Action Required</span>
                                        )}
                                    </div>

                                    {/* Step 2 Status */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{
                                            width: "24px", height: "24px", borderRadius: "50%",
                                            background: (shopSetup?.done || createResult?.success) ? "#dcfce7" : "#e2e8f0",
                                            color: (shopSetup?.done || createResult?.success) ? "#166534" : "#64748b",
                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px"
                                        }}>{(shopSetup?.done || createResult?.success) ? "✓" : "2"}</div>
                                        <div style={{ flex: 1 }}>
                                            <span>Auto-Create Gift Product</span>
                                            {(shopSetup?.done || createResult?.success) && <div style={{ fontSize: "12px", color: "#166534" }}>Smart Gift Add-on created & configured</div>}
                                        </div>
                                        {(shopSetup?.done || createResult?.success) ? (
                                            <span style={{ fontSize: "12px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "12px" }}>Completed</span>
                                        ) : (
                                            <span style={{ fontSize: "12px", background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "12px" }}>Action Required</span>
                                        )}
                                    </div>

                                    {/* Step 3 Status */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{
                                            width: "24px", height: "24px", borderRadius: "50%",
                                            background: appEmbedEnabled ? "#dcfce7" : "#e2e8f0",
                                            color: appEmbedEnabled ? "#166534" : "#64748b",
                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px"
                                        }}>{appEmbedEnabled ? "✓" : "3"}</div>
                                        <div style={{ flex: 1 }}>
                                            <span>Add Gift Widget Block to Product Pages</span>
                                            <div style={{ fontSize: "12px", color: "#64748b" }}>In Theme Editor → product page → add "Gift Options Widget" block</div>
                                        </div>
                                        {appEmbedEnabled ? (
                                            <span style={{ fontSize: "12px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "12px" }}>Ready</span>
                                        ) : (
                                            <span style={{ fontSize: "12px", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "12px" }}>Enable App Embed First</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </s-card>

                    <s-card>
                        <div style={{ padding: "20px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Step 1: Enable App Embed</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
                                <div>
                                    <p style={{ marginBottom: "12px", lineHeight: "1.5" }}>
                                        Open your <strong>Theme Editor</strong> and navigate to the <strong>App Embeds</strong> tab (icon on the left).
                                        Switch on <strong>"Smart Gift Globals"</strong>.
                                    </p>
                                    <p style={{ marginBottom: "12px", lineHeight: "1.5" }}>
                                        This injects the necessary scripts and styles for the gift widget to work on your product pages.
                                    </p>
                                    <div style={{ marginTop: "16px", padding: "12px", background: "#fffbeb", borderLeft: "4px solid #f59e0b", color: "#92400e" }}>
                                        <strong>⚠️ Important:</strong> Without this enabled, the widget will not appear or function.
                                    </div>
                                    <div style={{ marginTop: "12px" }}>
                                        {appEmbedEnabled ? (
                                            <div style={{ padding: "8px", background: "#f0fdf4", color: "#15803d", borderRadius: "4px", fontSize: "14px" }}>
                                                ✅ App Embed is Enabled <span style={{ fontSize: "12px", opacity: 0.8 }}>({activeThemeName})</span>
                                            </div>
                                        ) : (
                                            <div style={{ padding: "8px", background: "#fef2f2", color: "#b91c1c", borderRadius: "4px", fontSize: "14px" }}>❌ App Embed is Disabled</div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                    <img src="/assets/images/app-embeds.png" alt="Enable App Embed" style={{ width: "100%", display: "block" }} />
                                </div>
                            </div>
                        </div>
                    </s-card>

                    <s-card>
                        <div style={{ padding: "20px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Step 2: Auto-Create Gift Product</h3>
                            <p style={{ marginBottom: "16px", color: "#4b5563", lineHeight: "1.5" }}>
                                Click below to automatically create a <strong>"Smart Gift Add-on"</strong> product with 3 variants (Simple, Digital, Printed)
                                in your store. Variant IDs will be configured automatically — no manual copy-pasting needed.
                            </p>

                            {/* Already set up */}
                            {(shopSetup?.done || createResult?.success) && (
                                <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", marginBottom: "16px" }}>
                                    <div style={{ fontWeight: "600", color: "#15803d", marginBottom: "12px" }}>✅ Gift product configured!</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                        {[{ label: "Simple Variant ID", value: createResult?.variants?.simpleVariantId || shopSetup?.simpleVariantId },
                                        { label: "Digital Variant ID", value: createResult?.variants?.digitalVariantId || shopSetup?.digitalVariantId },
                                        { label: "Printed Variant ID", value: createResult?.variants?.printedVariantId || shopSetup?.printedVariantId }].map(({ label, value }) => (
                                            <div key={label} style={{ background: "white", padding: "10px", borderRadius: "6px", border: "1px solid #d1fae5" }}>
                                                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>{label}</div>
                                                <code style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{value || "—"}</code>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: "12px", fontSize: "13px", color: "#166534" }}>
                                        🎉 Metafields set on your shop — the widget will auto-detect these. No theme editor config needed!
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {createResult?.error && (
                                <div style={{ padding: "12px", background: "#fef2f2", borderRadius: "6px", color: "#b91c1c", marginBottom: "16px" }}>
                                    ❌ {createResult.error}
                                </div>
                            )}

                            {/* Button - show when not already configured OR always allow re-run */}
                            {!createResult?.success && (
                                <fetcher.Form method="post" action="/api/setup-gift-product">
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        style={{
                                            background: isCreating ? "#9ca3af" : (shopSetup?.done ? "#6b7280" : "#6366f1"),
                                            color: "white",
                                            border: "none",
                                            borderRadius: "8px",
                                            padding: "12px 24px",
                                            fontSize: "15px",
                                            fontWeight: "600",
                                            cursor: isCreating ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {isCreating ? "⏳ Creating product..." : (shopSetup?.done ? "🔄 Re-run Setup" : "🪄 Auto-Create Gift Product")}
                                    </button>
                                </fetcher.Form>
                            )}

                        </div>
                    </s-card>

                    <s-card>
                        <div style={{ padding: "20px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Step 3: Configuration Reference</h3>
                            <p style={{ marginBottom: "20px" }}>
                                In the Theme Editor &gt; App Embeds &gt; Smart Gift Globals, use these settings to customize the widget.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "start" }}>
                                {/* Left Column: Screenshots */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                        <img src="/assets/images/settings-screenshot-1.png" alt="Settings Part 1" style={{ width: "100%", display: "block" }} />
                                    </div>
                                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                        <img src="/assets/images/settings-screenshot-2.png" alt="Settings Part 2" style={{ width: "100%", display: "block" }} />
                                    </div>
                                </div>

                                {/* Right Column: Explanations */}
                                <div>
                                    <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>1. Product & Toggle</h4>
                                    <ul style={{ marginBottom: "24px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                                        <li><strong>Select Gift Wrap Product:</strong> <span style={{ color: "#ef4444" }}>*Critical*</span> Link the dummy product you created. This ensures the fee is added to the cart.</li>
                                        <li><strong>Main Toggle Label:</strong> The text next to the checkbox (e.g., "Make this a gift").</li>
                                        <li><strong>Total Price Label:</strong> Text shown before the total price calculation.</li>
                                    </ul>

                                    <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>2. Simple Gift Wrap</h4>
                                    <ul style={{ marginBottom: "24px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                                        <li><strong>Simple Wrap Variant ID:</strong> (Optional) Specific variant ID if you offer a "Simple" wrapping option different from the base product.</li>
                                    </ul>

                                    <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>3. Digital Experience</h4>
                                    <ul style={{ marginBottom: "24px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                                        <li><strong>Enable Digital Option:</strong> Toggle to show/hide the "Digital" tab.</li>
                                        <li><strong>Digital Tab Title:</strong> Label for the tab (e.g., "Digital").</li>
                                        <li><strong>Digital Variant ID:</strong> <span style={{ color: "#ef4444" }}>*Required if enabled*</span> Variant ID for digital gifts (can be same as base product).</li>
                                        <li><strong>Format Selection:</strong> Placeholder text for format dropdown.</li>
                                        <li><strong>Enable Video/Audio/Photo/Text:</strong> Toggles to control which media types customers can upload.</li>
                                    </ul>

                                    <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>4. Printed Experience</h4>
                                    <ul style={{ marginBottom: "24px", paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                                        <li><strong>Enable Printed Option:</strong> Toggle to show/hide the "Printed" tab.</li>
                                        <li><strong>Printed Tab Title:</strong> Label for the tab (e.g., "Handwritten Card").</li>
                                        <li><strong>Printed Hover Hint:</strong> Tooltip text explaining the printed option.</li>
                                        <li><strong>Printed Variant ID:</strong> <span style={{ color: "#ef4444" }}>*Required if enabled*</span> Variant ID for printed cards.</li>
                                        <li><strong>Enable Photo (Printed):</strong> Allow customers to upload a photo to be printed.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </s-card>

                    {/* Debug Logs Section */}
                    <s-card>
                        <div style={{ padding: "20px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#64748b" }}>🛠️ Debug Verification Logs</h3>
                            <pre style={{
                                background: "#1e293b", color: "#f8fafc", padding: "16px", borderRadius: "8px",
                                fontSize: "12px", overflowX: "auto", fontFamily: "monospace", lineHeight: "1.5"
                            }}>
                                {debugLogs?.join("\n")}
                            </pre>
                        </div>
                    </s-card>
                </s-layout-section>
            </s-layout>
            <div style={{ height: "40px" }}></div>
        </s-page>
    );
}
