const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const seo = require("./seo-slugs");

const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = String(
  process.env.TELEGRAM_BOT_TOKEN || "PASTE_TOKEN_HERE"
).trim();
const TELEGRAM_CHAT_ID = String(
  process.env.TELEGRAM_CHAT_ID || "PASTE_CHAT_ID"
).trim();

const ADMIN_LOGIN = "zwillon_ata";
const ADMIN_PASSWORD = "milkaKAMILKA_2026_secure";

const MAX_LEAD_COMMENT = 500;

function telegramReady() {
  return (
    !!TELEGRAM_TOKEN &&
    !!TELEGRAM_CHAT_ID &&
    TELEGRAM_TOKEN !== "PASTE_TOKEN_HERE" &&
    TELEGRAM_CHAT_ID !== "PASTE_CHAT_ID"
  );
}

function escapeTelegramHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sendTelegramMessage(text) {
  if (!telegramReady()) return Promise.resolve();

  const payload = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
  });

  const url = new URL(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`
  );

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (ch) => {
          body += ch;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Telegram HTTP ${res.statusCode}: ${body}`));
          } else {
            resolve();
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const app = express();
app.disable("x-powered-by");

const DB_PATH = path.join(__dirname, "db.json");

const ADMIN_COOKIE = "zwillon_admin";
const sessions = new Set();

/** В продакшене (HTTPS) включайте NODE_ENV=production или COOKIE_SECURE=1 для флага Secure. */
const COOKIE_SECURE =
  process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";

function buildAdminSessionCookie(token, maxAgeSec) {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSec}`,
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

function clearAdminSessionCookie() {
  const parts = [
    `${ADMIN_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "256kb" }));

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "");
  const first = xf.split(",")[0].trim();
  if (first) return first;
  return req.socket?.remoteAddress || "unknown";
}

function makeIpLimiter(maxRequests, windowMs) {
  const bucket = new Map();
  return function allow(ip) {
    const now = Date.now();
    let times = bucket.get(ip);
    if (!times) {
      times = [];
      bucket.set(ip, times);
    }
    const cutoff = now - windowMs;
    while (times.length && times[0] < cutoff) times.shift();
    if (times.length >= maxRequests) return false;
    times.push(now);
    if (bucket.size > 5000) {
      for (const [k, arr] of bucket) {
        while (arr.length && arr[0] < cutoff) arr.shift();
        if (!arr.length) bucket.delete(k);
      }
    }
    return true;
  };
}

const limitLeadPost = makeIpLimiter(25, 15 * 60 * 1000);
const limitLoginPost = makeIpLimiter(40, 15 * 60 * 1000);

