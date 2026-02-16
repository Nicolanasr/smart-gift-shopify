import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { listFiles, deleteFile, listQRCodes } from "../s3.server";

interface S3File {
    key: string;
    lastModified: Date;
    size: number;
    url: string;
    qrUrl?: string;
}

export const loader = async ({ request }: any) => {
    const { admin } = await authenticate.admin(request);

    let files: S3File[] = [];
    let totalSize = 0;

    try {
        const [s3Files, qrCodes] = await Promise.all([
            listFiles(),
            listQRCodes()
        ]);

        files = s3Files.map((f: any) => {
            const filename = f.Key.replace('uploads/', '');
            const fileId = filename.split('.')[0];
            const vercelUrl = `https://empowered-deal-app.vercel.app/v/${filename}`;

            const qrMatch = (qrCodes as any[]).find((q: any) => q && q.target === vercelUrl);

            const qrCodeUrl = qrMatch
                ? `https://empowered-deal-app.vercel.app/v/${qrMatch.key.replace('qrcodes/', '')}`
                : `https://empowered-deal-app.vercel.app/v/q_${fileId}.png`;

            return {
                key: f.Key,
                lastModified: f.LastModified,
                size: f.Size,
                url: vercelUrl,
                qrUrl: qrCodeUrl
            };
        }).sort((a: any, b: any) => b.lastModified - a.lastModified);
        totalSize = files.reduce((acc: number, f: S3File) => acc + (f.size || 0), 0);
    } catch (e) {
        console.error("Failed to list files", e);
    }

    return { files, totalSize };
};

export const action = async ({ request }: any) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete_file") {
        const key = formData.get("key");
        if (key) {
            try {
                await deleteFile(key.toString());
                return { success: true, message: `Deleted ${key}` };
            } catch (error) {
                return { success: false, error: "Failed to delete file" };
            }
        }
    }
    return null;
};

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

export default function FilesPage() {
    const { files, totalSize } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <s-page heading="Uploaded Files">
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
                <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Uploaded Files</span>
                        <span style={styles.statValue}>{files.length}</span>
                    </div>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Storage Used</span>
                        <span style={styles.statValue}>{formatBytes(totalSize)}</span>
                    </div>
                    <div style={styles.statCard}>
                        <span style={styles.statLabel}>Bandwidth</span>
                        <span style={{ ...styles.statValue, color: '#10b981' }}>Healthy</span>
                    </div>
                </div>

                <div style={styles.card}>
                    {files.length === 0 ? (
                        <div style={styles.emptyState}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <p>No files uploaded yet.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Filename</th>
                                        <th style={styles.th}>Size</th>
                                        <th style={styles.th}>Modified</th>
                                        <th style={styles.th}>Links</th>
                                        <th style={styles.th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map((file: any) => (
                                        <tr key={file.key} style={styles.row}>
                                            <td style={{ ...styles.td, fontWeight: 500 }}>
                                                {file.key.replace('uploads/', '')}
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {formatBytes(file.size)}
                                                </span>
                                            </td>
                                            <td style={styles.td}><span style={{ color: '#64748b' }}>{new Date(file.lastModified).toLocaleString()}</span></td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <a href={file.url} target="_blank" style={styles.link}>View File</a>
                                                    <a href={file.qrUrl} target="_blank" style={styles.link}>View QR</a>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <fetcher.Form method="post">
                                                    <input type="hidden" name="intent" value="delete_file" />
                                                    <input type="hidden" name="key" value={file.key} />
                                                    <s-button type="submit" variant="primary" tone="critical" disabled={fetcher.state !== "idle"}>
                                                        Delete
                                                    </s-button>
                                                </fetcher.Form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </s-page>
    );
}
