import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        // Test 1: Check if AWS SDK can be imported
        const { S3Client } = await import("@aws-sdk/client-s3");

        // Test 2: Check if we can create a client
        const client = new S3Client({
            region: "us-east-1",
            credentials: {
                accessKeyId: "AKIAYN2PY6B52HFYWWHP",
                secretAccessKey: "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",
            },
        });

        // Test 3: Check if QRCode works
        const QRCode = await import("qrcode");
        const buffer = await QRCode.toBuffer("test");

        return Response.json({
            status: "ok",
            tests: {
                awsSdkImport: "✅ Success",
                s3ClientCreate: "✅ Success",
                qrcodeGenerate: `✅ Success (${buffer.length} bytes)`,
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
            }
        });
    } catch (err) {
        return Response.json({
            status: "error",
            error: err instanceof Error ? err.message : "Unknown",
            stack: err instanceof Error ? err.stack : undefined,
        }, { status: 500 });
    }
};