function phoneDigitsLen(phone) {
  return String(phone || "").replace(/\D/g, "").length;
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { leads: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function parseCookies(req) {
  const h = req.headers.cookie || "";
  const out = {};
  h.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function normalizeLead(row) {
  if (!row || typeof row !== "object") return row;
  return {
    id: String(row.id || ""),
    name: row.name != null ? String(row.name) : "Без имени",
    phone: row.phone != null ? String(row.phone) : "",
    city: row.city != null ? String(row.city) : "",
    comment: row.comment != null ? String(row.comment) : "",
    product: row.product != null ? String(row.product) : "",
    status: row.status || "new",
    date: row.date || "",
  };
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (token && sessions.has(token)) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

app.post("/api/login", (req, res) => {
  const ip = clientIp(req);
  if (!limitLoginPost(ip)) {
    return res.status(429).json({ ok: false, error: "rate_limit" });
  }
  const login = String(req.body?.login || "").trim();
  const password = String(req.body?.password || "");

  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    res.setHeader("Set-Cookie", buildAdminSessionCookie(token, 86400));
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "unauthorized" });
});

app.post("/api/logout", (req, res) => {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", clearAdminSessionCookie());
  res.json({ ok: true });
});

app.get("/api/auth", (req, res) => {
  const token = parseCookies(req)[ADMIN_COOKIE];
  res.json({ ok: !!(token && sessions.has(token)) });
});

app.post("/api/leads", (req, res) => {
  try {
    const ip = clientIp(req);
    if (!limitLeadPost(ip)) {
      return res.status(429).json({ success: false, error: "rate_limit" });
    }

    const phoneRaw = String(req.body?.phone || "").trim();
    if (!phoneRaw || phoneDigitsLen(phoneRaw) < 10) {
      return res.status(400).json({ success: false, error: "invalid_phone" });
    }

    const nameTrim = String(req.body?.name || "").trim();
    const cityTrim = String(req.body?.city || "").trim();
    const commentTrim = String(req.body?.comment || "").trim();
    const productTrim = String(req.body?.product || "").trim();

    const db = readDB();
    const newLead = {
      id: Date.now().toString(),
      name: nameTrim || "Без имени",
      phone: phoneRaw,
      city: cityTrim,
      comment: commentTrim.slice(0, MAX_LEAD_COMMENT),
      product: productTrim,
      status: "new",
      date: new Date().toISOString(),
    };
    db.leads.unshift(newLead);
    writeDB(db);

    const tgMessage = `
🔥 <b>Новая заявка</b>

👤 Имя: ${escapeTelegramHtml(newLead.name)}
📞 Телефон: ${escapeTelegramHtml(newLead.phone)}
🏙 Город: ${newLead.city ? escapeTelegramHtml(newLead.city) : "-"}
📦 Товар: ${newLead.product ? escapeTelegramHtml(newLead.product) : "-"}

💬 ${newLead.comment ? escapeTelegramHtml(newLead.comment) : "-"}

⏰ ${escapeTelegramHtml(
      new Date().toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      })
    )}
`.trim();

    sendTelegramMessage(tgMessage).catch((err) => {
      console.warn("[telegram]", err?.message || err);
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e.message) });
  }
});

app.get("/api/leads", requireAdmin, (req, res) => {
  try {
    const db = readDB();
    const list = Array.isArray(db.leads) ? db.leads.map(normalizeLead) : [];
    res.json(list);
  } catch (e) {
    res.status(500).json([]);
  }
});

app.put("/api/leads/:id", requireAdmin, (req, res) => {
  try {
    const db = readDB();
    const lead = db.leads.find((l) => l.id === req.params.id);
    if (lead && req.body && req.body.status != null) {
      lead.status = req.body.status;
    }
    writeDB(db);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

function siteBaseUrl(req) {
  const env = process.env.SITE_URL && String(process.env.SITE_URL).trim();
  if (env) return env.replace(/\/$/, "");
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "localhost")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

const PRODUCT_HTML_PATH = path.join(__dirname, "product.html");

app.get("/catalog", (req, res) => {
  res.sendFile(path.join(__dirname, "catalog.html"));
});

app.get("/sitemap.xml", (req, res) => {
  const base = siteBaseUrl(req);
  const products = seo.loadProducts();
  const { idToSlug } = seo.buildProductSlugMaps(products);
  const rows = [
    { loc: `${base}/`, p: "1.0" },
    { loc: `${base}/index.html`, p: "1.0" },
    { loc: `${base}/catalog.html`, p: "0.9" },
  ];
  for (const slug of idToSlug.values()) {
    rows.push({ loc: `${base}/product/${slug}.html`, p: "0.8" });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows
  .map(
    (r) =>
      `  <url><loc>${String(r.loc).replace(/&(?!amp;|lt;|gt;|apos;|quot;)/g, "&amp;")}</loc><priority>${r.p}</priority></url>`
  )
  .join("\n")}
</urlset>`;
  res.type("application/xml").send(body);
});

app.get("/product/:slug.html", (req, res) => {
  const slug = String(req.params.slug || "")
    .replace(/\.html$/i, "")
    .trim();
  const products = seo.loadProducts();
  const { slugToId } = seo.buildProductSlugMaps(products);
  const pid = slugToId.get(slug);
  if (!pid) {
    return res
      .status(404)
      .type("html")
      .send(
        "<!DOCTYPE html><html lang=\"ru\"><head><meta charset=\"UTF-8\"><title>Товар не найден — ZWILLON</title></head><body style=\"background:#0B0B0B;color:#fff;font-family:system-ui;padding:40px;\"><p>Товар не найден.</p><p><a href=\"/catalog.html\" style=\"color:#FFC107;\">Каталог</a></p></body></html>"
      );
  }
  const product = products.find((p) => seo.slugProductShape(p).id === String(pid));
  if (!product) {
    return res.status(404).type("text/plain").send("Not found");
  }
  let templateHtml;
  try {
    templateHtml = fs.readFileSync(PRODUCT_HTML_PATH, "utf8");
  } catch {
    return res.status(500).type("text/plain").send("Template read error");
  }
  const html = seo.injectProductSeoHtml(templateHtml, product, slug, siteBaseUrl(req));
  res.type("html").send(html);
});

app.get("/product.html", (req, res) => {
  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.sendFile(PRODUCT_HTML_PATH);
  }
  const products = seo.loadProducts();
  const { idToSlug } = seo.buildProductSlugMaps(products);
  const slug = idToSlug.get(id);
  if (!slug) {
    return res.status(404).type("text/plain").send("Product not found");
  }
  res.redirect(301, `/product/${slug}.html`);
});

app.get("/product", (req, res) => {
  const id = String(req.query.id || "").trim();
  if (id) {
    const products = seo.loadProducts();
    const { idToSlug } = seo.buildProductSlugMaps(products);
    const slug = idToSlug.get(id);
    if (slug) return res.redirect(301, `/product/${slug}.html`);
  }
  const qs = new URLSearchParams(req.query).toString();
  const suffix = qs ? `?${qs}` : "";
  res.redirect(302, `/product.html${suffix}`);
});

app.get(["/admin.html", "/admin"], (_req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  console.log("CRM path: /zwillon-admin-secure.html · Catalog: /catalog.html");
  if (!COOKIE_SECURE) {
    console.log(
      "Cookie: без Secure (локально). На HTTPS задайте NODE_ENV=production или COOKIE_SECURE=1."
    );
  }
  if (!telegramReady()) {
    console.log(
      "Telegram: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в окружении Render."
    );
  } else {
    console.log("Telegram: уведомления о новых заявках включены.");
  }
});
