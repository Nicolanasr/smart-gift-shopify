import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "AKIAYN2PY6B52HFYWWHP", secretAccessKey: "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" } });
const h = await s3.send(new HeadObjectCommand({ Bucket: "shopify-gift-app", Key: "qrcodes/q_cc26f3b3.png" }));
console.log("Metadata:", JSON.stringify(h.Metadata));
