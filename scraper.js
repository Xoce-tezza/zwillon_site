/* eslint-disable no-console */
/**
 * Полный каталог zwillon.cn — только Puppeteer.
 *
 * Шаги:
 * 1) Открыть /cpzx (каталог), при необходимости собрать доп. точки входа (вкладки/фильтры в меню).
 * 2) Для каждой категории: все страницы пагинации + скролл ленивой подгрузки.
 * 3) Собрать все URL товаров /productinfo/{id}.html (без дубликатов).
 * 4) При каждой новой ссылке с листинга — карточка товара (name, images, description, url) → data.json.
 *
 * Запуск:
 *   npm install
 *   node scraper.js
 *
 * Опции окружения:
 *   HEADLESS=0          — браузер с окном (отладка)
 *   MAX_PAGES=200       — макс. страниц листинга на одну категорию
 *   MAX_PRODUCTS=5000   — макс. товаров (страховка)
 *   SAVE_EVERY=5        — запись data.json каждые N сохранённых товаров
 *   START_URL=...       — точка входа (по умолчанию https://zwillon.cn/cpzx — весь каталог)
 *   SCRAPER_DEBUG=0     — выключить подробные логи отладки (по умолчанию включены)
 *   PAGINATION_WAIT_MS  — пауза после клика по JS-пагинации (мс, по умолчанию 3000)
 *   ProductInfoCategory  — обход пагинации на сайте-поставщике (кнопки «след. страница» / номера); ссылки в discovered-urls.json
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const puppeteer = require("puppeteer");

const BASE_ORIGIN = "https://zwillon.cn";
/** Полный каталог на странице «Продукт центр»: https://zwillon.cn/cpzx */
const CATALOG_URL = "https://zwillon.cn/cpzx";

const OUT_JSON = path.join(__dirname, "data.json");

/** Накопление товаров; периодически пишется в data.json, чтобы не терять прогресс. */
let products = [];

/** Сохранять data.json каждые N товаров (по умолчанию 5). */
const SAVE_EVERY = Math.max(1, Number(process.env.SAVE_EVERY) || 5);

function writeProductsSnapshot() {
  fs.writeFileSync(OUT_JSON, JSON.stringify(products, null, 2), "utf8");
  console.log("Saved products:", products.length);
}

/** Протокол-относительные URL картинок → https: */
function fixImageUrl(raw) {
  let s = String(raw || "").trim();
  if (!s || s.startsWith("data:")) return "";
  if (s.startsWith("//")) s = "https:" + s;
  return s;
}

/**
 * Сохранить товар в memory + периодический сброс на диск (дедуп по url).
 */
function persistScrapedProduct(item) {
  if (!item || !item.url || !item.name) return;
  const url = item.url.split("#")[0];
  if (products.find((p) => p.url === url)) return;
  products.push({ ...item, url });
  console.log("PRODUCT SAVED:", item.name);
  if (products.length % SAVE_EVERY === 0) writeProductsSnapshot();
}

/**
 * Сразу после появления новых ссылок на листинге — карточка товара и запись в data.json.
 */
async function scrapeDiscoveredBatch(productPage, urls) {
  if (!productPage || !urls?.length) return;
  for (const purl of urls) {
    if (products.length >= MAX_PRODUCTS_HARD) return;
    const canonical = purl.split("#")[0];
    if (products.find((p) => p.url === canonical)) continue;
    const item = await scrapeProductDetail(productPage, canonical);
    if (item) persistScrapedProduct(item);
    await sleep(250);
  }
}

const HEADLESS = process.env.HEADLESS !== "0";
const MAX_PAGES_PER_CATEGORY = Math.min(500, Math.max(1, Number(process.env.MAX_PAGES) || 200));
const MAX_PRODUCTS_HARD = Math.min(50000, Math.max(1, Number(process.env.MAX_PRODUCTS) || 20000));

