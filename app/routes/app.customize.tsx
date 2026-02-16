import { authenticate } from "../shopify.server";

export const loader = async ({ request }: any) => {
    await authenticate.admin(request);
    return null;
};

const styles = {
    emptyState: {
        padding: '64px 24px',
        textAlign: 'center' as const,
        color: '#64748b',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '16px',
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        maxWidth: '600px',
        margin: '40px auto'
    }
};

export default function CustomizePage() {
    return (
        <s-page heading="Customize App Settings">
            <div style={styles.emptyState}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#cbd5e1' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>Coming Soon</h3>
                <p style={{ maxWidth: '400px' }}>
                    We're building a powerful editor to let you customize the look and feel of your gift pages.
                    Stay tuned for updates!
                </p>
            </div>
        </s-page>
    );
}
