import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import prisma from "../db.server";

// Hardcoded for now based on other files, though highly recommended to move to .env
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";
const CRON_SECRET = process.env.CRON_SECRET || "smart-gift-cleanup-secret-2026";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Basic protection to ensure only authorized CRON requests can trigger this
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");
    const querySecret = url.searchParams.get("secret");

    if (authHeader !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        // Calculate the date 14 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 14);

        // Find all abandoned media files (no orderId attached AND older than 14 days)
        const abandonedFiles = await prisma.mediaFile.findMany({
            where: {
                orderId: null,
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        if (abandonedFiles.length === 0) {
            return Response.json({ status: "success", deleted: 0, message: "No abandoned files found." });
        }

        // AWS requires DeleteObjectsCommand to take an array of Objects with { Key: string }
        const objectsToDelete = abandonedFiles.map(file => ({ Key: file.s3Key }));

        // Delete from AWS S3 in bulk (max 1000 per request, we assume cron runs frequently enough)
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
                Objects: objectsToDelete.slice(0, 1000),
                Quiet: false
            }
        });

        const s3Response = await s3Client.send(deleteCommand);

        // Ensure we only delete from our DB the files AWS confirmed it deleted
        const successfullyDeletedKeys = s3Response.Deleted?.map(d => d.Key) || [];

        if (successfullyDeletedKeys.length > 0) {
            await prisma.mediaFile.deleteMany({
                where: {
                    s3Key: {
                        in: successfullyDeletedKeys as string[]
                    }
                }
            });
        }

        console.log(`[CLEANUP_JOB] Deleted ${successfullyDeletedKeys.length} abandoned files from S3 and DB.`);

        return Response.json({
            status: "success",
            deleted_count: successfullyDeletedKeys.length,
            errors: s3Response.Errors || []
        });

    } catch (error) {
        console.error("[CLEANUP_JOB] Error executing cleanup:", error);
        return Response.json({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown Error"
        }, { status: 500 });
    }
};

// Also support POST requests for webhooks or specific job runners
export const action = loader;