const NAV_TIMEOUT_MS = 90000;
const SCROLL_PAUSE_MS = 600;
const MAX_SCROLL_ROUNDS = 80;
const STABLE_ROUNDS_NEEDED = 4;
const POST_GOTO_MS = 1200;
/** Пауза после клика по JS-пагинации (подгрузка списка). */
const PAGINATION_CLICK_WAIT_MS = Math.max(800, Number(process.env.PAGINATION_WAIT_MS) || 3000);

const DISCOVERED_URLS_JSON = path.join(__dirname, "discovered-urls.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Логи ADDING PRODUCT / INVALID ITEM / FOUND… / фрагмент HTML (SCRAPER_DEBUG=0 — тишина). */
const SCRAPER_DEBUG = process.env.SCRAPER_DEBUG !== "0";

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

async function gotoSafe(page, url, waitUntil = "domcontentloaded") {
  await Promise.race([
    page.goto(url, { waitUntil, timeout: NAV_TIMEOUT_MS }),
    sleep(NAV_TIMEOUT_MS + 2000).then(() => {
      throw new Error(`goto timeout: ${url}`);
    }),
  ]);
  await sleep(POST_GOTO_MS);
}

function isProductInfoCategoryUrl(urlStr) {
  try {
    const u = new URL(urlStr, BASE_ORIGIN);
    return /productinfocategory/i.test(u.pathname);
  } catch {
    return false;
  }
}

function flushDiscoveredUrlsToDisk(globalUrls) {
  const arr = [...globalUrls.entries()].map(([url, category]) => ({ url, category }));
  fs.writeFileSync(DISCOVERED_URLS_JSON, JSON.stringify(arr, null, 2), "utf8");
}

/**
 * Прогон страницы листинга (ленивая подгрузка) перед сбором ссылок.
 * Аналог «реального» скролла пользователя.
 */
async function autoScroll(page) {
  await scrollListingUntilStable(page);
}

/** Дождаться появления карточек с ссылками на товар (как waitForSelector для productinfo). */
async function waitForListingProductAnchors(page) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("a[href]")].some((a) =>
        /productinfo\/\d/i.test(a.getAttribute("href") || "")
      ),
    { timeout: NAV_TIMEOUT_MS }
  );
}

/**
 * Клик по «следующей странице» (локализованные подписи на сайте источника / Следующий / next), только внутри пагинации.
 * :contains() в CSS нет — ищем в DOM и вызываем .click() в браузере (в т.ч. javascript:void(0)).
 */
