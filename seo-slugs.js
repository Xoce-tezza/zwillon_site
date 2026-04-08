/**
 * SEO: слуги товаров и метаданные (Node, server.js).
 * Алгоритм slug должен совпадать с zwillon-shared.js (slugifyForSeo + buildProductSlugMaps).
 */
const fs = require("fs");
const path = require("path");
const {
  buildProductDescription,
} = require("./product-description-core");

const CLOUDINARY_BASE =
  "https://res.cloudinary.com/dyciy0kdx/image/upload/";

const CYR = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugifyForSeo(input) {
  let s = String(input || "")
    .toLowerCase()
    .trim();
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    if (CYR[ch] !== undefined) out += CYR[ch];
    else out += ch;
  }
  out = out
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return out.slice(0, 96);
}

/** Синхронно с getCategory() в zwillon-shared.js */
function catalogLabelFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("кастрюля") || n.includes("сковорода")) return "Посуда";
  if (n.includes("чайник")) return "Чайники";
  if (n.includes("доска")) return "Аксессуары";
  if (n.includes("нож") || n.includes("набор")) return "Аксессуары";
  if (n.includes("блендер") || n.includes("миксер")) return "Техника";
  return "Другое";
}

function loadProducts() {
  const jsonPath = path.join(__dirname, "data.local.json");
  if (!fs.existsSync(jsonPath)) return [];
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/** Совпадает с id/name в normalizeProductsFromJson (zwillon-shared.js) */
function slugProductShape(p) {
  const images = Array.isArray(p.images) ? p.images : [];
  const name = String(p.name || p.name_ru || "");
  return {
    id: String(p.id || p.url || images[0] || name || "zwillon_unknown"),
    name_ru: name,
  };
}

function buildProductSlugMaps(products) {
  const list = Array.isArray(products) ? products : [];
  const idToSlug = new Map();
  const slugToId = new Map();
  const used = new Set();

  for (const raw of list) {
    const p = slugProductShape(raw);
    const id = String(p.id || "").trim();
    const name = String(p.name_ru || "").trim();
    let base =
      slugifyForSeo(name) || slugifyForSeo(id) || slugifyForSeo(p.url) || "item";
    let slug = base;
    if (used.has(slug)) {
      const suffix =
        slugifyForSeo(id) ||
        String(id)
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()
          .replace(/^-+|-+$/g, "")
          .slice(-24) ||
        "id";
      slug = `${base}-${suffix}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
    }
    let n = 0;
    while (used.has(slug)) {
      n += 1;
      slug = `${base}-${String(id).slice(-8)}-${n}`
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }
    used.add(slug);
    if (id) {
      idToSlug.set(id, slug);
      slugToId.set(slug, id);
    }
  }

  return { idToSlug, slugToId };
}

function cloudinaryPublicIdFromRef(ref) {
  const u = String(ref || "").trim().split("?")[0];
  if (!u) return "";
  let pathPart = u;
  if (/^https?:\/\//i.test(u) || u.startsWith("//")) {
    const abs = u.startsWith("//") ? "https:" + u : u;
    try {
      pathPart = new URL(abs).pathname;
    } catch {
      return "";
    }
  } else {
    pathPart = u.replace(/^\/+/, "");
  }
  const last = pathPart.split("/").filter(Boolean).pop() || "";
  return last.replace(/\.[^.]+$/, "").trim();
}

function primaryProductImageUrl(product) {
  const imgs = Array.isArray(product.images) ? product.images : [];
  const pick = imgs[1] || imgs[0] || "";
  if (!pick) return "";
  const raw = String(pick).trim();
  const noQ = raw.split("?")[0];
  if (/res\.cloudinary\.com\/dyciy0kdx/i.test(noQ)) return noQ;
  if (/^https?:\/\//i.test(noQ) || noQ.startsWith("//")) {
    try {
      const abs = noQ.startsWith("//") ? "https:" + noQ : noQ;
      const { hostname, pathname } = new URL(abs);
      const z = /zwillon\.cn$/i.test(hostname);
      const im = /\/images\//i.test(pathname);
      if (!z && !im) return noQ;
    } catch {
      return "";
    }
  }
  const id = cloudinaryPublicIdFromRef(raw);
  if (!id) return "";
  return CLOUDINARY_BASE + id;
}

function stripHtmlLite(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProductSeoTitle(product) {
  const name =
    String(product.name_ru || product.name || "").trim() || "Товар ZWILLON";
  return `Купить ${name} оптом | ZWILLON`;
}

/** Единый сниппет 140–160 символов из данных buildProductDescription (meta, OG, JSON-LD). */
function buildProductSeoDescription(product) {
  const d = buildProductDescription(product);
  return metaDescriptionFromDescriptionData(product, d);
}

function metaDescriptionFromDescriptionData(product, d) {
  const name = (String(product.name_ru || product.name || "").trim() || "Товар ZWILLON")
    .replace(/\s+/g, " ")
    .trim();
  const short = String(d.short || "").replace(/\s+/g, " ").trim();
  const leadFeature = String((d.features && d.features[0]) || "").replace(/\s+/g, " ").trim();
  let out = `${name} оптом для кафе и кухни. ${leadFeature || short || "Надежная модель для ежедневной работы."} Поставка по Казахстану.`
    .replace(/\s+/g, " ")
    .trim();
  if (out.length > 160) {
    out = `${name} оптом для кафе и кухни. ${short || "Надежная модель для ежедневной работы."} Поставка по Казахстану.`
      .replace(/\s+/g, " ")
      .trim();
  }
  if (out.length > 160) {
    out = out.slice(0, 157).trim();
    const cut = out.lastIndexOf(" ");
    if (cut > 90) out = out.slice(0, cut);
    out += "...";
  }
  return out;
}

function buildProductKeywords(product, descData) {
  const d = descData || buildProductDescription(product);
  const name = String(product.name_ru || product.name || "").trim();
  const base = [
    name,
    d.categoryLabel,
    `${d.categoryLabel} оптом`,
    "купить оптом",
    "оптом Казахстан",
    "для ресторана",
    "для кафе",
    "поставщик HoReCa",
    "оптовый поставщик",
    "поставщик для общепита",
    "ZWILLON",
    "B2B",
  ];
  if (d.bucket === "tehnika") {
    base.push("кухонная техника оптом", "оборудование для ресторана оптом");
  }
  if (d.bucket === "posuda" || d.bucket === "chainiki") {
    base.push("посуда оптом", "инвентарь для ресторана");
  }
  if (d.bucket === "accessories") {
    base.push("аксессуары для кухни оптом");
  }
  const seen = new Set();
  const out = [];
  for (const x of base) {
    const t = String(x).trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(t);
  }
  return out.join(", ");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function buildJsonLd(product, imageUrl, seoDescription) {
  const name = String(product.name_ru || product.name || "").trim() || "Товар";
  const desc =
    seoDescription ||
    buildProductSeoDescription(product);
  const obj = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: desc,
    brand: { "@type": "Brand", name: "ZWILLON" },
  };
  if (imageUrl) obj.image = imageUrl;
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function injectProductSeoHtml(templateHtml, product, slug, siteUrl) {
  const title = buildProductSeoTitle(product);
  const descData = buildProductDescription(product);
  const desc = metaDescriptionFromDescriptionData(product, descData);
  const keywords = buildProductKeywords(product, descData);
  const imageUrl = primaryProductImageUrl(product);
  const canonical = `${siteUrl.replace(/\/$/, "")}/product/${slug}.html`;

  let html = templateHtml;

  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeAttr(desc)}" />`
  );
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="keywords" content="${escapeAttr(keywords)}" />`
  );

  const ogBlock = `
  <link rel="canonical" href="${escapeAttr(canonical)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:url" content="${escapeAttr(canonical)}" />
  ${imageUrl ? `<meta property="og:image" content="${escapeAttr(imageUrl)}" />` : ""}
  <script type="application/ld+json">${buildJsonLd(product, imageUrl, desc)}</script>`;

  html = html.replace("</head>", `${ogBlock}\n</head>`);

  const nameForH1 = String(product.name_ru || product.name || "").trim() || "Товар ZWILLON";
  const prefill = `<div class="seo-prefill site-container pb-4"><h1 class="text-3xl font-bold text-white tracking-tight leading-tight">${escapeHtml(nameForH1)}</h1><p class="text-muted text-sm mt-2">Карточка товара загружается…</p></div>`;
  html = html.replace(
    /<div class="product mt-8" id="productRoot"><\/div>/,
    `<div class="product mt-8" id="productRoot">${prefill}</div>`
  );

  return html;
}

module.exports = {
  slugifyForSeo,
  slugProductShape,
  loadProducts,
  buildProductSlugMaps,
  buildProductSeoTitle,
  buildProductSeoDescription,
  buildProductKeywords,
  primaryProductImageUrl,
  buildJsonLd,
  injectProductSeoHtml,
  catalogLabelFromName,
};
