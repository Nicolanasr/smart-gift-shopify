import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
    { title: "Privacy Policy — Smart Gift" },
    { name: "description", content: "Privacy Policy for the Smart Gift Shopify App." },
];

export default function PrivacyPolicy() {
    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <h1 style={styles.h1}>Privacy Policy for Smart Gift</h1>
                <p style={styles.meta}>Effective Date: March 2026</p>

                <p><strong>Smart Gift</strong> ("we", "us", or "our") respects your privacy. This Privacy Policy describes how we collect, use, process, and share your information when you install our app ("App") in connection with your Shopify-supported store ("Store").</p>

                <h2 style={styles.h2}>Information the App Collects</h2>
                <p>When you install the App, we are automatically able to access certain types of information from your Shopify account:</p>
                <ul>
                    <li><strong>Store Information:</strong> Your shop domain, store name, and email address (used for App billing verification and support).</li>
                    <li><strong>Order Information:</strong> We request access to Shopify Orders to stitch uploaded digital gifts to successful purchases.</li>
                </ul>

                <h3 style={styles.h3}>Information Collected from Your Customers</h3>
                <p>Through the App Embed widget installed on your storefront, we collect information directly from your storefront visitors, which may include:</p>
                <ul>
                    <li><strong>Media Files:</strong> Video, Audio, and Image files uploaded by your customers to serve as digital or printed gifts.</li>
                    <li><strong>Text Data:</strong> Text messages and URLs inputted by the customer for printed cards or QR code generation.</li>
                    <li><strong>Metadata:</strong> Timestamps and generated QR Code URLs mapping back to the customer's uploaded media files.</li>
                </ul>

                <h2 style={styles.h2}>How We Use Your Information</h2>
                <ol>
                    <li><strong>Providing the Service:</strong> Generating custom QR codes, temporarily storing digital media files, and assigning them as Line Item Properties to your Shopify Orders.</li>
                    <li><strong>AWS S3 Storage &amp; Automated Cleanup:</strong> All customer media files are securely uploaded to our Amazon Web Services (AWS) S3 bucket. <strong>We automatically delete any media files from our servers after 14 days</strong> if they have not been attached to a successfully completed Shopify Order.</li>
                    <li><strong>Billing &amp; App Usage:</strong> We use your shop domain to track the total volume of media files processed each billing cycle to manage App usage limits.</li>
                </ol>

                <h2 style={styles.h2}>Information Sharing</h2>
                <p>We do not sell your personal information or your customers' data. We may share your information in the following circumstances:</p>
                <ul>
                    <li><strong>Service Providers:</strong> We share data with third-party service providers including Cloud Hosting Providers (Vercel) and Storage Providers (Amazon Web Services).</li>
                    <li><strong>Legal Compliance:</strong> We may share data to comply with applicable laws and regulations or to otherwise protect our rights.</li>
                </ul>

                <h2 style={styles.h2}>Your Rights (GDPR &amp; CCPA)</h2>
                <p>If you are a European resident or a resident of California, you have the right to access personal information we hold about you and to ask that your personal information be corrected, updated, or deleted.</p>
                <ul>
                    <li><strong>Merchants:</strong> If you uninstall the App, we will automatically receive a webhook from Shopify to permanently redact your Shop record and usage statistics from our database.</li>
                    <li><strong>Customers — Data Requests:</strong> If a customer files a GDPR Data Request via your Shopify Admin, we will acknowledge the webhooks. We only hold anonymized short-IDs linked to Media Files, not Customer PII.</li>
                    <li><strong>Customers — Redaction Requests:</strong> If a customer requests data deletion through your Shopify Admin, we acknowledge the <code>customers/redact</code> webhook.</li>
                </ul>

                <h2 style={styles.h2}>Changes &amp; Contact Us</h2>
                <p>We may update this privacy policy from time to time to reflect changes to our practices or for other operational, legal, or regulatory reasons.</p>
                <p>For questions or complaints, please contact us at: <a href="mailto:hello@smartgift.live" style={styles.link}>hello@smartgift.live</a></p>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    container: {
        maxWidth: "760px",
        margin: "0 auto",
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "48px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        lineHeight: 1.7,
        color: "#334155",
    },
    h1: {
        fontSize: "28px",
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: "4px",
    },
    h2: {
        fontSize: "20px",
        fontWeight: 600,
        color: "#0f172a",
        marginTop: "36px",
        marginBottom: "12px",
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: "8px",
    },
    h3: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#334155",
        marginTop: "24px",
    },
    meta: {
        color: "#94a3b8",
        fontSize: "14px",
        marginBottom: "24px",
    },
    link: {
        color: "#2563eb",
        textDecoration: "none",
    },
};
