import type { ActionFunctionArgs } from "react-router";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const QR_DIR = path.join(process.cwd(), "public", "qrcodes");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const urlInput = formData.get("url") as string;
        const msgInput = formData.get("message") as string;

        let targetContent = "";
        let fileUrl = "";
        const appUrl = process.env.SHOPIFY_APP_URL || "https://your-app-url.com";

        if (file?.size > 0) {
            const ext = path.extname(file.name) || ".bin";
            const filename = `${uuidv4()}${ext}`;
            const filepath = path.join(UPLOAD_DIR, filename);

            const buffer = Buffer.from(await file.arrayBuffer());
            fs.writeFileSync(filepath, buffer);

            fileUrl = `${appUrl}/uploads/${filename}`;
            targetContent = fileUrl;
        } else if (urlInput) {
            targetContent = urlInput;
        } else if (msgInput) {
            targetContent = msgInput;
        }

        if (!targetContent) {
            return Response.json({ error: "No content" }, { status: 400 });
        }

        const qrFilename = `${uuidv4()}.png`;
        const qrPath = path.join(QR_DIR, qrFilename);
        await QRCode.toFile(qrPath, targetContent);

        const qrUrl = `${appUrl}/qrcodes/${qrFilename}`;

        return Response.json({
            status: "success",
            qr_url: qrUrl,
            file_url: fileUrl || targetContent
        });
    } catch (err) {
        console.error("Error:", err);
        return Response.json({
            error: "Failed",
            details: err instanceof Error ? err.message : "Unknown"
        }, { status: 500 });
    }
};
