import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({ region: "us-east-1", credentials: { accessKeyId:"AKIAYN2PY6B5V2KAHQ6F", secretAccessKey:"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" }});
const h = await s3.send(new HeadObjectCommand({ Bucket: "shopify-gift-app", Key: "qrcodes/q_cc26f3b3.png" }));
console.log("Metadata:", JSON.stringify(h.Metadata));
