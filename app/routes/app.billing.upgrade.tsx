import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createSubscription } from "../services/billing.server";

/**
 * Handle plan upgrade action
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const plan = formData.get("plan") as "pro-gifting" | "automation-plus";

    if (!plan || (plan !== "pro-gifting" && plan !== "automation-plus")) {
        return Response.json({ error: "Invalid plan" }, { status: 400 });
    }

    try {
        const url = new URL(request.url);
        const appUrl = `${url.protocol}//${url.host}`;

        const { confirmationUrl, subscriptionId } = await createSubscription(
            admin,
            session.shop,
            plan,
            appUrl
        );

        if (!confirmationUrl) {
            throw new Error("No confirmation URL returned from Shopify");
        }

        // Return the URL for client-side redirect
        return Response.json({
            success: true,
            confirmationUrl,
            subscriptionId,
        });
    } catch (error) {
        console.error("Upgrade error:", error);
        return Response.json({
            error: error instanceof Error ? error.message : "Failed to create subscription"
        }, { status: 500 });
    }
};
