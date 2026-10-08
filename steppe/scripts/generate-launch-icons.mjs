import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve the renderer through Next, which already uses Sharp for image assets.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const brand = new URL("../public/brand/", import.meta.url);
const source = await readFile(new URL("steppe-strata-seal.svg", brand), "utf8");
if (!source.includes('viewBox="0 0 2400 2400"')) {
  throw new Error("Review the seal dimensions before regenerating launch icons.");
}
const launch = source.replace('viewBox="0 0 2400 2400"', 'viewBox="-240 -240 2880 2880"');
const maskable = source.replace('viewBox="0 0 2400 2400"', 'viewBox="-400 -400 3200 3200"');
await writeFile(new URL("steppe-launch.svg", brand), launch);
for (const size of [192, 512, 1024]) {
  await sharp(Buffer.from(launch), { density: 192 })
    .resize(size, size).png()
    .toFile(fileURLToPath(new URL(`steppe-launch-${size}.png`, brand)));
}
for (const size of [192, 512]) {
  await sharp(Buffer.from(maskable), { density: 192 })
    .resize(size, size).flatten({ background: "#EDE6D5" }).png()
    .toFile(fileURLToPath(new URL(`steppe-launch-${size}-maskable.png`, brand)));
}
await sharp(Buffer.from(launch), { density: 192 })
  .resize(180, 180).flatten({ background: "#EDE6D5" }).png()
  .toFile(fileURLToPath(new URL("../app/apple-icon.png", import.meta.url)));
