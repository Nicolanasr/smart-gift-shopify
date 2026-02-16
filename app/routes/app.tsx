import type { HeadersFunction, LoaderFunctionArgs, LinksFunction } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: polarisStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);

    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
    const { apiKey } = useLoaderData<typeof loader>();

    return (
        <AppProvider embedded apiKey={apiKey}>
            <PolarisAppProvider i18n={{}}>
                <s-app-nav>
                    <s-link href="/app/overview">Overview</s-link>
                    <s-link href="/app/guide">Setup Guide</s-link>
                    <s-link href="/app">Gift Orders</s-link>
                    <s-link href="/app/files">Uploaded Files</s-link>
                    <s-link href="/app/billing">Billing</s-link>
                    <s-link href="/app/customize">Customize Page</s-link>
                </s-app-nav>
                <Outlet />
            </PolarisAppProvider>
        </AppProvider>
    );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
    return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
    return boundary.headers(headersArgs);
};
