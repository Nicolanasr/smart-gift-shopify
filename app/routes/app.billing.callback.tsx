import { LoaderFunctionArgs, redirect } from "react-router";
import { unauthenticated } from "../shopify.server";
import { updateShopPlan } from "../services/usage-tracker.server";
import { getActiveSubscription } from "../services/billing.server";

/**
 * Billing callback route - handles return from Shopify billing approval
 * Uses unauthenticated.admin because this is a top-level redirect and session cookies might be missing.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
        console.error("Billing callback: Missing shop parameter");
        return redirect("/auth/login");
    }

    try {
        const { admin } = await unauthenticated.admin(shop);

        // Get the active subscription to verify it was created
        const subscription = await getActiveSubscription(admin);
        let statusParam = "error";

        if (subscription && subscription.status === "ACTIVE") {
            // Determine plan from subscription name
            const plan = subscription.name.includes("Pro") ? "pro" :
                subscription.name.includes("Automation") ? "scale" : "free";

            // Update the shop's plan in our database
            await updateShopPlan(shop, plan, subscription.id);
            statusParam = "success";
        } else {
            // Subscription not active yet
            statusParam = "pending";
        }

        // Force redirect back into Shopify Admin to restore embedded experience
        const apiKey = process.env.SHOPIFY_API_KEY;
        const embeddedUrl = `https://${shop}/admin/apps/${apiKey}/app/billing?${statusParam}=true`;

        console.log(`[BILLING] Redirecting to embedded URL: ${embeddedUrl}`);
        return redirect(embeddedUrl);
    } catch (error) {
        console.error("Billing callback error:", error);
        const apiKey = process.env.SHOPIFY_API_KEY;
        return redirect(`https://${shop}/admin/apps/${apiKey}/app/billing?error=true`);
    }
};
