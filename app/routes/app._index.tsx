import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: any) => {
    const { admin } = await authenticate.admin(request);

    // 1. Fetch Orders Logic
    let giftOrders = [];
    let error = "";
    try {
        const response = await admin.graphql(
            `#graphql
            query getOrdersWithGifts {
            orders(first: 20, sortKey: CREATED_AT, reverse: true) {
                edges {
                node {
                    id
                    name
                    createdAt
                    currencyCode
                    totalPriceSet {
                    shopMoney {
                        amount
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
            console.error("GraphQL Errors:", (responseJson as any).errors);
        }
    } catch (err) {
        console.error("Dashboard: Error fetching orders", err);
        error = err instanceof Error ? err.message : "Checking permissions...";
    }

    return { giftOrders, error };
};

// Styles
const styles = {
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
    },
    statCard: {
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column' as const,
    },
    statLabel: {
        fontSize: '14px',
        color: '#64748b',
        fontWeight: 500,
        marginBottom: '8px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    statValue: {
        fontSize: '32px',
        color: '#0f172a',
        fontWeight: 700,
        letterSpacing: '-0.02em',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
    },
    th: {
        textAlign: 'left' as const,
        padding: '16px 24px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        color: '#64748b',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        letterSpacing: '0.05em',
    },
    td: {
        padding: '20px 24px',
        fontSize: '14px',
        color: '#334155',
        borderBottom: '1px solid #f1f5f9',
        verticalAlign: 'middle' as const,
    },
    row: {
        transition: 'background-color 0.1s ease',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        background: '#e0f2fe',
        color: '#0369a1',
        border: '1px solid #bae6fd',
    },
    link: {
        color: '#2563eb',
        textDecoration: 'none',
        fontWeight: 500,
        transition: 'color 0.2s',
    },
    card: {
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        overflow: 'hidden',
    },
    emptyState: {
        padding: '64px 24px',
        textAlign: 'center' as const,
        color: '#64748b',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '16px',
    }
};

export default function Dashboard() {
    const { giftOrders, error } = useLoaderData<typeof loader>();

    return (
        <s-page heading="Dashboard Overview">
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                {error && (
                    <div style={{ marginBottom: '24px' }}>
                        <s-banner tone="critical">
                            {error}
                        </s-banner>
                    </div>
                )}

                {/* Stats Section */}
                <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Active Gift Orders</span>
                        <span style={styles.statValue}>{giftOrders.length}</span>
                    </div>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Pending Processing</span>
                        <span style={styles.statValue}>-</span>
                    </div>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Total Value</span>
                        <span style={styles.statValue}>-</span>
                    </div>
                </div>

                {/* Main Content */}
                <div style={styles.card}>
                    {giftOrders.length === 0 ? (
                        <div style={styles.emptyState}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                                <path d="m3.3 7 8.7 5 8.7-5"></path>
                                <path d="M12 22V12"></path>
                            </svg>
                            <p>No recent gift orders found.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Order</th>
                                        <th style={styles.th}>Date</th>
                                        <th style={styles.th}>Item</th>
                                        <th style={styles.th}>Gift Details</th>
                                        <th style={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {giftOrders.map((order: any, i: number) => {
                                        const giftItems = order.lineItems.edges
                                            .map((e: any) => e.node)
                                            .filter((item: any) =>
                                                item.customAttributes.some((attr: any) => attr.key.includes('Gift'))
                                            );

                                        return giftItems.map((item: any, index: any) => {
                                            const props: any = {};
                                            item.customAttributes.forEach((attr: any) => props[attr.key] = attr.value);
                                            const qrUrl = props['_Gift QR Code'] || props['Gift QR Code'];
                                            const giftType = props['_Gift Type'] || props['Gift Type'];
                                            const contentUrl = props['_Gift File'] || props['_Gift Audio'] || props['_Gift Video'];

                                            return (
                                                <tr key={`${order.id}-${item.id}`} style={{ ...styles.row, background: i % 2 === 0 ? 'white' : '#fff' }}>
                                                    {index === 0 && (
                                                        <>
                                                            <td rowSpan={giftItems.length} style={styles.td}>
                                                                <a href={`shopify:admin/orders/${order.id.split('/').pop()}`} style={styles.link}>
                                                                    {order.name}
                                                                </a>
                                                            </td>
                                                            <td rowSpan={giftItems.length} style={styles.td}>
                                                                <span style={{ color: '#64748b' }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                                                            </td>
                                                        </>
                                                    )}
                                                    <td style={styles.td}>
                                                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Qty: {item.quantity}</div>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <span style={styles.badge}>{giftType || 'Standard'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            {qrUrl && <a href={qrUrl} target="_blank" style={styles.link}>QR Code</a>}
                                                            {contentUrl && <a href={contentUrl} target="_blank" style={styles.link}>Content</a>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </s-page>
    );
}