async function clickJsPaginationNextText(page) {
  return page.evaluate(() => {
    const rootSelectors = [
      ".pagination",
      ".pages",
      "ul.pages",
      "[class*='pagination']",
      "[class*='pageIndex']",
      "[class*='pageindex']",
      "[class*='pager']",
      "[class*='Paging']",
    ];
    const roots = [];
    for (const s of rootSelectors) {
      for (const el of document.querySelectorAll(s)) {
        if (el && !roots.includes(el)) roots.push(el);
      }
    }
    const searchRoots = roots.length > 0 ? roots : [document.body];

    const want = (el) => {
      const raw = String(el.textContent || "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const compact = raw.replace(/\s/g, "");
      const title = String(el.getAttribute("title") || "").toLowerCase();
      const al = String(el.getAttribute("aria-label") || "").toLowerCase();
      if (/下一页|下页|下一頁/.test(raw)) return true;
      if (/следующ|вперед|далее/i.test(raw)) return true;
      if (/^>+$|^›+$|^»+$/.test(compact)) return true;
      if (/next|следующ/i.test(title) || /next|следующ/i.test(al)) return true;
      return false;
    };

    for (const root of searchRoots) {
      for (const el of root.querySelectorAll("a, button, [role='button']")) {
        if (!want(el)) continue;
        if (el.closest?.(".disabled, [disabled], [aria-disabled='true']")) continue;
        const st = window.getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || st.pointerEvents === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        el.click();
        return true;
      }
    }
    return false;
  });
}

/**
 * Числовая пагинация: следующий номер (current+1) или, при необходимости, переход на максимальный видимый номер.
 */
async function clickJsPaginationNumeric(page) {
  return page.evaluate(() => {
    const norm = (s) => String(s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

    let current = -Infinity;
    for (const li of document.querySelectorAll("li, .page-item, [class*='page']")) {
      if (!/(active|current|selected|on)\b/i.test(li.className || "")) continue;
      const a = li.querySelector("a") || (li.tagName === "A" ? li : null);
      if (!a) continue;
      const t = norm(a.textContent).replace(/\s/g, "");
      if (/^\d+$/.test(t)) {
        current = parseInt(t, 10);
        break;
      }
    }

    if (!Number.isFinite(current)) {
      for (const a of document.querySelectorAll("a")) {
        if (!/(active|current|selected)\b/i.test(a.className || "")) continue;
        const t = norm(a.textContent).replace(/\s/g, "");
        if (/^\d+$/.test(t)) {
          current = parseInt(t, 10);
          break;
        }
      }
    }

    const links = [];
    for (const a of document.querySelectorAll(
      ".pagination a, .pages a, ul.pages a, [class*='pagination'] a, [class*='pageIndex'] a, [class*='page-num'] a, .page a, .pager a"
    )) {
      const t = norm(a.textContent).replace(/\s/g, "");
      if (!/^\d+$/.test(t)) continue;
      const n = parseInt(t, 10);
      if (a.closest?.(".disabled, [disabled], [aria-disabled='true']")) continue;
      const st = window.getComputedStyle(a);
      if (st.display === "none" || st.visibility === "hidden") continue;
      links.push({ n, a });
    }
    if (links.length === 0) return false;

    const sorted = [...links].sort((x, y) => x.n - y.n);
    const byN = (n) => links.find((x) => x.n === n);

    if (Number.isFinite(current)) {
      const next = sorted.find((x) => x.n === current + 1);
      if (next) {
        next.a.click();
        return true;
      }
    }

    const maxN = Math.max(...links.map((x) => x.n));
    if (Number.isFinite(current) && current < maxN) {
      const jump = byN(maxN);
      if (jump) {
        jump.a.click();
        return true;
      }
    }

    if (!Number.isFinite(current) || current === -Infinity) {
      const higher = sorted.find((x) => x.n >= 2);
      if (higher) {
        higher.a.click();
        return true;
      }
    }

    return false;
  });
}

async function listingPageSignature(page) {
  return page.evaluate(() => {
    const hrefs = [];
    for (const a of document.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href") || "";
      if (!/\/productinfo\/\d/i.test(h)) continue;
      try {
        hrefs.push(new URL(h, location.href).href.split("#")[0]);
      } catch {
        /* ignore */
      }
      if (hrefs.length >= 6) break;
    }
    return `${location.href.split("#")[0]}::${hrefs.join("|")}`;
  });
}

/**
 * Листинги вида ProductInfoCategory?categoryId=… — пагинация на JS (кнопки/span, не href).
 */
async function crawlProductInfoCategoryWithClickPagination(page, listUrl, categoryName, globalUrls, productPage) {
  const startKey = listUrl.split("#")[0];
  let pagesVisited = 0;
  let stagnation = 0;
  let lastSig = "";

  try {
    await gotoSafe(page, startKey, "domcontentloaded");
    await page.waitForSelector('a[href*="productinfo"], a[href*="ProductInfo"]', { timeout: NAV_TIMEOUT_MS }).catch(() =>
      waitForListingProductAnchors(page)
    );
  } catch (e) {
    console.warn(`[warn] ProductInfoCategory открытие: ${startKey}`, e.message);
    return 0;
  }

  while (pagesVisited < MAX_PAGES_PER_CATEGORY && stagnation < 4) {
    await autoScroll(page);

    const items = await extractProductUrlsOnPage(page);
    if (SCRAPER_DEBUG) console.log("[js-pagination] FOUND PRODUCTS ON PAGE:", items.length);

    const newlyDiscovered = [];
    for (const purl of items) {
      if (!globalUrls.has(purl)) {
        globalUrls.set(purl, categoryName);
        newlyDiscovered.push(purl);
      }
    }
    flushDiscoveredUrlsToDisk(globalUrls);
    await scrapeDiscoveredBatch(productPage, newlyDiscovered);

    const sig = await listingPageSignature(page);
    if (sig === lastSig && pagesVisited > 0) stagnation += 1;
    else stagnation = 0;
    lastSig = sig;

    pagesVisited += 1;

    let moved = await clickJsPaginationNextText(page);
    if (!moved) moved = await clickJsPaginationNumeric(page);

    if (!moved) {
      if (SCRAPER_DEBUG) console.log("[js-pagination] Кнопок следующей страницы нет — конец.");
      break;
    }

    await sleep(PAGINATION_CLICK_WAIT_MS);

    try {
      await waitForListingProductAnchors(page);
    } catch {
      stagnation += 1;
    }
  }

  return pagesVisited;
}

/** Листинг: режем шум (картинки/шрифты/аналитика) для скорости. Детальные страницы — отдельная вкладка без перехвата. */
async function attachListingInterception(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "image" || type === "media" || type === "font") return req.abort();
    const u = req.url().toLowerCase();
    if (
      u.includes("doubleclick") ||
      u.includes("googlesyndication") ||
      u.includes("google-analytics") ||
      u.includes("googletagmanager") ||
      u.includes("facebook.net") ||
      u.includes("hm.baidu.com")
    ) {
      return req.abort();
    }
    return req.continue();
  });
}

