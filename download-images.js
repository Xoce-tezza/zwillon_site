/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");

const INPUT_JSON = path.join(__dirname, "data.json");
const OUTPUT_JSON = path.join(__dirname, "data.local.json");
const IMAGES_DIR = path.join(__dirname, "images");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getImageUrls(product) {
  if (!product || !Array.isArray(product.images)) return [];
  return product.images.filter((u) => typeof u === "string" && u.trim().length > 0);
}

async function downloadImage(url, absOutputPath) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  fs.writeFileSync(absOutputPath, Buffer.from(res.data));
}

async function run() {
  ensureDir(IMAGES_DIR);

  const raw = fs.readFileSync(INPUT_JSON, "utf8");
  const products = JSON.parse(raw);
  if (!Array.isArray(products)) {
    throw new Error("data.json must contain array");
  }

  const updated = [];
  let downloadedCount = 0;
  let failedCount = 0;

  for (const product of products) {
    const imgUrls = getImageUrls(product);
    const localImages = [];

    for (let i = 0; i < imgUrls.length; i += 1) {
      const index = i + 1;
      const src = imgUrls[i];
      const fileName = `${product.id}_${index}.jpg`;
      const absPath = path.join(IMAGES_DIR, fileName);
      const jsonPath = `/images/${fileName}`;

      try {
        await downloadImage(src, absPath);
        localImages.push(jsonPath);
        downloadedCount += 1;
      } catch (e) {
        failedCount += 1;
        console.error(`[image-error] id=${product.id} idx=${index} url=${src}`);
        console.error(`  -> ${e.message}`);
      }
    }

    updated.push({
      ...product,
      images: localImages,
    });
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(updated, null, 2), "utf8");

  console.log("Done.");
  console.log(`Downloaded: ${downloadedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Saved: ${OUTPUT_JSON}`);
}

run().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
