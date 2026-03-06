import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import { getShop, checkUploadLimit } from "../services/usage-tracker.server";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    // Disable auto-checksum injection so presigned URLs work from the browser
    // Without this, SDK v3 injects x-amz-checksum-crc32 into the URL which the
    // browser's XmlHttpRequest doesn't send, causing S3 to reject the PUT with 403
    requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";

// Handle CORS Preflight
export const loader = async ({ request }: LoaderFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }
    return new Response(null, { status: 404 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    // Handle CORS for the actual request
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers });
    }

    try {
        const body = await request.json();
        const { fileType, contentType, shopDomain } = body;

        if (!contentType) {
            return Response.json({ error: 'Missing contentType' }, { status: 400, headers });
        }

        if (shopDomain) {
            const limitCheck = await checkUploadLimit(shopDomain);
            if (!limitCheck.allowed) {
                return Response.json({ error: limitCheck.reason }, { status: 403, headers });
            }
        }

        const shortId = crypto.randomBytes(4).toString('hex');
        const extension = fileType || 'bin';
        const filename = `${shortId}.${extension}`;
        const key = `uploads/${filename}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            ACL: 'public-read',
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
        const vercelUrl = `https://smartgift.live/v/${filename}`;

        return Response.json({
            uploadUrl,
            publicUrl, // S3 Direct
            vercelUrl, // Clean Proxy
            key
        }, { headers });

    } catch (err) {
        console.error("Presign Error:", err);
        return Response.json({ error: 'Failed to generate upload URL', details: (err as Error).message }, { status: 500, headers });
    }
};