/**
 * Скролл до стабилизации: высота документа и/или число ссылок на товары не растут.
 */
async function scrollListingUntilStable(page) {
  let lastH = 0;
  let lastProducts = -1;
  let stable = 0;

  for (let i = 0; i < MAX_SCROLL_ROUNDS; i++) {
    const { h, productAnchors } = await page.evaluate(() => ({
      h: document.documentElement?.scrollHeight || document.body?.scrollHeight || 0,
      productAnchors: document.querySelectorAll('a[href*="productinfo/"]').length,
    }));

    if (h === lastH && productAnchors === lastProducts) stable += 1;
    else stable = 0;
    lastH = h;
    lastProducts = productAnchors;

    if (stable >= STABLE_ROUNDS_NEEDED) break;

    await page.evaluate(() => {
      window.scrollBy(0, Math.max(400, (window.innerHeight * 0.92) | 0));
    });
    await sleep(SCROLL_PAUSE_MS);

    if ((i + 1) % 12 === 0) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(SCROLL_PAUSE_MS);
    }
  }
}

/** Все URL товаров на текущей странице (после скролла). */
async function extractProductUrlsOnPage(page) {
  return page.evaluate((originHost) => {
    const out = new Set();
    /** zwillon: /productinfo/1234567.html (допускаем регистр и опциональный .html). */
    const re = /\/productinfo\/\d+(?:\.html)?$/i;
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
      let abs;
      try {
        abs = new URL(href, window.location.href).href;
      } catch {
        continue;
      }
      let u;
      try {
        u = new URL(abs);
      } catch {
        continue;
      }
      if (u.host !== originHost) continue;
      if (!re.test(u.pathname)) continue;
      out.add(abs.split("#")[0]);
    }
    return [...out];
  }, new URL(BASE_ORIGIN).host);
}

/**
 * Ссылки пагинации: контейнеры .pagination / .page, ссылки с page=…, номера страниц в тексте.
 */
