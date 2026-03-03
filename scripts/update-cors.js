import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B52HFYWWHP",
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
