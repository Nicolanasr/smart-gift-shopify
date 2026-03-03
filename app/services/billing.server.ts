import { updateShopPlan } from "./usage-tracker.server";

interface PlanConfig {
  name: string;
  price: number;
  trialDays: number;
}

const PLAN_CONFIGS: Record<"pro-gifting" | "automation-plus", PlanConfig> = {
  "pro-gifting": {
    name: "Pro Gifting",
    price: 14.99,
    trialDays: 14,
  },
  "automation-plus": {
    name: "Automation Plus",
    price: 79.00,
    trialDays: 14,
  },
};

/**
 * Create a new Shopify app subscription
 */
export async function createSubscription(
  admin: any,
  shopDomain: string,
  plan: "pro-gifting" | "automation-plus",
  appUrl: string
) {
  const config = PLAN_CONFIGS[plan];
  
  const response = await admin.graphql(
    `#graphql
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          trialDays: $trialDays
          lineItems: $lineItems
          test: $test
        ) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            status
          }
        }
      }`,
    {
      variables: {
        name: config.name,
        returnUrl: `${appUrl}/app/billing/callback?shop=${shopDomain}`,
        trialDays: config.trialDays,
        test: true,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: config.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
          {
            plan: {
              appUsagePricingDetails: {
                cappedAmount: { amount: 100, currencyCode: "USD" },
                terms: "$0.10 per media file beyond plan limit",
              },
            },
          },
        ],
      },
    }
  );
  
  const data = await response.json();
  
  if (data.data?.appSubscriptionCreate?.userErrors?.length > 0) {
    const error = data.data.appSubscriptionCreate.userErrors[0];
    throw new Error(`Shopify billing error: ${error.message}`);
  }
  
  return {
    confirmationUrl: data.data?.appSubscriptionCreate?.confirmationUrl,
    subscriptionId: data.data?.appSubscriptionCreate?.appSubscription?.id,
  };
}

/**
 * Create a usage charge for overage files
 */
export async function createUsageCharge(
  admin: any,
  subscriptionLineItemId: string,
  amount: number,
  filesCount: number,
  month: string
) {
  const description = `${filesCount} extra media files for ${month}`;
  
  const response = await admin.graphql(
    `#graphql
      mutation AppUsageRecordCreate($subscriptionLineItemId: ID!, $price: MoneyInput!, $description: String!) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          price: $price
          description: $description
          test: true
        ) {
          userErrors {
            field
            message
          }
          appUsageRecord {
            id
            price {
              amount
              currencyCode
            }
          }
        }
      }`,
    {
      variables: {
        subscriptionLineItemId,
        price: { amount, currencyCode: "USD" },
        description,
      },
    }
  );
  
  const data = await response.json();
  
  if (data.data?.appUsageRecordCreate?.userErrors?.length > 0) {
    const error = data.data.appUsageRecordCreate.userErrors[0];
    throw new Error(`Usage charge error: ${error.message}`);
  }
  
  return data.data?.appUsageRecordCreate?.appUsageRecord;
}

/**
 * Check if shop has an active subscription
 */
export async function getActiveSubscription(admin: any) {
  const response = await admin.graphql(
    `#graphql
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            lineItems {
              id
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                  }
                  ... on AppUsagePricing {
                    cappedAmount {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }`
  );
  
  const data = await response.json();
  return data.data?.currentAppInstallation?.activeSubscriptions?.[0] || null;
}

/**
 * Cancel an active subscription
 */
export async function cancelSubscription(admin: any, subscriptionId: string) {
  const response = await admin.graphql(
    `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }`,
    {
      variables: {
        id: subscriptionId,
      },
    }
  );
  
  const data = await response.json();
  
  if (data.data?.appSubscriptionCancel?.userErrors?.length > 0) {
    const error = data.data.appSubscriptionCancel.userErrors[0];
    throw new Error(`Cancel subscription error: ${error.message}`);
  }
  
  return data.data?.appSubscriptionCancel?.appSubscription;
}