async function extractPaginationUrls(page, listingUrl) {
  return page.evaluate((listingHref) => {
    const here = new URL(listingHref);
    const host = here.host;
    const herePath = here.pathname;
    const out = new Set();

    const addAbs = (href) => {
      if (!href) return;
      try {
        const u = new URL(href, window.location.href);
        if (u.host !== host) return;
        if (u.pathname.includes("/productinfo/")) return;
        out.add(u.href.split("#")[0]);
      } catch {
        /* ignore */
      }
    };

    const pagSelectors = [
      ".pagination a",
      ".pages a",
      ".page-num a",
      ".page a",
      "[class*='pagination'] a",
      "[class*='pageIndex'] a",
      "[class*='pageindex'] a",
      "a[href*='page=']",
      "a[href*='PageIndex']",
      "a[href*='pageindex']",
      "a[href*='currentPage']",
    ];
    for (const sel of pagSelectors) {
      for (const a of document.querySelectorAll(sel)) {
        addAbs(a.getAttribute("href"));
      }
    }

    for (const a of document.querySelectorAll("a[href]")) {
      const t = (a.textContent || "").replace(/\s+/g, "").trim();
      if (/^第?\d{1,4}页?$/.test(t) || /^\d{1,4}$/.test(t)) {
        addAbs(a.getAttribute("href"));
      }
    }

    const filtered = [...out].filter((href) => {
      let u;
      try {
        u = new URL(href);
      } catch {
        return false;
      }
      const keys = [...u.searchParams.keys()].map((k) => k.toLowerCase());
      const pageLike =
        keys.some((k) =>
          ["page", "pageindex", "p", "currentpage", "pagenum", "curpage", "pn", "pagenum"].includes(k)
        ) || /[?&](page|pageindex|p|currentpage|pagenum|curpage|pn)=\d+/i.test(href);
      const sameSection = u.pathname === herePath || u.pathname.replace(/\/$/, "") === herePath.replace(/\/$/, "");
      return pageLike || (sameSection && u.search.length > 1);
    });

    return filtered.slice(0, 250);
  }, listingUrl);
}

/** Перебор номеров страниц через query (если DOM пагинации не дал ссылок). */
function buildNumericPageUrls(baseUrl, pageNum) {
  const variants = [];
  const keys = ["page", "PageIndex", "p", "currentPage", "pagenum", "curPage", "pn"];
  try {
    const u = new URL(baseUrl);
    for (const key of keys) {
      const nu = new URL(baseUrl);
      nu.searchParams.set(key, String(pageNum));
      variants.push(nu.href);
    }
  } catch {
    /* ignore */
  }
  return uniq(variants);
}

/**
 * Собрать URL листингов: в первую очередь /cpzx, плюс ссылки с этой страницы (подразделы).
 */
async function discoverCategoryEntryUrls(page) {
  const catalogCanonical = CATALOG_URL.split("#")[0];
  await gotoSafe(page, catalogCanonical, "domcontentloaded");
  await scrollListingUntilStable(page);

  const raw = await page.evaluate((baseHost) => {
    const skipPath = (pathname) => {
      const p = pathname.toLowerCase();
      if (p.includes("/productinfo/")) return true;
      if (p.endsWith(".css") || p.endsWith(".js") || p.endsWith(".jpg") || p.endsWith(".png")) return true;
      return false;
    };

    const out = [];
    const seen = new Set();

    const tryAdd = (a) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) return;
      let u;
      try {
        u = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (u.host !== baseHost) return;
      if (skipPath(u.pathname)) return;
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 120) return;
      const clean = u.href.split("#")[0];
      if (seen.has(clean)) return;
      seen.add(clean);
      out.push({ url: clean, name: text || u.pathname });
    };

    // Сначала явное меню / шапка
    for (const a of document.querySelectorAll(
      "nav a[href], header a[href], .nav a[href], .menu a[href], [class*='menu'] a[href], [class*='nav'] a[href]"
    )) {
      tryAdd(a);
    }

    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
      let u;
      try {
        u = new URL(href, window.location.href);
      } catch {
        continue;
      }
      if (u.host !== baseHost) continue;
      if (skipPath(u.pathname)) continue;

      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      const p = u.pathname.toLowerCase();
      const q = u.search.toLowerCase();

      const looksCatalog =
        p.includes("cpzx") ||
        p.includes("product") ||
        p.includes("category") ||
        p.includes("list") ||
        p.includes("column") ||
        p.includes("channel") ||
        p.includes("goods") ||
        q.includes("category") ||
        q.includes("cid") ||
        q.includes("type") ||
        q.includes("class");

      const menuLike = text.length >= 1 && text.length < 80;

      if (looksCatalog && menuLike) tryAdd(a);
    }

    return out;
  }, new URL(BASE_ORIGIN).host);

  const primary = catalogCanonical;
  const extraStart = process.env.START_URL ? process.env.START_URL.split("#")[0] : null;

  const seedUrls = new Set([primary, ...raw.map((x) => x.url.split("#")[0])]);
  if (extraStart && extraStart !== primary) seedUrls.add(extraStart);

  const labeled = new Map();
  labeled.set(primary, "Каталог — Продукт центр (cpzx)");
  for (const r of raw) {
    const k = r.url.split("#")[0];
    if (!labeled.has(k)) labeled.set(k, r.name);
  }
  for (const u of seedUrls) {
    if (!labeled.has(u)) labeled.set(u, u.replace(BASE_ORIGIN, "") || "Раздел");
  }

  const ordered = [primary, ...[...seedUrls].filter((u) => u !== primary)];
  const seeds = ordered.map((url) => ({ url, name: labeled.get(url) || url }));

  return { seeds };
}

