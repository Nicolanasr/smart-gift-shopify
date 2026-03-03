const { S3Client, PutObjectCommand, CopyObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAYN2PY6B5V2KAHQ6F",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "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",
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "shopify-gift-app";
const key = "test-copy-meta.txt";

async function test() {
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: "hello world",
            ContentType: "text/plain"
        }));
        
        console.log("Uploaded initial object.");
        
        const head1 = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        console.log("Initial ContentType:", head1.ContentType);
        
        await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${key}`,
            Key: key,
            MetadataDirective: 'REPLACE',
            ContentType: head1.ContentType,
            ACL: 'public-read',
            Metadata: {
                'caption-text': 'hello meta',
                'has-caption': 'true'
            }
        }));
        
        console.log("Copied object.");
        
        const head2 = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        console.log("Final ContentType:", head2.ContentType);
        console.log("Final Metadata:", head2.Metadata);
        
    } catch(e) {
        console.error("Test failed", e);
    }
}

test();
