// One-off: slice master icon into PWA sizes. Run: bun scripts/make-icons.ts
import sharp from "sharp";
import fs from "fs";

const SRC = "public/icons/icon-master.png";
const OUT = "public/icons";
const TEAL = { r: 13, g: 148, b: 136, alpha: 1 }; // #0d9488

async function main() {
  const master = sharp(SRC);
  const meta = await master.metadata();

  // standard "any" icons: full-bleed
  await sharp(SRC).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
  await sharp(SRC).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
  await sharp(SRC).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
  await sharp(SRC).resize(32, 32).png().toFile(`${OUT}/favicon-32.png`);

  // maskable: content scaled to 80% inside solid teal canvas (safe zone)
  const inner = Math.round(1024 * 0.8);
  const content = await sharp(SRC)
    .resize(inner, inner)
    .toBuffer();
  const composited = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: TEAL },
  })
    .composite([{ input: content, top: Math.floor((1024 - inner) / 2), left: Math.floor((1024 - inner) / 2) }])
    .png()
    .toBuffer();
  await sharp(composited)
    .resize(512, 512)
    .png()
    .toFile(`${OUT}/maskable-512.png`);

  console.log(
    `icons done (master ${meta.width}x${meta.height}):`,
    fs.readdirSync(OUT).join(", "),
  );
}

main();