/**
 * Обход одного листинга: BFS по ссылкам пагинации + числовой перебор page/PageIndex/…
 */
async function crawlListingPage(browser, entry, globalUrls, productPage) {
  const { url: listUrl, name: categoryName } = entry;
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );
  await attachListingInterception(page);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  if (isProductInfoCategoryUrl(listUrl)) {
    const n = await crawlProductInfoCategoryWithClickPagination(page, listUrl, categoryName, globalUrls, productPage);
    await page.close();
    return n;
  }

  const visitedListing = new Set();
  const queue = [listUrl.split("#")[0]];
  let pagesVisited = 0;

  const harvest = async (key) => {
    if (visitedListing.has(key) || pagesVisited >= MAX_PAGES_PER_CATEGORY) return { found: 0, newAdded: 0 };
    visitedListing.add(key);
    pagesVisited += 1;

    try {
      await gotoSafe(page, key, "domcontentloaded");
    } catch (e) {
      console.warn(`[warn] listing goto: ${key}`, e.message);
      return { found: 0, newAdded: 0 };
    }

    await scrollListingUntilStable(page);
    const items = await extractProductUrlsOnPage(page);
    if (SCRAPER_DEBUG) console.log("FOUND PRODUCTS ON PAGE:", items.length);
    if (SCRAPER_DEBUG && items.length === 0) {
      const snippet = await page.evaluate(() => {
        const html = document.documentElement?.outerHTML || "";
        const max = 14000;
        return html.length > max ? `${html.slice(0, max)}\n<!-- … обрезано ${html.length - max} симв. … -->` : html;
      });
      console.log("LISTING PAGE HTML (partial):\n", snippet);
    }
    const newlyDiscovered = [];
    let newAdded = 0;
    for (const purl of items) {
      if (!globalUrls.has(purl)) {
        globalUrls.set(purl, categoryName);
        newlyDiscovered.push(purl);
        newAdded += 1;
      }
    }
    flushDiscoveredUrlsToDisk(globalUrls);
    await scrapeDiscoveredBatch(productPage, newlyDiscovered);
    return { found: items.length, newAdded };
  };

  while (queue.length && pagesVisited < MAX_PAGES_PER_CATEGORY) {
    const key = queue.shift();
    await harvest(key);

    try {
      const pag = await extractPaginationUrls(page, page.url());
      for (const p of pag) {
        const k = p.split("#")[0];
        try {
          const u = new URL(k);
          if (u.host !== new URL(BASE_ORIGIN).host) continue;
          if (/\/productinfo\/\d+\.html/i.test(u.pathname)) continue;
        } catch {
          continue;
        }
        if (!visitedListing.has(k)) queue.push(k);
      }
    } catch {
      /* ignore */
    }
  }

  // Числовая пагинация: ?page=N, ?PageIndex=N, … для исходного URL категории
  let emptyStreak = 0;
  for (let n = 2; n <= MAX_PAGES_PER_CATEGORY && emptyStreak < 4; n++) {
    const candidates = buildNumericPageUrls(listUrl, n);
    let roundNew = 0;
    for (const c of candidates) {
      const ck = c.split("#")[0];
      const { newAdded } = await harvest(ck);
      roundNew += newAdded;
    }
    if (roundNew === 0) emptyStreak += 1;
    else emptyStreak = 0;
  }

  await page.close();
  return pagesVisited;
}

