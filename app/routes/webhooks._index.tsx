import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Handle GET requests (e.g., browser visits)
export const loader = async () => {
    return new Response("Webhook endpoint is active. Use POST to trigger webhooks.", { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // Handle specific topics
    switch (topic) {
        case "customers/data_request":
        case "CUSTOMERS_DATA_REQUEST":
            console.log("Processing Customer Data Request");
            // Add logic here to fetch and email customer data
            break;

        case "customers/redact":
        case "CUSTOMERS_REDACT":
            console.log("Processing Customer Redact Request");
            // Add logic here to delete customer data
            break;

        case "shop/redact":
        case "SHOP_REDACT":
            console.log("Processing Shop Redact Request");
            // Add logic here to delete shop data (if 48h passed since uninstall)
            break;

        default:
            console.log(`Unhandled topic: ${topic}`);
    }

    return new Response("Webhook received", { status: 200 });
};
