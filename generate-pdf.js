const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const inputPath = path.join(__dirname, "data.local.json");
const outputPath = path.join(__dirname, "catalog.pdf");

const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

function clean(text) {
  if (!text) return "";

  return String(text)
    .replace(/[\u4e00-\u9fa5]+/g, "")
    .replace(/Главная страница.*?Свяжитесь с нами/gi, "")
    .replace(/Powered by.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function resolveImagePath(imgPath) {
  if (!imgPath) return "";
  const normalized = String(imgPath).replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
  return path.join(__dirname, normalized);
}

const doc = new PDFDocument({ margin: 40, size: "A4" });
doc.pipe(fs.createWriteStream(outputPath));

doc.fontSize(18).fillColor("black").text("ZWILLON Product Catalog", { align: "left" });
doc.moveDown(0.6);

let x = 40;
let y = 80;

const cardWidth = 250;
const cardHeight = 320;
const imageWidth = 200;
const imageHeight = 150;
const imageOffsetX = 25;

for (let index = 0; index < data.length; index += 1) {
  const p = data[index] || {};
  const images = Array.isArray(p.images) ? p.images : [];
  const img = images[1] || images[0] || "";
  const imagePath = resolveImagePath(img);

  doc
    .roundedRect(x, y, cardWidth - 10, cardHeight - 16, 10)
    .lineWidth(0.6)
    .strokeColor("#dddddd")
    .stroke();

  if (imagePath && fs.existsSync(imagePath)) {
    try {
      doc.image(imagePath, x + imageOffsetX, y + 10, { width: imageWidth, height: imageHeight, fit: [imageWidth, imageHeight] });
    } catch (_) {
      doc.fontSize(8).fillColor("gray").text("Image error", x + 10, y + 20);
    }
  } else {
    doc.fontSize(8).fillColor("gray").text("No image", x + 10, y + 20);
  }

  doc.fontSize(10).fillColor("black").text(String(p.name || "Без названия"), x + 10, y + 170, {
    width: cardWidth - 30,
    height: 44,
  });

  doc.fontSize(8).fillColor("gray").text(clean(p.description), x + 10, y + 218, {
    width: cardWidth - 30,
    height: 86,
  });

  x += cardWidth;
  if (x > 300) {
    x = 40;
    y += cardHeight;
  }

  if (y > 700) {
    doc.addPage();
    x = 40;
    y = 40;
  }
}

doc.end();
console.log("PDF created:", outputPath);
