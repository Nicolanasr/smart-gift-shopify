import type { ActionFunctionArgs } from "react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

// Initialize S3 Client with hardcoded credentials
// TODO: Move to environment variables when Shopify supports them
const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: "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",
    },
});

const BUCKET_NAME = "shopify-gift-app";
const AWS_REGION = "us-east-1";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const urlInput = formData.get("url") as string;
        const msgInput = formData.get("message") as string;

        let targetContent = "";
        let fileUrl = "";

        // Handle file upload to S3
        if (file?.size > 0) {
            const fileExt = file.name.split('.').pop() || 'bin';
            const fileName = `uploads/${uuidv4()}.${fileExt}`;

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