async function scrapeProductDetail(productPage, url) {
  try {
    await gotoSafe(productPage, url, "domcontentloaded");
    await sleep(800);
    await scrollListingUntilStable(productPage);

    const data = await productPage.evaluate(() => {
      const absBase = window.location.href.split("#")[0];
      const normalizeText = (t) =>
        String(t || "")
          .replace(/\s+/g, " ")
          .replace(/\u00A0/g, " ")
          .trim();

      let name = normalizeText(document.querySelector("h1")?.textContent);
      if (!name) {
        for (const h of document.querySelectorAll("h1")) {
          const t = normalizeText(h.textContent);
          if (t && t.length < 600) {
            name = t;
            break;
          }
        }
      }
      if (!name) {
        const og = document.querySelector("meta[property='og:title']")?.getAttribute("content");
        if (og) name = normalizeText(og);
      }
      if (!name) {
        const rawTitle = (document.querySelector("title")?.textContent || "").trim();
        if (rawTitle) {
          const part = rawTitle.split(/\s*[-–—|｜]\s*/)[0];
          name = normalizeText(part);
        }
      }

      const images = [];
      const pushAbsLoose = (raw) => {
        if (!raw) return;
        const s = String(raw).trim();
        if (!s || s.startsWith("data:")) return;
        const fixed = s.startsWith("//") ? "https:" + s : s;
        try {
          images.push(new URL(fixed, absBase).href);
        } catch {
          /* ignore */
        }
      };

      for (const img of document.querySelectorAll("img")) {
        pushAbsLoose(img.getAttribute("src"));
        pushAbsLoose(img.getAttribute("data-src"));
        pushAbsLoose(img.getAttribute("data-original"));
      }

      const junk = (u) =>
        /ga_icon|favicon|logo|spacer|1x1|blank\.gif|pixel|analytics/i.test(u) ||
        /Designer\/Content\/images\//i.test(u);

      const uniqImg = [...new Set(images)].filter((u) => u && !junk(u));

      const trySel = (sel) => {
        const el = document.querySelector(sel);
        return el ? normalizeText(el.innerText) : "";
      };

      let description =
        trySel("main") ||
        trySel("article") ||
        trySel(".content") ||
        trySel(".product-detail") ||
        trySel("[class*='product-detail']");
      if (!description) {
        const meta = document.querySelector("meta[name='description']")?.getAttribute("content");
        if (meta) description = normalizeText(meta);
      }
      if (!description) {
        const bodyText = normalizeText(document.body?.innerText || "");
        description = bodyText ? bodyText.slice(0, 6000) : "";
      }

      return { name, images: uniqImg, description, url: absBase };
    });

    let pageUrl = url.split("#")[0];
    try {
      pageUrl = new URL(productPage.url()).href.split("#")[0];
    } catch {
      /* use url */
    }

    if (!data.name || !data.url) {
      if (SCRAPER_DEBUG) console.log("INVALID ITEM (no name/url in DOM):", { ...data, requestedUrl: url, pageUrl });
      return null;
    }

    const images = [...new Set((data.images || []).map(fixImageUrl).filter(Boolean))].filter(
      (u) => !/ga_icon|favicon|logo|spacer|1x1|blank\.gif|pixel|analytics/i.test(u)
    );

    const item = {
      id: sha1(pageUrl),
      name: data.name,
      images,
      description: data.description || "",
      url: pageUrl || data.url,
    };

    if (!item.url || !item.name) {
      if (SCRAPER_DEBUG) console.log("INVALID ITEM:", item);
      return null;
    }

    return item;
  } catch (e) {
    console.error(`[err] product ${url}`, e.message);
    return null;
  }
}

