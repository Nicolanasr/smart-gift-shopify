import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";

async function test() {
    try {
        const cmd = new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: "qrcodes/" });
        const res = await s3Client.send(cmd);
        
        // sort by last modified descending
        const sorted = (res.Contents || []).sort((a,b) => b.LastModified - a.LastModified);
        
        for(let i=0; i<Math.min(5, sorted.length); i++) {
            const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: sorted[i].Key }));
            console.log("File:", sorted[i].Key, "Time:", sorted[i].LastModified);
            console.log("Raw Metadata caption-text:", head.Metadata['caption-text']);
            if (head.Metadata['caption-text']) {
               try {
                  console.log("Decoded:", decodeURIComponent(head.Metadata['caption-text']));
               } catch(e) {}
            }
        }
    } catch(e) {
        console.error("Test failed", e);
    }
}

test();
