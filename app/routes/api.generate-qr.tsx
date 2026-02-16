import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
// @ts-ignore
import * as JimpModule from "jimp";
import { trackMediaUpload, getShop } from "../services/usage-tracker.server";
import { authenticate } from "../shopify.server";

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";
const FONT_URL = "https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt";

// CORS Headers helper
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS requests (CORS preflight)
export const loader = async ({ request }: LoaderFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};

async function addCaptionToImage(buffer: Buffer, text: string, mimeType: string) {
    console.log("Adding caption:", text);
    try {
        // Robust Jimp loading
        // @ts-ignore
        const JimpClass = JimpModule.default || JimpModule.Jimp || JimpModule;

        if (!JimpClass || typeof JimpClass.read !== 'function') {
            console.error("CRITICAL: Jimp.read undefined", Object.keys(JimpModule));
            throw new Error("Jimp not loaded correctly");
        }

        const image = await JimpClass.read(buffer);

        // Determine font size
        const imageWidth = image.bitmap.width;
        let fontSize, fontConstantName, fontCDNUrl;

        if (imageWidth < 400) {
            fontSize = 16;
            fontConstantName = 'FONT_SANS_16_BLACK';
            fontCDNUrl = 'https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt';
        } else if (imageWidth < 800) {
            fontSize = 32;
            fontConstantName = 'FONT_SANS_32_BLACK';
            fontCDNUrl = 'https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-32-black/open-sans-32-black.fnt';
        } else if (imageWidth < 1600) {
            fontSize = 64;
            fontConstantName = 'FONT_SANS_64_BLACK';
            fontCDNUrl = 'https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-64-black/open-sans-64-black.fnt';
        } else {
            fontSize = 128;
            fontConstantName = 'FONT_SANS_128_BLACK';
            fontCDNUrl = 'https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-128-black/open-sans-128-black.fnt';
        }

        let font;
        try {
            const loadFont = JimpModule.loadFont || JimpClass.loadFont;
            // @ts-ignore
            const fontPath = JimpModule[fontConstantName] || JimpClass[fontConstantName];

            if (fontPath && typeof fontPath === 'string' && !fontPath.includes("MISSING")) {
                font = await loadFont(fontPath);
            } else {
                throw new Error(`Font constant ${fontConstantName} missing`);
            }
        } catch (fontError) {
            console.warn(`Local parsing failed, trying CDN: ${fontCDNUrl}`);
            const loadFont = JimpModule.loadFont || JimpClass.loadFont;
            font = await loadFont(fontCDNUrl);
        }

        const textHeight = Math.max(40, fontSize + 20);
        const newWidth = image.bitmap.width;
        const newHeight = image.bitmap.height + textHeight;

        // Measure text
        let textWidth = 0;
        try {
            const measureTextFn = JimpModule.measureText || JimpClass.measureText;
            // @ts-ignore
            textWidth = measureTextFn ? measureTextFn(font, text) : (text.length * fontSize * 0.6);
        } catch (e) {
            textWidth = text.length * fontSize * 0.6;
        }

        const textX = Math.max(0, (newWidth - textWidth) / 2);
        const textY = image.bitmap.height + ((textHeight - fontSize) / 2);

        // Create new image
        // @ts-ignore
        const JimpConstructor = JimpClass?.default || JimpClass;
        // @ts-ignore
        const newImage = new JimpConstructor(newWidth, newHeight, 0xFFFFFFFF);

        // @ts-ignore
        newImage.blit(image, 0, 0);

        // @ts-ignore
        newImage.print(font, textX, textY, {
            // @ts-ignore
            text: text
        });

        // @ts-ignore
        return await newImage.getBuffer(mimeType);

    } catch (e) {
        console.error("Caption Error:", e);
        return buffer;
    }
}

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        // Dynamic import for crypto
        const crypto = await import('crypto');
        const generateShortId = () => crypto.randomBytes(4).toString('hex');

        const body = await request.json();
        const { file, url, message, caption, fileType } = body;

        // Track media upload for billing (if shop domain is provided)
        // Priority: headers > body
        const shopDomain = request.headers.get('x-shop-domain') ||
            request.headers.get('shopDomain') ||
            body.shopDomain ||
            body.shop;

        console.log('[USAGE TRACKING] Request received. Shop domain:', shopDomain);

        // Feature Gating: Video & Audio - REMOVED per user request
        // All media types allowed on Free plan

        let targetContent = "";
        let fileUrl = "";
        let contentId = "";

        if (file) {
            let buffer = Buffer.from(file, 'base64');
            const fileMime = `image/${fileType || 'jpeg'}`;

            const shortId = generateShortId();
            contentId = shortId;
            const shortFilename = `${shortId}.${fileType || 'bin'}`;
            const s3Key = `uploads/${shortFilename}`;

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    Body: buffer,
                    ContentType: fileMime,
                    ACL: 'public-read',
                    Metadata: {
                        'caption-text': caption || '',
                        'has-caption': caption ? 'true' : 'false'
                    }
                })
            );

            fileUrl = `https://empowered-deal-app.vercel.app/v/${shortFilename}`;
            targetContent = fileUrl;

            if (shopDomain) {
                // Determine file type category
                let fileTypeCategory: "image" | "video" | "audio" | "document" = "image";
                if (['mp4', 'webm', 'mov', 'avi'].includes(fileType)) {
                    fileTypeCategory = "video";
                } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileType)) {
                    fileTypeCategory = "audio";
                } else if (['pdf', 'doc', 'docx', 'txt'].includes(fileType)) {
                    fileTypeCategory = "document";
                }

                console.log('[USAGE TRACKING] Tracking media upload for shop:', shopDomain);

                await trackMediaUpload({
                    shopDomain,
                    fileName: shortFilename,
                    fileType: fileTypeCategory,
                    s3Key,
                    fileSize: buffer.length,
                }).catch((err: unknown) => {
                    console.error('[USAGE TRACKING] Failed to track upload:', err);
                });
            } else {
                console.warn('[USAGE TRACKING] No shop domain found, skipping usage tracking');
            }

        } else if (url) {
            targetContent = url;

            // If it's one of our own uploaded files and we have a shop domain, track it!
            if (shopDomain && url.includes('vercel.app/v/')) {
                const urlObj = new URL(url);
                const filename = urlObj.pathname.split('/').pop() || 'file';
                const s3Key = `uploads/${filename}`;

                // Determine file type category from URL extension
                const ext = filename.split('.').pop()?.toLowerCase() || '';
                let fileTypeCategory: "image" | "video" | "audio" | "document" = "image";
                if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
                    fileTypeCategory = "video";
                } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
                    fileTypeCategory = "audio";
                } else if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
                    fileTypeCategory = "document";
                }

                console.log('[USAGE TRACKING] Tracking media upload (url) for shop:', shopDomain);

                await trackMediaUpload({
                    shopDomain,
                    fileName: filename,
                    fileType: fileTypeCategory,
                    s3Key,
                    fileSize: 0, // Approximate
                }).catch((err: unknown) => {
                    console.error('[USAGE TRACKING] Failed to track upload:', err);
                });
            }

            if (caption) {
                try {
                    const filename = url.split('/').pop();
                    const key = `uploads/${filename}`;
                    const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
                    await s3Client.send(new CopyObjectCommand({
                        Bucket: BUCKET_NAME,
                        CopySource: `${BUCKET_NAME}/${key}`,
                        Key: key,
                        MetadataDirective: 'REPLACE',
                        ContentType: fileType ? `image/${fileType}` : undefined,
                        ACL: 'public-read',
                        Metadata: {
                            'caption-text': caption,
                            'has-caption': 'true'
                        }
                    }));
                } catch (metaErr) {
                    console.error("Failed to update metadata:", metaErr);
                }
            }
        } else if (message) {
            targetContent = message;
        }

        if (!targetContent) {
            return Response.json({ error: "No content provided" }, { status: 400, headers: corsHeaders });
        }

        // Generate QR
        const qrShortId = contentId || generateShortId();
        const qrFilename = `q_${qrShortId}.png`;
        const qrS3Key = `qrcodes/${qrFilename}`;

        let qrBuffer = await QRCode.toBuffer(targetContent, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M'
        });

        if (caption) {
            qrBuffer = await addCaptionToImage(qrBuffer, caption, 'image/png');
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: qrS3Key,
                Body: qrBuffer,
                ContentType: "image/png",
                ACL: 'public-read',
                Metadata: {
                    'qr-target': targetContent,
                    'has-caption': caption ? 'true' : 'false',
                    'caption-text': caption || ''
                }
            })
        );

        const qrUrl = `https://empowered-deal-app.vercel.app/v/${qrFilename}`;

        return Response.json({
            status: "success",
            qr_url: qrUrl,
            file_url: fileUrl || targetContent,
        }, { headers: corsHeaders });

    } catch (err) {
        console.error("Upload Error:", err);
        return Response.json({
            error: "Failed to upload",
            details: (err as Error).message
        }, { status: 500, headers: corsHeaders });
    }
};
