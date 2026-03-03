import type { ActionFunctionArgs } from "react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { checkUploadLimit } from "../services/usage-tracker.server";

// Initialize S3 Client with hardcoded credentials
// TODO: Move to environment variables when Shopify supports them
const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: "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",
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = "shopify-gift-app";
const AWS_REGION = "us-east-1";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        const urlObj = new URL(request.url);
        const shopDomain = urlObj.searchParams.get("shop");

        if (shopDomain) {
            const limitCheck = await checkUploadLimit(shopDomain);
            if (!limitCheck.allowed) {
                return Response.json({ error: limitCheck.reason }, { status: 403 });
            }
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const urlInput = formData.get("url") as string;
        const msgInput = formData.get("message") as string;

        let targetContent = "";
        let fileUrl = "";

        // Handle file upload to S3
        if (file?.size > 0) {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const fileName = `uploads/${uuidv4()}.${fileExt}`;

            // Determine file type category for validation
            let fileTypeCategory: "image" | "video" | "audio" | "document" = "image";
            if (['mp4', 'webm', 'mov', 'avi'].includes(fileExt)) {
                fileTypeCategory = "video";
            } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExt)) {
                fileTypeCategory = "audio";
            } else if (['pdf', 'doc', 'docx', 'txt'].includes(fileExt)) {
                fileTypeCategory = "document";
            }

            // Backend size validation to prevent malicious large uploads
            const MAX_SIZES = {
                image: 10485760,   // 10MB
                video: 104857600,  // 100MB
                audio: 20971520,   // 20MB
                document: 10485760 // 10MB
            };

            if (file.size > MAX_SIZES[fileTypeCategory]) {
                const limitMB = Math.round(MAX_SIZES[fileTypeCategory] / 1024 / 1024);
                return Response.json({ error: `File exceeds maximum allowed size of ${limitMB}MB for ${fileTypeCategory}s` }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: fileName,
                    Body: buffer,
                    ContentType: file.type,
                })
            );

            fileUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
            targetContent = fileUrl;
        } else if (urlInput) {
            targetContent = urlInput;
        } else if (msgInput) {
            targetContent = msgInput;
        }

        if (!targetContent) {
            return Response.json({ error: "No content provided" }, { status: 400 });
        }

        // Generate QR Code
        const qrFilename = `qrcodes/${uuidv4()}.png`;
        const qrBuffer = await QRCode.toBuffer(targetContent);

        // Upload QR to S3
        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: qrFilename,
                Body: qrBuffer,
                ContentType: "image/png",
            })
        );

        const qrUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${qrFilename}`;

        return Response.json({
            status: "success",
            qr_url: qrUrl,
            file_url: fileUrl || targetContent,
        });
    } catch (err) {
        console.error("Upload Error:", err);
        return Response.json(
            {
                error: "Failed to upload",
                details: err instanceof Error ? err.message : "Unknown error",
            },
            { status: 500 }
        );
    }
};
