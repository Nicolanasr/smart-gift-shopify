import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { cancelSubscription, getActiveSubscription } from "../services/billing.server";
import { updateShopPlan } from "../services/usage-tracker.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    try {
        const activeSubscription = await getActiveSubscription(admin);

        if (activeSubscription) {
            await cancelSubscription(admin, activeSubscription.id);
        }

        // Downgrade to free in our DB
        await updateShopPlan(shop, "free");

        return Response.json({ success: true });
    } catch (error) {
        console.error("Cancellation error:", error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to cancel subscription"
        }, { status: 500 });
    }
};
