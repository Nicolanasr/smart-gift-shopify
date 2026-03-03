import { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Hardcoded credentials for local dev as requested
const AWS_ACCESS_KEY_ID = "AKIAYN2PY6B52HFYWWHP";
const AWS_SECRET_ACCESS_KEY = "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";
const AWS_REGION = "us-east-1";

export const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export const BUCKET_NAME = "shopify-gift-app";

export async function listFiles() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: "uploads/", // Only show uploads folder
  });

  try {
    const data = await s3.send(command);
    return data.Contents || [];
  } catch (error) {
    console.error("Error listing S3 files:", error);
    return [];
  }
}

export async function listQRCodes() {
    const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: "qrcodes/",
    });

    try {
        const data = await s3.send(command);
        const contents = data.Contents || [];

        // Fetch metadata for each QR code to find its target (Parallel)
        // Note: For large buckets, this should be optimized or batched.
        const qrData = await Promise.all(contents.map(async (file) => {
            try {
                const head = await s3.send(new HeadObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.Key
                }));
                return {
                    key: file.Key,
                    target: head.Metadata?.['qr-target'] || ''
                };
            } catch (e) {
                console.warn("Failed to head QR:", file.Key);
                return null;
            }
        }));
        
        return qrData.filter(Boolean);
    } catch (error) {
        console.error("Error listing QR codes:", error);
        return [];
    }
}

export async function deleteFile(key: string) {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    return s3.send(command);
}
