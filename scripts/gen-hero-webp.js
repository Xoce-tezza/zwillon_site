"use strict";

/**
 * Строит /images/hero-600.webp и hero-1200.webp из первого подходящего кадра
 * каталога (без суффикса _1) через Cloudinary, качество подбирается ≤150 KB.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.local.json");
const OUT_DIR = path.join(ROOT, "images");
const BASE = "https://res.cloudinary.com/dyciy0kdx/image/upload/";
const MAX_BYTES = 150 * 1024;

function pickPublicId(images) {
  const arr = Array.isArray(images) ? images : [];
  const cand = arr.filter((p) => !String(p || "").includes("_1"));
  const img = cand[0] || arr[0];
  if (!img) return "";
  const tail = String(img).split("/").pop() || "";
  return tail.replace(/\.[^.]+$/, "");
}

function fetchOnce(pubId, w, q) {
  const tf = `w_${w},c_limit,q_${q},f_webp`;
  const url = `${BASE}${tf}/${pubId}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " " + url));
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("timeout " + url));
    });
  });
}

async function writeUnderLimit(pubId, w, outfile) {
  for (let q = 82; q >= 55; q -= 4) {
    const buf = await fetchOnce(pubId, w, q);
    if (buf.length <= MAX_BYTES) {
      fs.writeFileSync(outfile, buf);
      console.log(outfile, w + "px", "q_" + q, (buf.length / 1024).toFixed(1) + " KB");
      return;
    }
  }
  const buf = await fetchOnce(pubId, w, 50);
  fs.writeFileSync(outfile, buf);
  console.warn(outfile + " всё ещё >150 KB после q_50:", (buf.length / 1024).toFixed(1), "KB");
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error("Нет", DATA_PATH);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  let pubId = "";
  if (Array.isArray(data)) {
    for (const row of data) {
      pubId = pickPublicId(row.images);
      if (pubId) break;
    }
  }
  if (!pubId) {
    console.error("В data.local.json не найдено images для hero.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writeUnderLimit(pubId, 600, path.join(OUT_DIR, "hero-600.webp"));
  await writeUnderLimit(pubId, 1200, path.join(OUT_DIR, "hero-1200.webp"));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
