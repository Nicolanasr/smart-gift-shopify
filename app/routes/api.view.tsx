import { LoaderFunctionArgs } from "react-router";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
// @ts-ignore
import * as JimpModule from "jimp";

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Helper: Add Caption (cloned from api.generate-qr.tsx for self-contained route)
async function addCaptionToImage(buffer: Buffer, text: string) {
    try {
        // @ts-ignore
        const JimpClass = JimpModule.default || JimpModule.Jimp || JimpModule;
        const image = await JimpClass.read(buffer);

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
                throw new Error("Font constant missing");
            }
        } catch (fontError) {
            const loadFont = JimpModule.loadFont || JimpClass.loadFont;
            font = await loadFont(fontCDNUrl);
        }

        // Calculate max width for wrapping text
        const paddingLeftRight = 40;
        const maxWidth = Math.max(image.bitmap.width - paddingLeftRight, 100);

        // Measure true text height considering wraps
        let textHeight = 0;
        try {
            const measureTextHeightFn = JimpModule.measureTextHeight || JimpClass.measureTextHeight;
            // @ts-ignore
            textHeight = measureTextHeightFn ? measureTextHeightFn(font, text, maxWidth) : Math.max(40, fontSize + 20);
        } catch (e) {
            textHeight = Math.max(40, fontSize + 20);
        }

        const paddingTop = 20;
        const paddingBottom = 20;
        const newWidth = image.bitmap.width;
        const newHeight = image.bitmap.height + textHeight + paddingTop + paddingBottom;

        // Create new image
        // @ts-ignore
        const JimpConstructor = JimpClass?.default || JimpClass;
        // @ts-ignore
        const newImage = new JimpConstructor({ width: newWidth, height: newHeight, color: 0xFFFFFFFF });

        // @ts-ignore
        newImage.blit({ src: image, x: 0, y: 0 });

        // @ts-ignore
        newImage.print({
            font,
            x: Math.floor(paddingLeftRight / 2),
            y: image.bitmap.height + paddingTop,
            text: {
                text: text,
                alignmentX: 2, // HORIZONTAL_ALIGN_CENTER
                alignmentY: 8  // VERTICAL_ALIGN_TOP
            },
            maxWidth: maxWidth
        });

        // @ts-ignore
        return await newImage.getBuffer('image/png');
    } catch (e) {
        console.error("Caption Error:", e);
        return buffer;
    }
}


export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const file = url.searchParams.get("file");
    const raw = url.searchParams.get("raw");
    const download = url.searchParams.get("download");
    const size = url.searchParams.get("size");
    const caption = url.searchParams.get("caption");

    if (!file) {
        return new Response("File not specified", { status: 400 });
    }

    let key = "";
    if (file.startsWith("q_")) {
        key = `qrcodes/${file}`;
    } else {
        key = `uploads/${file}`;
    }

    const s3Url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    // Mode 1: QR Regeneration (if size is specified and it's a QR code)
    if (size && file.startsWith("q_")) {
        try {
            const headCommand = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const metadata = await s3Client.send(headCommand);

            const qrTarget = metadata.Metadata?.['qr-target'];
            const hasCaption = metadata.Metadata?.['has-caption'] === 'true';
            const captionText = metadata.Metadata?.['caption-text'] || '';

            if (!qrTarget) {
                // Fallback to S3 redirect if strict metadata is missing
                return Response.redirect(s3Url, 307);
            }

            const qrSize = parseInt(size) || 400;
            let qrBuffer = await QRCode.toBuffer(qrTarget, {
                width: qrSize,
                margin: 2,
                errorCorrectionLevel: 'M'
            });

            if (hasCaption && captionText) {
                qrBuffer = await addCaptionToImage(qrBuffer, captionText);
            }

            // Return Generated Image
            const headers = new Headers();
            headers.set("Content-Type", "image/png");
            if (download === 'true') {
                headers.set("Content-Disposition", `attachment; filename="${file}"`);
            }
            return new Response(qrBuffer as unknown as BodyInit, { headers });

        } catch (err) {
            console.error("QR Regeneration Error:", err);
            // Fallback to S3 redirect
            return Response.redirect(s3Url, 307);
        }
    }

    // Mode 2: Raw Redirect
    // If raw=true and NOT regenerating QR (checked above), logic suggests redirect is best for performance
    if (raw === 'true') {
        return Response.redirect(s3Url, 307);
    }

    // Mode 3: Download Proxy (Streaming from S3)
    if (download === 'true') {
        try {
            // Check metadata first to see if we need to watermark images on-download
            const headCommand = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const metadata = await s3Client.send(headCommand);
            const hasCaption = metadata.Metadata?.['has-caption'] === 'true';
            const captionText = metadata.Metadata?.['caption-text'] || '';

            const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const response = await s3Client.send(command);
            const contentType = response.ContentType || 'application/octet-stream';

            const headers = new Headers();
            headers.set("Content-Type", contentType);
            headers.set("Content-Disposition", `attachment; filename="${file}"`);

            // If it's an image and has a caption, we MUST burn the caption in before downloading
            if (hasCaption && captionText && contentType.startsWith('image/')) {
                const streamToBuffer = async (stream: any) => {
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    return Buffer.concat(chunks);
                };

                let fileBuffer = await streamToBuffer(response.Body);
                fileBuffer = await addCaptionToImage(fileBuffer, captionText);
                return new Response(fileBuffer as unknown as BodyInit, { headers });
            }

            // Normal Streaming Fallback for video, audio, or no-caption
            // @ts-ignore - ReadableStream/Node Stream mismatch handled by Remix usually
            return new Response(response.Body, { headers });
        } catch (e) {
            console.error("Download Error:", e);
            return new Response("Error downloading file", { status: 500 });
        }
    }

    // Default Fallback
    return Response.redirect(s3Url, 307);
};
