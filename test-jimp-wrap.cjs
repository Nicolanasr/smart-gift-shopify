const { Jimp, loadFont } = require('jimp');
const fs = require('fs');

async function test() {
    try {
        const font = await loadFont("https://cdn.jsdelivr.net/npm/@jimp/plugin-print@0.16.1/fonts/open-sans/open-sans-32-black/open-sans-32-black.fnt");

        const img = new Jimp({ width: 400, height: 400, color: 0xFFFFFFFF });

        img.print({
            font,
            x: 10,
            y: 10,
            text: {
                text: "This is a very long caption that should wrap multiple lines under the QR code image.",
                alignmentX: 2,
                alignmentY: 8
            },
            maxWidth: 200 // Force it to wrap
        });

        const buf = await img.getBuffer("image/png");
        fs.writeFileSync("test-wrap.png", buf);
        console.log("Image saved to test-wrap.png");
    } catch (e) {
        console.error("Failed:", e);
    }
}
test();
