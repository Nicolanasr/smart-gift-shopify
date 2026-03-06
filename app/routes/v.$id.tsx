
import { useLoaderData, MetaFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

export const meta: MetaFunction = () => {
    return [
        { title: "You received a Gift!" },
        { name: "description", content: "Someone sent you a special digital gift." },
    ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { id } = params;

    if (!id) {
        throw new Response("Not Found", { status: 404 });
    }

    // Determine if this is a QR code management view or a Gift Unboxing view
    const isQrCode = id.startsWith("q_");

    // Construct public S3 URL (or use our new API proxy)
    // using api/view ensures consistent behavior with metadata
    const fileUrl = `/api/view?file=${id}`;

    // Fetch Metadata for Caption
    let captionText = "";
    try {
        const s3Client = new S3Client({
            region: process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
        const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";

        let key = "";
        if (id.startsWith("q_")) {
            key = `qrcodes/${id}`;
        } else {
            key = `uploads/${id}`;
        }

        const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
        const metadata = await s3Client.send(command);

        if (metadata.Metadata && metadata.Metadata['caption-text']) {
            captionText = metadata.Metadata['caption-text'];
        }
    } catch (e) {
        console.error("Failed to fetch metadata:", e);
    }

    // Determine type by extension
    const ext = id.split('.').pop()?.toLowerCase() || '';
    const type = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'image'
        : ['mp4', 'webm', 'mov'].includes(ext) ? 'video'
            : ['mp3', 'wav', 'ogg'].includes(ext) ? 'audio'
                : 'file';

    return { fileUrl, type, id, isQrCode, captionText };
};

export default function Unboxing() {
    const { fileUrl, type, id, isQrCode, captionText } = useLoaderData<typeof loader>();
    const [qrSize, setQrSize] = useState(400);

    // QR Management View
    if (isQrCode) {
        const qrSrc = `/api/view?file=${id}&raw=true&size=${qrSize}`;
        const downloadLink = `/api/view?file=${id}&download=true&size=${qrSize}`;

        return (
            <div style={qrStyles.container}>
                <div style={qrStyles.card}>
                    <div style={qrStyles.imageWrapper} className="qr-image-wrapper">
                        <img src={qrSrc} alt="QR Code" style={qrStyles.image} />
                    </div>

                    <div style={qrStyles.controls}>
                        <label htmlFor="size-select" style={qrStyles.label}>QR Code Size:</label>
                        <select
                            id="size-select"
                            value={qrSize}
                            onChange={(e) => setQrSize(Number(e.target.value))}
                            style={qrStyles.select}
                        >
                            <option value="200">Small (200px)</option>
                            <option value="400">Medium (400px - Default)</option>
                            <option value="600">Large (600px)</option>
                            <option value="800">Extra Large (800px)</option>
                            <option value="1000">Jumbo (1000px)</option>
                        </select>
                        <div style={qrStyles.info}>
                            Select size for download/print. Higher resolutions work best for distant scanning.
                        </div>
                    </div>

                    <div style={qrStyles.actions}>
                        <button onClick={() => window.print()} style={{ ...qrStyles.btn, ...qrStyles.btnSecondary }}>
                            Print QR Code
                        </button>
                        <a href={downloadLink} style={qrStyles.btn}>
                            Download File
                        </a>
                    </div>

                    <div style={qrStyles.footer}>Smart Gift</div>
                </div>
                <style>{`
                    @media print {
                        /* Hide everything except the QR code image */
                        body * {
                            visibility: hidden;
                        }
                        .qr-image-wrapper, .qr-image-wrapper * {
                            visibility: visible;
                        }
                        .qr-image-wrapper {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                            box-shadow: none !important;
                            border: none !important;
                        }
                    }
                `}</style>
            </div>
        );
    }

    // Standard Gift Unboxing View
    useEffect(() => {
        // Trigger confetti on mount
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#ff0', '#f00', '#0f0', '#00f', '#f0f', '#0ff']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#ff0', '#f00', '#0f0', '#00f', '#f0f', '#0ff']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }, []);

    return (
        <div style={styles.container}>
            <style>{css}</style>

            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.icon}>🎁</div>
                    <h1 style={styles.title}>You have a Gift!</h1>
                    {captionText && <p style={styles.subtitle}>{captionText}</p>}
                </div>

                <div style={styles.content}>
                    {type === 'video' ? (
                        <video controls autoPlay playsInline style={styles.media}>
                            <source src={`/api/view?file=${id}&raw=true`} />
                            Your browser does not support video.
                        </video>
                    ) : type === 'image' ? (
                        <img src={`/api/view?file=${id}&raw=true`} alt="Gift" style={styles.media} />
                    ) : type === 'audio' ? (
                        <div style={styles.audioWrapper}>
                            <div style={styles.audioIcon}>🎵</div>
                            <audio controls autoPlay style={{ width: '100%' }}>
                                <source src={`/api/view?file=${id}&raw=true`} />
                                Your browser does not support audio.
                            </audio>
                        </div>
                    ) : (
                        <div style={styles.fileWrapper}>
                            <p>This gift is a file.</p>
                            <a href={`/api/view?file=${id}&download=true`} style={styles.button}>Download File</a>
                        </div>
                    )}
                </div>

                <div style={styles.actions}>
                    <a href={`/api/view?file=${id}&download=true`} style={styles.btnSave} title="Save File">
                        <span>⬇️ Save</span>
                    </a>
                </div>

                <div style={styles.socialShare}>
                    <p style={styles.shareLabel}>Share this moment</p>
                    <div style={styles.socialButtons}>
                        <button onClick={() => {
                            const url = window.location.href;
                            const shareText = captionText
                                ? `${captionText} ❤️ Just received this special gift - you can send yours too with Smart Gift!`
                                : `Someone just made my day with this thoughtful surprise 🎁 Send your own special moments with Smart Gift`;
                            window.open('https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + url), '_blank');
                        }} style={{ ...styles.socialBtn, ...styles.whatsapp }} title="Share on WhatsApp">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                        </button>
                        <button onClick={() => {
                            const url = window.location.href;
                            window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent('Just received an amazing surprise gift! 🎁✨ Create your own special moments with Smart Gift'), '_blank');
                        }} style={{ ...styles.socialBtn, ...styles.facebook }} title="Share on Facebook">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.797 1.606-2.797 2.87v1.101h4.188l-.582 3.667h-3.606v7.98H9.101z" /></svg>
                        </button>
                        <button onClick={() => {
                            const url = window.location.href;
                            const shareText = captionText
                                ? `${captionText} ❤️ This thoughtful gift made my day! Create yours with Smart Gift`
                                : `Wow! Someone just surprised me with something special 🎁✨ Send your own with Smart Gift`;
                            window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(url), '_blank');
                        }} style={{ ...styles.socialBtn, ...styles.twitter }} title="Share on X">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        </button>
                        <button onClick={async () => {
                            const url = window.location.href;
                            const shareText = captionText
                                ? `${captionText} ❤️`
                                : `Someone just made my day with this thoughtful gift! 🎁✨`;
                            if (navigator.share) {
                                try {
                                    await navigator.share({ title: 'Special Gift Received', text: shareText + '\n\nSent with ❤️ using Smart Gift', url });
                                } catch (err) { console.log('Share canceled'); }
                            } else {
                                alert('Sharing not supported on this device. Copy the link instead!');
                            }
                        }} style={{ ...styles.socialBtn, ...styles.instagram }} title="Share to Instagram/More">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        </button>
                        <button onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(window.location.href);
                                alert('Link copied to clipboard!');
                            } catch (err) {
                                alert('Failed to copy. Please copy the URL manually.');
                            }
                        }} style={{ ...styles.socialBtn, ...styles.copy }} title="Copy Link">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                        </button>
                    </div>
                </div>

                <div style={styles.footer}>
                    <p>Powered by <a href="https://smartgift.live/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Smart Gift</a></p>
                </div>
            </div>
        </div>
    );
}

const qrStyles = {
    container: {
        fontFamily: '-apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '20px',
    },
    card: {
        background: 'white',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        textAlign: 'center' as const,
        maxWidth: '90%',
        width: '400px',
    },
    imageWrapper: {
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '200px',
    },
    image: {
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
    },
    controls: {
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        textAlign: 'left' as const,
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: 600,
        color: '#374151',
        fontSize: '0.875rem',
    },
    select: {
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        background: 'white',
        marginBottom: '0.5rem',
    },
    info: {
        fontSize: '0.75rem',
        color: '#6b7280',
    },
    actions: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
    },
    btn: {
        display: 'inline-block',
        background: '#111827',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    btnSecondary: {
        background: '#e5e7eb',
        color: '#111827',
    },
    footer: {
        marginTop: '1rem',
        color: '#6b7280',
        fontSize: '0.875rem',
    }
};

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%)', // Premium dark elegant
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: 'white',
        fontFamily: '-apple-system, sans-serif',
        overflow: 'hidden',
        position: 'relative' as const,
    },
    card: {
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.2)',
        textAlign: 'center' as const,
        zIndex: 10,
        animation: 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    header: {
        marginBottom: '24px',
    },
    icon: {
        fontSize: '48px',
        marginBottom: '16px',
        animation: 'bounce 2s infinite',
    },
    title: {
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '8px',
        background: 'linear-gradient(to right, #fff, #ffd700)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        fontSize: '16px',
        opacity: 0.8,
    },
    content: {
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '24px',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    media: {
        width: '100%',
        height: 'auto',
        display: 'block',
        maxHeight: '600px',
    },
    audioWrapper: {
        padding: '32px',
        width: '100%',
    },
    audioIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    fileWrapper: {
        padding: '40px',
    },
    button: {
        display: 'inline-block',
        background: 'white',
        color: '#4a192c',
        padding: '12px 24px',
        borderRadius: '99px',
        textDecoration: 'none',
        fontWeight: 600,
        marginTop: '16px',
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        marginTop: '24px',
    },
    btnSave: {
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.15)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '99px',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '14px',
        transition: 'all 0.2s',
        border: '1px solid rgba(255,255,255,0.2)',
    },
    socialShare: {
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    shareLabel: {
        fontSize: '14px',
        opacity: 0.7,
        marginBottom: '16px',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
    },
    socialButtons: {
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        flexWrap: 'wrap' as const,
        paddingBottom: '20px',
    },
    socialBtn: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        color: 'white',
        background: 'rgba(255,255,255,0.1)',
    },
    whatsapp: { background: '#25D366' },
    facebook: { background: '#1877F2' },
    twitter: { background: '#1DA1F2' },
    instagram: { background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' },
    copy: { background: '#555' },
    footer: {
        marginTop: '32px',
        fontSize: '12px',
        opacity: 0.6,
    }
};

const css = `
@keyframes slideUp {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
`;
