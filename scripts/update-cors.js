import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
});

const BUCKET_NAME = "shopify-gift-app";

const corsRules = [
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag", "x-amz-request-id"]
    }
];

async function updateCors() {
    try {
        console.log(`Updating CORS for bucket: ${BUCKET_NAME}`);
        const command = new PutBucketCorsCommand({
            Bucket: BUCKET_NAME,
            CORSConfiguration: {
                CORSRules: corsRules
            }
        });

        await s3Client.send(command);
        console.log("Successfully updated S3 CORS configuration!");
    } catch (err) {
        console.error("Failed to update CORS:", err);
        process.exit(1);
    }
}

updateCors();