async function main() {
  products = [];
  writeProductsSnapshot();

  console.log("[scraper] Старт. Каталог:", CATALOG_URL);
  if (process.env.START_URL) console.log("[scraper] Доп. START_URL =", process.env.START_URL);
  console.log("[scraper] HEADLESS =", HEADLESS);
  console.log("[scraper] MAX_PAGES_PER_CATEGORY =", MAX_PAGES_PER_CATEGORY);
  console.log("[scraper] MAX_PRODUCTS_HARD =", MAX_PRODUCTS_HARD);
  console.log("[scraper] SAVE_EVERY =", SAVE_EVERY);

  let browser;
  /** url -> category name */
  const pagesPerCategory = [];

  try {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    });

    const discoverPage = await browser.newPage();
    await discoverPage.setViewport({ width: 1440, height: 900 });
    await discoverPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await attachListingInterception(discoverPage);
    discoverPage.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    const { seeds } = await discoverCategoryEntryUrls(discoverPage);
    await discoverPage.close();

    console.log("[scraper] Категории / точки входа:", seeds.length);
    seeds.slice(0, 30).forEach((s, i) => console.log(`  ${i + 1}. ${s.name} → ${s.url}`));
    if (seeds.length > 30) console.log(`  ... ещё ${seeds.length - 30}`);

    const globalProductUrls = new Map();

    const productPage = await browser.newPage();
    await productPage.setViewport({ width: 1440, height: 900 });
    await productPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    productPage.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    for (const entry of seeds) {
      const n = await crawlListingPage(browser, entry, globalProductUrls, productPage);
      pagesPerCategory.push({ name: entry.name, url: entry.url, listingPagesVisited: n });
      console.log(
        `[scraper] Категория «${entry.name}»: листингов ~${n}, всего уникальных товаров: ${globalProductUrls.size}`
      );
      if (globalProductUrls.size >= MAX_PRODUCTS_HARD) {
        console.log("[scraper] Достигнут MAX_PRODUCTS_HARD — останавливаем обход категорий.");
        break;
      }
    }

    const productUrls = [...globalProductUrls.keys()];
    console.log("[scraper] Всего уникальных URL товаров:", productUrls.length);

    let done = 0;
    for (const purl of productUrls) {
      if (products.length >= MAX_PRODUCTS_HARD) break;
      const canonical = purl.split("#")[0];
      if (products.find((p) => p.url === canonical)) {
        done += 1;
        continue;
      }
      process.stdout.write(`\r[scraper] Догрузка товаров ${done + 1}/${productUrls.length} ${purl.slice(-40)}`);
      const item = await scrapeProductDetail(productPage, canonical);
      if (item) persistScrapedProduct(item);
      else if (SCRAPER_DEBUG) console.log("INVALID ITEM:", item);
      done += 1;
      await sleep(250);
    }
    process.stdout.write("\n");

    await productPage.close().catch(() => {});

    writeProductsSnapshot();
  } catch (e) {
    console.error("[scraper] Ошибка во время работы:", e?.stack || e);
    try {
      writeProductsSnapshot();
    } catch (w) {
      console.error("[scraper] Не удалось сохранить data.json после сбоя:", w?.message || w);
    }
    throw e;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  console.log("[scraper] Готово:", OUT_JSON);
  console.log("[scraper] Сохранено товаров:", products.length);
  console.log("[scraper] Сводка по категориям (листинги):");
  pagesPerCategory.forEach((p) =>
    console.log(`  - ${p.name}: listingPagesVisited=${p.listingPagesVisited}`)
  );
}

main().catch((e) => {
  console.error("[scraper] FATAL:", e?.stack || e);
  process.exit(1);
});
