const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const seo = require("./seo-slugs");

const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = "zwillon_ata";
const ADMIN_PASSWORD = "milkaKAMILKA_2026_secure";

const MAX_LEAD_COMMENT = 500;

function escapeTelegramHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function phoneDigitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (!digits.startsWith("7")) {
    digits = "7" + digits;
  }
  return "+" + digits;
}

function buildLeadTelegramHtml(lead) {
  const productName = String(lead.product || "").trim() || "-";
  const msgText =
    lead.message != null
      ? String(lead.message)
      : lead.comment != null
        ? String(lead.comment)
        : "";
  const cityDisp =
    lead.city != null && String(lead.city).trim()
      ? escapeTelegramHtml(String(lead.city).trim())
      : "-";
  const managerDisp = escapeTelegramHtml(String(lead.manager || "-"));
  const statusDisp = escapeTelegramHtml(String(lead.status || "new"));
  const commentDisp = msgText ? escapeTelegramHtml(msgText) : "-";
  const when = lead.date
    ? new Date(lead.date).toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : new Date().toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      });

  const ph = String(lead.phone || "").trim();
  const phEsc = escapeTelegramHtml(ph);

  return (
    `🔥 <b>Новая заявка</b>\n\n` +
    `👤 <b>Имя:</b> ${escapeTelegramHtml(lead.name)}\n` +
    `📞 <b>Телефон:</b> <a href="tel:${phEsc}">${phEsc}</a>\n` +
    `🏙 <b>Город:</b> ${cityDisp}\n` +
    `📦 <b>Товар:</b> ${escapeTelegramHtml(productName)}\n` +
    `💬 <b>Комментарий:</b> ${commentDisp}\n\n` +
    `👨‍💼 <b>В работе:</b> ${managerDisp}\n` +
    `📊 <b>Статус:</b> ${statusDisp}\n\n` +
    `⏰ ${escapeTelegramHtml(when)}`
  );
}

function buildLeadInlineKeyboard(lead) {
  const phone = String(lead.phone || "").trim();
  const cleanPhone = phone.replace(/\D/g, "");
  const waUrl =
    cleanPhone.length >= 11
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent("Здравствуйте, по заявке с сайта ZWILLON")}`
      : `https://wa.me/?text=${encodeURIComponent("Здравствуйте, по заявке с сайта ZWILLON")}`;
  const id = String(lead.id || "");

  return {
    inline_keyboard: [
      [{ text: "🟢 WhatsApp", url: waUrl }],
      [
        { text: "✅ В работу", callback_data: `take_${id}` },
        { text: "💰 Завершено", callback_data: `done_${id}` },
        { text: "❌ Отказ", callback_data: `reject_${id}` },
      ],
    ],
  };
}

/**
 * Отправка карточки лида в Telegram (HTML + inline-кнопки, fetch).
 * @returns {Promise<number|null>} message_id или null
 */
async function sendTelegramMessage(lead) {
  try {
    const text = buildLeadTelegramHtml(lead);
    const keyboard = buildLeadInlineKeyboard(lead);
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: String(process.env.TELEGRAM_CHAT_ID),
          text,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
      }
    );
    const data = await response.json();
    console.log("TELEGRAM:", data);
    const mid = data?.result?.message_id;
    return data?.ok && mid != null ? Number(mid) : null;
  } catch (err) {
    console.error("TELEGRAM ERROR:", err);
    return null;
  }
}

async function answerCallback(callbackQueryId, text, extra = {}) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text != null ? String(text) : "",
          ...extra,
        }),
      }
    );
    const data = await response.json();
    if (!data.ok) console.error("TELEGRAM answerCallback:", data);
  } catch (e) {
    console.error("TELEGRAM answerCallback ERROR:", e);
  }
}

async function editTelegramMessage(messageId, text, keyboard) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: String(process.env.TELEGRAM_CHAT_ID),
          message_id: messageId,
          text,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
      }
    );
    const data = await response.json();
    if (!data.ok) console.error("TELEGRAM editMessageText:", data);
  } catch (e) {
    console.error("TELEGRAM editMessageText ERROR:", e);
  }
}

async function editTelegramLeadMessage(lead) {
  try {
    const mid = lead.telegram_message_id;
    if (mid == null) return;
    const text = buildLeadTelegramHtml(lead);
    const keyboard = buildLeadInlineKeyboard(lead);
    await editTelegramMessage(Number(mid), text, keyboard);
  } catch (e) {
    console.error("[telegram] editTelegramLeadMessage", e?.message || e);
  }
}

