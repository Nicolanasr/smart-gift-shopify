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

        const textHeight = Math.max(40, fontSize + 20);
        const newWidth = image.bitmap.width;
        const newHeight = image.bitmap.height + textHeight;

        let textWidth = 0;
        try {
            const measureTextFn = JimpModule.measureText || JimpClass.measureText;
            // @ts-ignore
            textWidth = measureTextFn ? measureTextFn(font, text) : (text.length * fontSize * 0.6);
        } catch (e) {
            textWidth = text.length * fontSize * 0.6;
        }

        const centerX = Math.floor((newWidth - textWidth) / 2);
        const centerY = image.bitmap.height + Math.floor((textHeight - fontSize) / 2);

        let newImage;
        try {
            // @ts-ignore
            newImage = new JimpClass({ width: newWidth, height: newHeight, color: 0xFFFFFFFF });
        } catch (e) {
            // @ts-ignore
            newImage = await JimpClass.create(newWidth, newHeight, 0xFFFFFFFF);
        }

        newImage.composite(image, 0, 0);
        newImage.print({
            font: font,
            x: Math.max(0, centerX),
            y: centerY,
            // @ts-ignore
            text: text
        });

        // @ts-ignore
        return await newImage.getBuffer(JimpModule.MIME_PNG || 'image/png');
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
            const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const response = await s3Client.send(command);

            const headers = new Headers();
            if (response.ContentType) headers.set("Content-Type", response.ContentType);
            headers.set("Content-Disposition", `attachment; filename="${file}"`);

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
