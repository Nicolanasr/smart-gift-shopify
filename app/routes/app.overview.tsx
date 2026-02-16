import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: any) => {
    const { admin } = await authenticate.admin(request);

    let giftOrders: any[] = [];
    let error = "";

    try {
        const response = await admin.graphql(
            `#graphql
            query getOrdersWithGifts {
            orders(first: 50, sortKey: CREATED_AT, reverse: true) {
                edges {
                node {
                    id
                    name
                    createdAt
                    currencyCode
                    totalPriceSet {
                    shopMoney {
                        amount
                        currencyCode
                    }
                    }
                    lineItems(first: 50) {
                    edges {
                        node {
                        id
                        title
                        quantity
                        customAttributes {
                            key
                            value
                        }
                        }
                    }
                    }
                }
                }
            }
            }`
        );
        const responseJson = await response.json();
        if (responseJson.data?.orders?.edges) {
            const orders = responseJson.data.orders.edges.map((edge: any) => edge.node);
            giftOrders = orders.filter((order: any) =>
                order.lineItems.edges.some((item: any) =>
                    item.node.customAttributes.some((attr: any) =>
                        attr.key.includes("Gift")
                    )
                )
            );
        } else if ((responseJson as any).errors) {
            error = JSON.stringify((responseJson as any).errors);
        }
    } catch (err) {
        console.error("Overview: Error fetching orders", err);
        error = err instanceof Error ? err.message : "Error fetching data";
    }

    // Process Data for Analytics
    let totalGifts = 0;
    let totalRevenue = 0;
    let currency = 'USD';
    const giftTypes: Record<string, number> = {};
    const giftsByDate: Record<string, number> = {};

    giftOrders.forEach(order => {
        const orderDate = new Date(order.createdAt).toLocaleDateString();
        totalRevenue += parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
        currency = order.totalPriceSet?.shopMoney?.currencyCode || currency;

        order.lineItems.edges.forEach((edge: any) => {
            const item = edge.node;
            const isGift = item.customAttributes.some((attr: any) => attr.key.includes("Gift"));

            if (isGift) {
                // Determine Gift Type
                const typeAttr = item.customAttributes.find((attr: any) =>
                    attr.key === 'Gift Type' || attr.key === '_Gift Type'
                );

                // If the user considers "Standard" as "normal item" and not a gift option:
                // Only count items with a specific Gift Type
                if (typeAttr) {
                    const type = typeAttr.value;
                    totalGifts += item.quantity;
                    giftsByDate[orderDate] = (giftsByDate[orderDate] || 0) + item.quantity;
                    giftTypes[type] = (giftTypes[type] || 0) + item.quantity;
                }
            }
        });
    });

    // Find top gift type
    let topGiftType = 'N/A';
    let maxCount = 0;
    Object.entries(giftTypes).forEach(([type, count]) => {
        if (count > maxCount) {
            maxCount = count;
            topGiftType = type;
        }
    });

    return {
        stats: {
            totalGifts,
            totalRevenue: totalRevenue.toFixed(2),
            currency,
            topGiftType,
            giftTypes, // { Video: 5, Audio: 2 }
            totalOrders: giftOrders.length
        },
        error
    };
};

const styles = {
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px',
    },
    card: {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
    label: {
        fontSize: '13px',
        color: '#64748b',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        marginBottom: '8px',
        display: 'block',
    },
    value: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#0f172a',
    },
    subtext: {
        fontSize: '13px',
        color: '#94a3b8',
        marginTop: '4px',
    },
    sectionGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
    },
    chartContainer: {
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #e2e8f0',
    },
    chartTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#0f172a',
        marginBottom: '20px',
    },
    barRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px',
    },
    barLabel: {
        width: '100px',
        fontSize: '14px',
        color: '#475569',
        fontWeight: 500,
    },
    barTrack: {
        flex: 1,
        height: '8px',
        background: '#f1f5f9',
        borderRadius: '4px',
        overflow: 'hidden',
        margin: '0 12px',
    },
    barFill: (percent: number, color: string) => ({
        height: '100%',
        width: `${percent}%`,
        background: color,
        borderRadius: '4px',
        transition: 'width 0.5s ease-out',
    }),
    barValue: {
        width: '40px',
        textAlign: 'right' as const,
        fontSize: '14px',
        fontWeight: 600,
        color: '#0f172a',
    }
};

export default function AnalyticsPage() {
    const { stats, error } = useLoaderData<typeof loader>();

    const getTypeColor = (type: string) => {
        const map: Record<string, string> = {
            'Video': '#3b82f6', // Blue
            'Audio': '#8b5cf6', // Violet
            'Photo': '#ec4899', // Pink
            'Standard': '#64748b' // Slate
        };
        return map[type] || '#10b981'; // Default Green
    };

    return (
        <s-page heading="Analytics Overview">
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                {error && <s-banner tone="critical">{error}</s-banner>}

                {/* Top Metrics Grid */}
                <div style={styles.grid}>
                    <div style={styles.card}>
                        <span style={styles.label}>Total Gifts Sent</span>
                        <div style={styles.value}>{stats.totalGifts}</div>
                        <div style={styles.subtext}>Across {stats.totalOrders} orders</div>
                    </div>
                    <div style={styles.card}>
                        <span style={styles.label}>Revenue Impact</span>
                        <div style={styles.value}>{stats.currency} {stats.totalRevenue}</div>
                        <div style={styles.subtext}>From orders with gifts</div>
                    </div>
                    <div style={styles.card}>
                        <span style={styles.label}>Top Gift Type</span>
                        <div style={{ ...styles.value, color: getTypeColor(stats.topGiftType) }}>
                            {stats.topGiftType}
                        </div>
                        <div style={styles.subtext}>Most popular choice</div>
                    </div>
                    <div style={styles.card}>
                        <span style={styles.label}>Avg Gifts / Order</span>
                        <div style={styles.value}>
                            {stats.totalOrders > 0
                                ? (stats.totalGifts / stats.totalOrders).toFixed(1)
                                : '0'}
                        </div>
                        <div style={styles.subtext}>Items per checkout</div>
                    </div>
                </div>

                {/* Breakdown Section */}
                <div style={styles.sectionGrid}>
                    <div style={styles.chartContainer}>
                        <h3 style={styles.chartTitle}>Gift Type Distribution</h3>
                        {Object.keys(stats.giftTypes).length === 0 ? (
                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No data available yet</p>
                        ) : (
                            Object.entries(stats.giftTypes).map(([type, count]: [string, any]) => {
                                const percent = (count / stats.totalGifts) * 100;
                                return (
                                    <div key={type} style={styles.barRow}>
                                        <div style={styles.barLabel}>{type}</div>
                                        <div style={styles.barTrack}>
                                            <div style={styles.barFill(percent, getTypeColor(type))} />
                                        </div>
                                        <div style={styles.barValue}>{count}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div style={styles.chartContainer}>
                        <h3 style={styles.chartTitle}>Quick Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <a href="/app/files" style={{ textDecoration: 'none' }}>
                                <s-button>Manage Files</s-button>
                            </a>
                            <a href="/app/customize" style={{ textDecoration: 'none' }}>
                                <s-button variant="tertiary">Customize Page</s-button>
                            </a>
                        </div>
                        <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
                            Need help understanding these numbers? <a href="#" style={{ color: '#2563eb' }}>View Documentation</a>
                        </div>
                    </div>
                </div>
            </div>
        </s-page>
    );
}
