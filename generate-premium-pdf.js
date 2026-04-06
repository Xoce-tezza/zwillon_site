const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const INPUT_JSON = path.join(__dirname, "data.local.json");
const OUTPUT_PDF = path.join(__dirname, "catalog-premium.pdf");

const FONT_REGULAR = path.join(__dirname, "fonts", "Inter-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "fonts", "Inter-Bold.ttf");
const WIN_ARIAL = "C:\\Windows\\Fonts\\arial.ttf";
const WIN_ARIAL_BOLD = "C:\\Windows\\Fonts\\arialbd.ttf";

const data = JSON.parse(fs.readFileSync(INPUT_JSON, "utf-8"));

const doc = new PDFDocument({
  size: "A4",
  margin: 40,
});

doc.pipe(fs.createWriteStream(OUTPUT_PDF));

function resolveFont(preferred, fallback) {
  if (fs.existsSync(preferred)) return preferred;
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

const regularFontPath = resolveFont(FONT_REGULAR, WIN_ARIAL);
const boldFontPath = resolveFont(FONT_BOLD, WIN_ARIAL_BOLD);

if (regularFontPath && boldFontPath) {
  doc.registerFont("regular", regularFontPath);
  doc.registerFont("bold", boldFontPath);
} else {
  console.warn("[font] TTF not found. Put Inter fonts in ./fonts for best print output.");
}

function clean(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u4e00-\u9fa5]+/g, "")
    .replace(/Главная страница.*?Свяжитесь с нами/gi, "")
    .replace(/Powered by.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function imgAbs(img) {
  const rel = String(img || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\//, "");
  return rel ? path.join(__dirname, rel) : "";
}

// GRID: 2 x 3 = 6 products/page
const cols = 2;
const rows = 3;
const gapX = 10;
const gapY = 10;

const pageWidth = doc.page.width - 80;
const pageHeight = doc.page.height - 80;

const cardWidth = pageWidth / cols;
const cardHeight = pageHeight / rows;

let col = 0;
let row = 0;

data.forEach((p, index) => {
  const x = 40 + col * cardWidth;
  const y = 40 + row * cardHeight;
  const boxW = cardWidth - gapX;
  const boxH = cardHeight - gapY;

  // Card
  doc.roundedRect(x, y, boxW, boxH, 12).lineWidth(0.8).strokeColor("#e6e6e6").stroke();

  // Image (skip first image)
  const images = Array.isArray(p.images) ? p.images : [];
  const imagePath = imgAbs(images[1] || images[0]);
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      doc.image(imagePath, x + 15, y + 15, {
        fit: [boxW - 30, 120],
        align: "center",
        valign: "center",
      });
    } catch {
      doc.fontSize(8).fillColor("#888").text("Image read error", x + 15, y + 22);
    }
  } else {
    doc.fontSize(8).fillColor("#999").text("No image", x + 15, y + 22);
  }

  const name = String(p.name || p.name_ru || "Без названия");
  const desc = clean(p.description || p.description_ru || "");

  if (regularFontPath && boldFontPath) {
    doc.font("bold");
  } else {
    doc.font("Helvetica-Bold");
  }
  doc.fontSize(11).fillColor("#111").text(name, x + 15, y + 140, { width: boxW - 30, height: 36 });

  if (regularFontPath && boldFontPath) {
    doc.font("regular");
  } else {
    doc.font("Helvetica");
  }
  doc.fontSize(8).fillColor("#555").text(desc, x + 15, y + 176, { width: boxW - 30, height: 70 });

  // Next grid cell
  col += 1;
  if (col >= cols) {
    col = 0;
    row += 1;
  }

  // Next page only if there are still products left
  if (row >= rows && index < data.length - 1) {
    doc.addPage();
    col = 0;
    row = 0;
  }
});

doc.end();

console.log("Premium PDF created:", OUTPUT_PDF);
if (!fs.existsSync(FONT_REGULAR) || !fs.existsSync(FONT_BOLD)) {
  console.log("Tip: add Inter TTF files to ./fonts for brand-consistent typography.");
}
