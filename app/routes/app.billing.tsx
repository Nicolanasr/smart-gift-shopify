import { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useState } from "react";
import { Page, Layout, Card, Text, Button, Badge, ProgressBar, BlockStack, InlineStack, Box, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getCurrentUsage } from "../services/usage-tracker.server";

interface UsageData {
    plan: string;
    isBetaUser: boolean;
    mediaFilesUsed: number;
    freeLimit: number;
    overage: number;
    usageFee: number;
    billingMonth: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    // Get usage stats (this will auto-create shop if needed)
    let usage = await getCurrentUsage(shopDomain);

    // If still null, create shop manually and retry
    if (!usage) {
        const { getOrCreateShop } = await import("../services/usage-tracker.server");
        await getOrCreateShop(shopDomain);
        usage = await getCurrentUsage(shopDomain);
    }

    const usageData: UsageData = usage || {
        plan: "free",
        isBetaUser: false,
        mediaFilesUsed: 0,
        freeLimit: 25,
        overage: 0,
        usageFee: 0,
        billingMonth: new Date().toISOString().slice(0, 7),
    };

    return Response.json({ usage: usageData });
};

export default function BillingPage() {
    const data = useLoaderData<{ usage: UsageData }>();
    const usage = data.usage;
    const [searchParams] = useSearchParams();
    const [isUpgrading, setIsUpgrading] = useState(false);

    // Check for callback status
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const pending = searchParams.get("pending");

    const handleUpgrade = async (plan: "pro" | "scale") => {
        setIsUpgrading(true);

        try {
            const response = await fetch("/app/billing/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ plan }),
            });

            const result = await response.json();

            if (result.success && result.confirmationUrl) {
                // Redirect to Shopify billing approval page
                window.top!.location.href = result.confirmationUrl;
            } else {
                alert(`Error: ${result.error || "Failed to create subscription"}`);
                setIsUpgrading(false);
            }
        } catch (err) {
            alert("Failed to upgrade plan. Please try again.");
            setIsUpgrading(false);
        }
    };


    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel your subscription? You'll lose access to Pro features immediately.")) return;

        setIsUpgrading(true);
        try {
            const formData = new FormData();
            const response = await fetch("/app/billing/cancel", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            if (result.success) {
                window.location.reload();
            } else {
                alert(`Error: ${result.error}`);
                setIsUpgrading(false);
            }
        } catch (err) {
            alert("Failed to cancel subscription.");
            setIsUpgrading(false);
        }
    };

    const usagePercentage = Math.min(100, (usage.mediaFilesUsed / usage.freeLimit) * 100);

    const plans = [
        {
            name: "Starter",
            price: "Free",
            period: "forever",
            features: [
                "25 media files/month",
                "$0.10 per file after",
                "All media formats (video/audio/images)",
                "Text message printing",
                "Photo printing (4×6 PDFs)",
                "QR codes (400px)",
                "Social sharing",
                '"Powered by Smart Gift" branding',
            ],
            current: usage.plan === "free",
            buttonText: usage.plan === "free" ? "Current Plan" : "Downgrade",
            buttonDisabled: usage.plan === "free",
            highlighted: false,
            action: usage.plan !== "free" ? handleCancel : undefined
        },
        {
            name: "Pro Gifting",
            price: "$14.99",
            period: "/month",
            features: [
                "100 media files/month",
                "$0.10 per file after",
                "Unlimited gift orders",
                "QR size selection (200-1000px)",
                "Remove branding",
                "Photo printing (4×6 PDFs)",
                "Priority email support",
                "Advanced analytics",
            ],
            current: usage.plan === "pro",
            buttonText: usage.plan === "pro" ? "Current Plan" : "Upgrade to Pro",
            buttonDisabled: usage.plan === "pro" || usage.isBetaUser,
            highlighted: true,
            action: () => handleUpgrade("pro")
        },
        {
            name: "Automation Plus",
            price: "$79",
            period: "/month",
            features: [
                "1,000 media files/month",
                "Bring your own S3 bucket",
                "Custom landing pages",
                "Batch photo printing",
                "API access",
                "White-label branding",
                "Phone support",
                "Team accounts (5 users)",
            ],
            current: usage.plan === "scale",
            buttonText: "Coming Soon",
            buttonDisabled: true,
            highlighted: false,
            comingSoon: true,
            action: () => handleUpgrade("scale")
        },
    ];

    return (
        <Page
            title="Billing & Plans"
            subtitle="Choose the plan that fits your business"
        >
            <Layout>
                {success && (
                    <Layout.Section>
                        <Banner title="Subscription Activated!" tone="success" onDismiss={() => window.location.href = "/app/billing"}>
                            <p>Your plan has been successfully upgraded. Thank you for choosing Smart Gift!</p>
                        </Banner>
                    </Layout.Section>
                )}

                {error && (
                    <Layout.Section>
                        <Banner title="Subscription Error" tone="critical" onDismiss={() => window.location.href = "/app/billing"}>
                            <p>There was an error activating your subscription. Please try again or contact support.</p>
                        </Banner>
                    </Layout.Section>
                )}

                {pending && (
                    <Layout.Section>
                        <Banner title="Subscription Pending" tone="warning" onDismiss={() => window.location.href = "/app/billing"}>
                            <p>Your subscription is being processed. This may take a few moments.</p>
                        </Banner>
                    </Layout.Section>
                )}

                {usage.isBetaUser && (
                    <Layout.Section>
                        <Banner
                            title="🎉 Founding Merchant - Free Forever!"
                            tone="success"
                        >
                            <p>
                                Thank you for being an early adopter! You have lifetime access to <strong>Pro features</strong> at no cost.
                                This is our way of saying thank you for helping us build Smart Gift.
                            </p>
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text as="h2" variant="headingMd">Current Usage - {usage.billingMonth}</Text>

                            <Box>
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text as="p" variant="bodyMd">Media files used this month</Text>
                                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                                            {usage.mediaFilesUsed} / {usage.freeLimit}
                                        </Text>
                                    </InlineStack>

                                    <ProgressBar
                                        progress={usagePercentage}
                                        tone={usagePercentage > 90 ? "critical" : usagePercentage > 70 ? "highlight" : "success"}
                                        size="small"
                                    />

                                    {usage.overage > 0 && (
                                        <Banner tone="info">
                                            <p>
                                                You've used <strong>{usage.overage} extra files</strong> this month.
                                                {!usage.isBetaUser && (
                                                    <> Overage fee: <strong>${usage.usageFee.toFixed(2)}</strong></>
                                                )}
                                            </p>
                                        </Banner>
                                    )}
                                </BlockStack>
                            </Box>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <InlineStack gap="400" wrap={false}>
                        {plans.map((plan) => (
                            <Box key={plan.name} width="33.333%">
                                <Card>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text as="h3" variant="headingMd">{plan.name}</Text>
                                                {plan.current && <Badge tone="success">Current</Badge>}
                                                {plan.comingSoon && <Badge>Coming Soon</Badge>}
                                            </InlineStack>

                                            <InlineStack gap="100" blockAlign="baseline">
                                                <Text as="p" variant="heading2xl" fontWeight="bold">
                                                    {plan.price}
                                                </Text>
                                                <Text as="p" variant="bodyMd" tone="subdued">
                                                    {plan.period}
                                                </Text>
                                            </InlineStack>
                                        </BlockStack>

                                        <Box
                                            background={plan.highlighted ? "bg-fill-success-secondary" : undefined}
                                            padding="300"
                                            borderRadius="200"
                                        >
                                            <BlockStack gap="200">
                                                {plan.features.map((feature, idx) => (
                                                    <InlineStack key={idx} gap="200" blockAlign="start">
                                                        <Text as="span" tone="success">✓</Text>
                                                        <Text as="p" variant="bodySm">{feature}</Text>
                                                    </InlineStack>
                                                ))}
                                            </BlockStack>
                                        </Box>

                                        <Button
                                            variant={plan.highlighted && !plan.current ? "primary" : "secondary"}
                                            disabled={plan.buttonDisabled || isUpgrading}
                                            fullWidth
                                            loading={isUpgrading}
                                            onClick={() => {
                                                if (plan.action) {
                                                    plan.action();
                                                }
                                            }}
                                        >
                                            {plan.buttonText}
                                        </Button>
                                    </BlockStack>
                                </Card>
                            </Box>
                        ))}
                    </InlineStack>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap="300">
                            <Text as="h3" variant="headingMd">Frequently Asked Questions</Text>

                            <BlockStack gap="400">
                                <Box>
                                    <Text as="p" variant="bodyMd" fontWeight="semibold">How does billing work?</Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        You're charged your plan's monthly fee plus any overage fees ($0.10 per file beyond your limit).
                                        Billing happens automatically at the end of each month through Shopify.
                                    </Text>
                                </Box>

                                <Box>
                                    <Text as="p" variant="bodyMd" fontWeight="semibold">Can I change plans anytime?</Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        Yes! You can upgrade or downgrade at any time. Changes take effect immediately and billing is prorated.
                                    </Text>
                                </Box>

                                <Box>
                                    <Text as="p" variant="bodyMd" fontWeight="semibold">What happens if I exceed my limit?</Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        You'll automatically be charged $0.10 for each additional file. No interruption to your service.
                                        If you consistently exceed your limit, consider upgrading to save money!
                                    </Text>
                                </Box>

                                <Box>
                                    <Text as="p" variant="bodyMd" fontWeight="semibold">Is there a free trial?</Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        The Starter plan is free forever with 25 files/month. Paid plans (when activated) include a 14-day free trial.
                                    </Text>
                                </Box>
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