function managerDisplayName(from) {
  if (!from || typeof from !== "object") return "менеджер";
  if (from.username) return `@${from.username}`;
  const n = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return n || "менеджер";
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

app.use(express.static(__dirname));

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

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
  const message =
    row.message != null
      ? String(row.message)
      : row.comment != null
        ? String(row.comment)
        : "";
  return {
    id: String(row.id || ""),
    name: row.name != null ? String(row.name) : "Без имени",
    phone: row.phone != null ? String(row.phone) : "",
    city: row.city != null ? String(row.city) : "",
    message,
    comment: message,
    product: row.product != null ? String(row.product) : "",
    status: row.status || "new",
    manager: row.manager != null ? String(row.manager) : null,
    manager_telegram_id:
      row.manager_telegram_id != null ? Number(row.manager_telegram_id) : null,
    telegram_message_id:
      row.telegram_message_id != null ? Number(row.telegram_message_id) : null,
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

app.post("/api/leads", async (req, res) => {
  try {
    const ip = clientIp(req);
    if (!limitLeadPost(ip)) {
      return res.status(429).json({ success: false, error: "rate_limit" });
    }

    const phoneRaw = String(req.body?.phone || "").trim();
    const phoneNorm = normalizePhone(phoneRaw);
    if (!phoneNorm || phoneDigitsOnly(phoneNorm).length < 11) {
      return res.status(400).json({ success: false, error: "invalid_phone" });
    }

    const nameTrim = String(req.body?.name || "").trim();
    const cityTrim = String(req.body?.city || "").trim();
    const messageTrim = String(
      req.body?.message != null ? req.body.message : req.body?.comment != null ? req.body.comment : ""
    ).trim();

    const productTrim = String(req.body?.product || "").trim();

    const db = readDB();
    const newLead = {
      id: Date.now().toString(),
      name: nameTrim || "Без имени",
      phone: phoneNorm,
      city: cityTrim,
      message: messageTrim.slice(0, MAX_LEAD_COMMENT),
      product: productTrim,
      status: "new",
      manager: null,
      manager_telegram_id: null,
      telegram_message_id: null,
      date: new Date().toISOString(),
    };
    db.leads.unshift(newLead);
    writeDB(db);

    const mid = await sendTelegramMessage(newLead);
    if (mid != null) {
      try {
        const db2 = readDB();
        const L = db2.leads.find((x) => String(x.id) === String(newLead.id));
        if (L) {
          L.telegram_message_id = mid;
          writeDB(db2);
        }
      } catch (e) {
        console.error("[telegram] message_id persist failed:", e?.message || e);
      }
    }

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

app.post("/telegram-webhook", async (req, res) => {
  try {
    const update = req.body || {};

    if (update.callback_query) {
      const query = update.callback_query;
      const data = String(query.data || "").trim();
      const user = query.from || {};
      const message = query.message;

      if (!message?.message_id) {
        return res.sendStatus(200);
      }

      const messageId = message.message_id;
      const userId = user.id != null ? Number(user.id) : NaN;
      const displayName = managerDisplayName(user);

      const m = data.match(/^(take|done|reject)_(.+)$/);
      let action;
      let leadId;

      const db = readDB();
      const list = Array.isArray(db.leads) ? db.leads : [];

      if (m) {
        action = m[1];
        leadId = m[2];
      } else if (["take", "done", "reject"].includes(data)) {
        action = data;
        const byMsg = list.find((l) => Number(l.telegram_message_id) === Number(messageId));
        if (!byMsg) {
          await answerCallback(query.id, "Заявка не найдена", { show_alert: true });
          return res.sendStatus(200);
        }
        leadId = String(byMsg.id);
      } else {
        await answerCallback(query.id, "Неизвестное действие");
        return res.sendStatus(200);
      }

      const lead = list.find((l) => String(l.id) === String(leadId));
      if (!lead) {
        await answerCallback(query.id, "Заявка не найдена", { show_alert: true });
        return res.sendStatus(200);
      }

      if (
        lead.telegram_message_id != null &&
        Number(lead.telegram_message_id) !== Number(messageId)
      ) {
        await answerCallback(query.id, "Сообщение не совпадает с заявкой", { show_alert: true });
        return res.sendStatus(200);
      }

      const st = lead.status || "new";

      if (action === "take") {
        if (st !== "new") {
          await answerCallback(query.id, "Статус уже изменён", { show_alert: true });
          return res.sendStatus(200);
        }
        if (
          lead.manager_telegram_id != null &&
          Number.isFinite(userId) &&
          Number(lead.manager_telegram_id) !== userId
        ) {
          await answerCallback(query.id, "Уже взято другим", { show_alert: true });
          return res.sendStatus(200);
        }
        lead.status = "in_work";
        lead.manager = displayName;
        lead.manager_telegram_id = userId;
      } else if (action === "done") {
        if (st === "closed" || st === "rejected") {
          await answerCallback(query.id, "Уже закрыто", { show_alert: true });
          return res.sendStatus(200);
        }
        if (st === "in_work") {
          if (
            lead.manager_telegram_id != null &&
            Number.isFinite(userId) &&
            Number(lead.manager_telegram_id) !== userId
          ) {
            await answerCallback(query.id, "Может закрыть только ответственный", {
              show_alert: true,
            });
            return res.sendStatus(200);
          }
        }
        lead.status = "closed";
      } else if (action === "reject") {
        if (st === "closed" || st === "rejected") {
          await answerCallback(query.id, "Уже закрыто", { show_alert: true });
          return res.sendStatus(200);
        }
        if (st === "in_work") {
          if (
            lead.manager_telegram_id != null &&
            Number.isFinite(userId) &&
            Number(lead.manager_telegram_id) !== userId
          ) {
            await answerCallback(query.id, "Может отметить только ответственный", {
              show_alert: true,
            });
            return res.sendStatus(200);
          }
        }
        lead.status = "rejected";
      }

      writeDB(db);

      const text = buildLeadTelegramHtml(lead);
      const keyboard = buildLeadInlineKeyboard(lead);
      await editTelegramMessage(messageId, text, keyboard);
      await answerCallback(query.id, "Обновлено");
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("[telegram-webhook]", err);
    return res.sendStatus(500);
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

/**
 * href="catalog.html" на странице /product/x.html резолвится в /product/catalog.html (404).
 * Принудительно ведём основные страницы с корня.
 */
function rootifyHtmlPageHrefs(html) {
  return String(html || "").replace(
    /\bhref=(["'])(catalog|index|about|category|product)\.html(#[^"']*|)\1/gi,
    (m, q, name, hash) => `href=${q}/${name}.html${hash}${q}`
  );
}

const PRODUCT_HTML_PATH = path.join(__dirname, "product.html");

app.get("/catalog", (req, res) => {
  res.sendFile(path.join(__dirname, "catalog.html"));
});

/** Статический sitemap.xml и robots.txt отдаются через express.static(__dirname). */

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
        "<!DOCTYPE html><html lang=\"ru\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Товар не найден — ZWILLON</title></head><body style=\"margin:0;background:#0B0B0B;color:#fff;font-family:system-ui\"><main style=\"max-width:860px;margin:0 auto;padding:56px 24px\"><h1 style=\"margin:0 0 14px;font-size:32px;line-height:1.2\">Товар не найден</h1><p style=\"margin:0 0 26px;color:#aaa;line-height:1.65\">Похоже, такой карточки больше нет или ссылка устарела.</p><a href=\"/catalog.html\" style=\"display:inline-block;padding:12px 18px;border-radius:12px;background:#FFC107;color:#111;text-decoration:none;font-weight:700\">Вернуться в каталог</a></main></body></html>"
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
  let html = seo.injectProductSeoHtml(templateHtml, product, slug, siteBaseUrl(req));
  html = rootifyHtmlPageHrefs(html);
  res.type("html").send(html);
});

app.get("/product.html", (req, res) => {
  const id = String(req.query.id || "").trim();
  if (!id) {
    try {
      const raw = fs.readFileSync(PRODUCT_HTML_PATH, "utf8");
      return res.type("html").send(rootifyHtmlPageHrefs(raw));
    } catch {
      return res.sendFile(PRODUCT_HTML_PATH);
    }
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

/** «О компании» на главной; корневой URL — чтобы ссылки не ломались с вложенных страниц. */
app.get("/about.html", (_req, res) => {
  res.redirect(301, "/index.html#about");
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.path.includes(".")) {
    return res.status(404).send("Not found");
  }

  res.sendFile(path.join(__dirname, "index.html"));
});

console.log("SERVER STARTED OK");

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
