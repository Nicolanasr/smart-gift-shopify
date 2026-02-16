import { Link } from "react-router";

interface UsageWidgetProps {
    usage: {
        mediaFilesUsed: number;
        freeLimit: number;
        overage: number;
        usageFee: number;
        plan: string;
        isBetaUser: boolean;
    };
}

export function UsageWidget({ usage }: UsageWidgetProps) {
    const usagePercentage = Math.min(100, (usage.mediaFilesUsed / usage.freeLimit) * 100);
    const isNearLimit = usagePercentage > 80;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>📊 Usage This Month</h3>
                <span style={{
                    ...styles.badge,
                    backgroundColor: usage.isBetaUser ? '#4CAF50' : usage.plan === 'pro' ? '#2196F3' : '#9E9E9E'
                }}>
                    {usage.isBetaUser ? 'Beta - Free Forever' : usage.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
            </div>

            <div style={styles.stats}>
                <div style={styles.statRow}>
                    <span style={styles.label}>Media Files</span>
                    <span style={styles.value}>{usage.mediaFilesUsed} / {usage.freeLimit}</span>
                </div>

                <div style={styles.progressContainer}>
                    <div style={{
                        ...styles.progressBar,
                        width: `${usagePercentage}%`,
                        backgroundColor: isNearLimit ? '#FF9800' : '#4CAF50'
                    }} />
                </div>

                {usage.overage > 0 && (
                    <div style={{ ...styles.alert, backgroundColor: '#FFF3E0', borderLeft: '4px solid #FF9800' }}>
                        <strong>{usage.overage} extra files</strong>
                        {!usage.isBetaUser && <span> • ${usage.usageFee.toFixed(2)} overage</span>}
                    </div>
                )}

                {isNearLimit && usage.overage === 0 && (
                    <div style={{ ...styles.alert, backgroundColor: '#FFF9C4', borderLeft: '4px solid #FFC107' }}>
                        You're approaching your monthly limit
                    </div>
                )}
            </div>

            <Link to="/app/billing" style={styles.link}>
                View Plans & Usage →
            </Link>
        </div>
    );
}

const styles = {
    container: {
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    } as const,
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    } as const,
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
    } as const,
    badge: {
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'white',
    } as const,
    stats: {
        marginBottom: '12px',
    } as const,
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
    } as const,
    label: {
        color: '#666',
        fontSize: '14px',
    } as const,
    value: {
        fontWeight: 600,
        fontSize: '14px',
    } as const,
    progressContainer: {
        width: '100%',
        height: '8px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '12px',
    } as const,
    progressBar: {
        height: '100%',
        transition: 'width 0.3s ease',
    } as const,
    alert: {
        padding: '10px 12px',
        borderRadius: '4px',
        fontSize: '13px',
        marginTop: '12px',
    } as const,
    link: {
        display: 'inline-block',
        color: '#2196F3',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        marginTop: '8px',
    } as const,
};
