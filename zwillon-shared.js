/**
 * ZWILLON — общие утилиты (один раз на страницу, без дублирования const в глобальной области).
 */
(function () {
  const GA4_MEASUREMENT_ID = "G-5CDGJ6LEM2";

  function initGa4Once() {
    if (window.__zwillonGa4Init) return;
    window.__zwillonGa4Init = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID, { send_page_view: true });
    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(GA4_MEASUREMENT_ID);
    const h = document.head || document.getElementsByTagName("head")[0];
    if (h) h.appendChild(s);
  }

  /** GA4 событие (после загрузки gtag — очередь через dataLayer уже работает). */
  function trackEvent(name, params) {
    if (typeof window.gtag !== "function") return;
    const n = String(name || "custom_event").slice(0, 100);
    const p =
      params && typeof params === "object" && !Array.isArray(params)
        ? params
        : {};
    window.gtag("event", n, p);
  }

  function attachGa4ClickDelegation() {
    if (window.__zwillonGa4Delegation || typeof document === "undefined")
      return;
    window.__zwillonGa4Delegation = true;
    document.addEventListener(
      "click",
      function (e) {
        const el = e.target.closest("a, button, [role='button']");
        if (!el) return;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        const href = (el.getAttribute("href") || "").trim();
        const onclick = el.getAttribute("onclick") || "";

        if (
          text.includes("Получить прайс") ||
          onclick.includes("openLeadModal")
        ) {
          trackEvent("click_get_price", {
            page_path: window.location.pathname || "",
            link_text: text.slice(0, 120),
          });
        }

        if (
          /wa\.me|whatsapp\.com|api\.whatsapp/i.test(href) ||
          /\bwhatsapp\b/i.test(el.className || "")
        ) {
          const productHint =
            el.getAttribute("data-product-name") ||
            el.getAttribute("data-product") ||
            "";
          trackEvent("click_whatsapp", {
            page_path: window.location.pathname || "",
            link_url: href.slice(0, 500),
            ...(productHint ? { product: productHint.slice(0, 120) } : {}),
          });
        }
      },
      true
    );
  }

  if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
      initGa4Once();
      attachGa4ClickDelegation();
    });
  }

  if (window.ZWILLON) {
    window.ZWILLON.trackEvent = trackEvent;
    window.ZWILLON.GA4_MEASUREMENT_ID = GA4_MEASUREMENT_ID;
    if (typeof window.trackEvent !== "function") window.trackEvent = trackEvent;
    return;
  }

  const STORAGE_KEY = "zwillon_leads_v1";

  const CATEGORY_LABELS = {
    posuda: "Посуда",
    chainiki: "Чайники",
    tehnika: "Кухонная техника",
    accessories: "Аксессуары",
  };

  /** Относительный путь: работает при открытии с корня сайта и через file:// */
  const PLACEHOLDER_IMAGE_SRC = "images/placeholder.png";
  /** CDN: кадры каталога из JSON (пути /images/… или zwillon.cn) собираются в URL вида …/image/upload/&lt;public_id&gt; */
  const CLOUDINARY_UPLOAD_BASE =
    "https://res.cloudinary.com/dyciy0kdx/image/upload/";

  function stripUrlQuery(s) {
    const i = String(s || "").indexOf("?");
    return i === -1 ? String(s || "") : String(s || "").slice(0, i);
  }

  function needsCloudinaryRewrite(sNoQuery) {
    const s = String(sNoQuery || "").trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) {
      const abs = s.startsWith("//") ? "https:" + s : s;
      try {
        const { hostname, pathname } = new URL(abs);
        if (/zwillon\.cn$/i.test(hostname)) return true;
        if (/\/images\//i.test(pathname)) return true;
        return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * public_id для Cloudinary: только имя файла из пути, минус расширение.
   * Нельзя резать по «_» — в базе id вида hash_2, hash_3 (суффикс кадра).
   */
  function extractCloudinaryPublicId(rawPath) {
    if (!rawPath) return "";
    let pathStr = stripUrlQuery(String(rawPath).trim());
    if (/^https?:\/\//i.test(pathStr) || pathStr.startsWith("//")) {
      try {
        pathStr = new URL(pathStr.startsWith("//") ? "https:" + pathStr : pathStr).pathname;
      } catch {
        return "";
      }
    }
    pathStr = pathStr.replace(/^\/+/, "");
    const segs = pathStr.split("/").filter(Boolean);
    const filename = segs[segs.length - 1] || "";
    if (!filename) return "";
    return filename.replace(/\.[^.]+$/, "").trim();
  }

  /**
   * URL для <img>: локальные /images/… и zwillon.cn → Cloudinary …/upload/&lt;public_id&gt;.
   * Внешние абсолютные URL без переписывания — как есть.
   */
  function cloudinaryImageSrc(raw) {
    const u = String(raw || "").trim();
    if (!u) return PLACEHOLDER_IMAGE_SRC;
    if (u.startsWith("data:")) return u;
    const baseOnly = stripUrlQuery(u);
    if (
      baseOnly === PLACEHOLDER_IMAGE_SRC ||
      baseOnly === "/images/placeholder.png" ||
      /(^|\/)images\/placeholder\.png$/i.test(baseOnly) ||
      /(^|\/)placeholder\.png$/i.test(baseOnly)
    ) {
      return PLACEHOLDER_IMAGE_SRC;
    }
    if (/res\.cloudinary\.com\/dyciy0kdx/i.test(baseOnly)) return u;

    if (!needsCloudinaryRewrite(baseOnly)) return u;

    const publicId = extractCloudinaryPublicId(baseOnly);
    if (!publicId) return PLACEHOLDER_IMAGE_SRC;
    return CLOUDINARY_UPLOAD_BASE + publicId;
  }

  function rewriteImgTagsToCloudinary(root) {
    // Cloudinary-замена отключена в production-режиме.
    void root;
  }

  function normalizeImageUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("data:")) return s;
    if (s.startsWith("//")) return "https:" + s;
    if (s.startsWith("/")) return "https://zwillon.cn" + s;
    return s;
  }

  /** true, если это заглушка (любая известная форма пути). */
  function isPlaceholderImageSrc(s) {
    const u = stripUrlQuery(String(s || "").trim());
    if (!u) return true;
    return /(^|\/)placeholder\.png$/i.test(u);
  }

  /**
   * Публичный URL для &lt;img&gt;: zwillon.cn и локальные /images/… из базы → Cloudinary (файлов в репозитории обычно нет).
   * Уже готовые абсолютные URL и data: остаются как есть где не требуется замена.
   */
  function siteAssetImageSrc(url) {
    const u = String(url || "").trim();
    if (!u) return PLACEHOLDER_IMAGE_SRC;
    const absolute = u.startsWith("//") ? "https:" + u : u;
    return cloudinaryImageSrc(absolute);
  }

  /** Первое непустое поле из объекта товара (как в JSON: image или images[]). */
  function firstProductImageRaw(item) {
    if (!item || typeof item !== "object") return "";
    const direct = String(item.image || "").trim();
    if (direct) return direct;
    const arr = Array.isArray(item.images) ? item.images : [];
    for (let i = 0; i < arr.length; i++) {
      const s = String(arr[i] || "").trim();
      if (s) return s;
    }
    return "";
  }

  /** Один URL для &lt;img&gt; из сырой строки (пусто → placeholder). */
  function resolveProductImageUrlFromString(raw) {
    const s = String(raw || "").trim();
    if (!s) return PLACEHOLDER_IMAGE_SRC;
    return siteAssetImageSrc(s);
  }

  /** Один URL для &lt;img&gt; из объекта товара (item.image || images[0] → Cloudinary или как есть). */
  function resolveProductImageUrl(item) {
    return resolveProductImageUrlFromString(firstProductImageRaw(item));
  }

  /**
   * Защита от 404: сначала осмысленный src, при ошибке — placeholder (без повторного onerror).
   * Вызовите после присвоения img.src.
   */
  function bindProductImageError(img) {
    if (!img || img.nodeType !== 1) return;
    const ph = PLACEHOLDER_IMAGE_SRC;
    img.onerror = function () {
      img.onerror = null;
      img.src = ph;
    };
  }

  /** Критичная загрузка data.local.json без кэша. */
  async function loadData() {
    const res = await fetch("/data.local.json?cache=" + Date.now());
    const data = await res.json();
    console.log("DATA LOADED:", Array.isArray(data) ? data.length : 0);
    return data;
  }

  /** Снимает зарегистрированные SW (ломают кэш/фетч). */
  async function unregisterServiceWorkers() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (_) {
      /* ignore */
    }
  }

  function inferCategoryKey(name) {
    const t = String(name || "").toLowerCase();
    if (/чайник|чайники/.test(t)) return "chainiki";
    if (/техника|оборуд|печ|гриль|фритюр|миксер|слайсер/.test(t)) return "tehnika";
    if (/аксесс|контейнер|лоток|венчик|щипц|ковш|совок/.test(t)) return "accessories";
    return "posuda";
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return m;
      }
    });
  }

  /** Убирает типичный мусор из скрапинга */
  function cleanDescription(raw) {
    let s = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    s = s.replace(/главная\s+страница.*$/i, "").trim();
    return s;
  }

  /**
   * Убирает хвост «Главная страница…» из скрапа; опционально обрезает maxLen символов (каталог — 300).
   */
  function cleanCatalogDescription(raw, maxLen) {
    let s = String(raw || "")
      .replace(/Главная страница.*?$/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (maxLen != null && Number(maxLen) > 0 && s.length > maxLen) s = s.slice(0, Number(maxLen));
    return s;
  }

  /** Категория по названию (авто, как в ТЗ). */
  function getCategory(name) {
    const n = String(name || "").toLowerCase();
    if (n.includes("кастрюля")) return "Посуда";
    if (n.includes("сковорода")) return "Посуда";
    if (n.includes("чайник")) return "Чайники";
    if (n.includes("доска")) return "Аксессуары";
    if (n.includes("нож") || n.includes("набор")) return "Аксессуары";
    if (n.includes("блендер") || n.includes("миксер")) return "Техника";
    return "Другое";
  }

  const CYR_FOR_SLUG = {
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
      if (CYR_FOR_SLUG[ch] !== undefined) out += CYR_FOR_SLUG[ch];
      else out += ch;
    }
    out = out
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return out.slice(0, 96);
  }

  let _productSlugCache = null;

  function buildProductSlugMaps(products) {
    const list = Array.isArray(products) ? products : [];
    const idToSlug = new Map();
    const slugToId = new Map();
    const used = new Set();
    for (const p of list) {
      const id = String(p.id != null ? p.id : "").trim();
      if (!id) continue;
      const name = String(p.name_ru || p.name || "").trim();
      let base =
        slugifyForSeo(name) || slugifyForSeo(id) || "item";
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
      idToSlug.set(id, slug);
      slugToId.set(slug, id);
    }
    return { idToSlug, slugToId };
  }

  function setProductSlugCacheFromNormalized(products) {
    const maps = buildProductSlugMaps(products);
    _productSlugCache = {
      idToSlug: Object.fromEntries(maps.idToSlug),
      slugToId: Object.fromEntries(maps.slugToId),
    };
  }

  function getProductPageUrlById(id) {
    const s = String(id || "").trim();
    if (!s) return "/catalog.html";
    if (!_productSlugCache || !_productSlugCache.idToSlug[s])
      return "/product.html?id=" + encodeURIComponent(s);
    return "/product/" + encodeURIComponent(_productSlugCache.idToSlug[s]) + ".html";
  }

  function getProductIdFromSlug(slug) {
    const key = String(slug || "").replace(/\.html$/i, "").trim();
    if (!_productSlugCache || !key) return "";
    return String(_productSlugCache.slugToId[key] || "");
  }

  /**
   * Бакет для текстов: посуда / техника / чайники / аксессуары / общий.
   * Учитывает ключ category (posuda, tehnika…), русские ярлыки и название.
   */
  function resolveDescriptionBucket(product) {
    const name = String(product.name_ru || product.name || "").toLowerCase();
    const key = String(product.category || "").toLowerCase();
    const label = getCategory(
      String(product.name_ru || product.name || "")
    ).toLowerCase();

    if (
      key === "tehnika" ||
      label.includes("техник") ||
      /блендер|миксер|тостер|мясорубк|слайсер|процессор|гриль|печь|фритюр|соковыжимал|йогуртниц|вафельниц|мультиварк|индукц|кофемашин/i.test(
        name
      )
    ) {
      return "tehnika";
    }
    if (
      key === "chainiki" ||
      label.includes("чайник") ||
      /чайник|кувал|заварочн/i.test(name)
    ) {
      return "chainiki";
    }
    if (
      key === "accessories" ||
      label.includes("аксессуар") ||
      /доска|нож|лоток|контейнер|венчик|щипц|ковш|совок|противень/i.test(name)
    ) {
      return "accessories";
    }
    if (
      key === "posuda" ||
      label.includes("посуд") ||
      label === "другое" ||
      /кастрюл|сковород|сотейник|котел|форм|кукотт|тарелк|миск|блюд|кружк|стопк|бокал/i.test(
        name
      )
    ) {
      return "posuda";
    }
    return "other";
  }

  function specLinesFromProduct(product) {
    const spec = product.specifications;
    const lines = [];
    if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      Object.keys(spec).forEach((k) => {
        const v = spec[k];
        if (v == null || v === "") return;
        lines.push(`${String(k).trim()}: ${String(v).trim()}`);
      });
    }
    return lines;
  }

  function buildProductDescription(product) {
    const name = String(product.name_ru || product.name || "Позиция каталога").trim();
    const bucket = resolveDescriptionBucket(product);
    const label = getCategory(name);
    const specs = specLinesFromProduct(product)
      .map((x) => String(x).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 5);

    let short = "";
    let features = [];
    if (bucket === "tehnika") {
      short = `${name} для кухни и кафе. Простая и надежная модель на каждый день.`;
      features = [
        "Простое управление",
        "Надежная работа в смене",
        "Подходит для ежедневной нагрузки",
        "Легко обслуживать",
      ];
    } else if (bucket === "chainiki") {
      short = `${name} для кухни, зала и чайной линии. Удобен для регулярной работы.`;
      features = [
        "Ровный нагрев",
        "Удобная ручка и носик",
        "Подходит для ежедневного использования",
        "Легко мыть",
      ];
    } else if (bucket === "accessories") {
      short = `${name} для кухни и сервиса. Практичная позиция для постоянной работы.`;
      features = [
        "Удобен в работе",
        "Износостойкий материал",
        "Подходит для ежедневного использования",
        "Простой уход",
      ];
    } else {
      short = `${name} для кухни и сервировки. Подходит для кафе, ресторанов и оптовых закупок.`;
      features = [
        "Удобен в ежедневной работе",
        "Надежный материал",
        "Подходит для постоянной нагрузки",
        "Простой уход",
      ];
    }

    const shortClean = short.replace(/\s+/g, " ").trim();
    const featuresClean = features
      .map((x) => String(x).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 5);
    const specsClean = (specs.length ? specs : ["Характеристики уточняются по запросу"]).slice(0, 5);

    return {
      bucket,
      categoryLabel: label,
      short: shortClean,
      features: featuresClean,
      specs: specsClean,
    };
  }

  /** Сниппет 140–160 символов из buildProductDescription — как на сервере (meta / OG / JSON-LD). */
  function metaDescriptionFromDescriptionData(product, d) {
    const name = (
      String(product.name_ru || product.name || "").trim() || "Товар ZWILLON"
    )
      .replace(/\s+/g, " ")
      .trim();
    const short = String(d.short || "").replace(/\s+/g, " ").trim();
    const leadFeature = String((d.features && d.features[0]) || "")
      .replace(/\s+/g, " ")
      .trim();
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

  function buildProductSeoTitle(p) {
    const name =
      String(p.name_ru || p.name || "").trim() || "Товар ZWILLON";
    return `Купить ${name} оптом | ZWILLON`;
  }

  function buildProductSeoDescription(p) {
    const d = buildProductDescription(p);
    return metaDescriptionFromDescriptionData(p, d);
  }

  function buildProductKeywords(p, descData) {
    const d = descData || buildProductDescription(p);
    const name = String(p.name_ru || p.name || "").trim();
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

  function applyProductDocumentSeo(p) {
    if (!p || typeof document === "undefined") return;
    try {
      const descData = buildProductDescription(p);
      document.title = buildProductSeoTitle(p);
      const md = document.querySelector('meta[name="description"]');
      if (md) {
        md.setAttribute(
          "content",
          metaDescriptionFromDescriptionData(p, descData)
        );
      }
      const kw = document.querySelector('meta[name="keywords"]');
      if (kw) kw.setAttribute("content", buildProductKeywords(p, descData));
      const ogd = document.querySelector('meta[property="og:description"]');
      if (ogd) {
        ogd.setAttribute(
          "content",
          metaDescriptionFromDescriptionData(p, descData)
        );
      }
    } catch (_) {}
  }

  /** HTML-блок описания для вставки на карточку (уже экранирован по полям). */
  function buildProductDescriptionHtml(product) {
    const d = buildProductDescription(product);
    const esc = escapeHtml;
    const featuresLi = d.features
      .map(
        (b) => `<li>${esc(b)}</li>`
      )
      .join("");
    const specItems = d.specs
      .map((line) => `<div class="spec-line">${esc(line)}</div>`)
      .join("");
    return (
      `<div class="product-description">` +
      `<p class="desc-short">${esc(d.short)}</p>` +
      `<ul class="desc-features">${featuresLi}</ul>` +
      `<div class="desc-specs">${specItems}</div>` +
      `</div>`
    );
  }

  function normalizeProductsFromJson(scraped) {
    const arr = Array.isArray(scraped) ? scraped : [];
    return arr.map((p) => {
      const images = Array.isArray(p.images) ? p.images : [];
      const name = String(p.name || p.name_ru || "");
      const image = images[0] ? normalizeImageUrl(images[0]) : "";
      return {
        id: String(p.id || p.url || images[0] || name || "zwillon_unknown"),
        name_ru: name,
        category: inferCategoryKey(name),
        image,
        images: images.map(normalizeImageUrl).filter(Boolean),
        description_ru: cleanDescription(p.description || p.description_ru || ""),
        specifications: p.specifications && typeof p.specifications === "object" ? p.specifications : {},
        url: p.url || "",
      };
    });
  }

  function categoryLabel(key) {
    return CATEGORY_LABELS[key] || key || "Каталог";
  }

  function normalizePhone(input) {
    let digits = String(input || "").replace(/\D/g, "");
    if (digits.startsWith("8")) {
      digits = "7" + digits.slice(1);
    }
    if (!digits.startsWith("7")) {
      digits = "7" + digits;
    }
    return "+" + digits;
  }

  function phoneOk(v) {
    const digits = normalizePhone(v).replace(/\D/g, "");
    return digits.length === 11;
  }

  const WA_ME_NUMBER = "77782388238";

  function getWhatsAppLinkAdvanced(product, formData = {}) {
    const fd = formData && typeof formData === "object" ? formData : {};
    const city = String(fd.city || "").trim() || "укажу";
    const person = String(fd.name || "").trim() || "не указано";
    const pName = product
      ? String(product.name || product.name_ru || "").trim()
      : "";
    const lines = [
      "Здравствуйте! Интересует оптовая закупка ZWILLON.",
      "",
    ];
    if (pName) {
      lines.push(`Товар: ${pName}`, "");
    }
    lines.push(
      `Город: ${city}`,
      `Имя: ${person}`,
      "",
      "Прошу отправить:",
      "— оптовый прайс",
      "— условия минимального заказа",
      "— наличие",
      "",
      "Готов к сотрудничеству."
    );
    const text = encodeURIComponent(lines.join("\n"));
    return `https://wa.me/${WA_ME_NUMBER}?text=${text}`;
  }

  function getWhatsAppLinkGeneral() {
    return getWhatsAppLinkAdvanced(null, {});
  }

  function getWhatsAppLinkProduct(product) {
    return getWhatsAppLinkAdvanced(product, {});
  }

  function bindMobileMenu(menuBtn, mobilePanel) {
    if (!menuBtn || !mobilePanel) return;
    menuBtn.addEventListener("click", () => {
      const isHidden = mobilePanel.classList.contains("hidden");
      if (isHidden) {
        mobilePanel.classList.remove("hidden");
        mobilePanel.classList.add("block");
        menuBtn.setAttribute("aria-expanded", "true");
      } else {
        mobilePanel.classList.add("hidden");
        mobilePanel.classList.remove("block");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
    mobilePanel.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobilePanel.classList.add("hidden");
        mobilePanel.classList.remove("block");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  window.ZWILLON = {
    STORAGE_KEY,
    CATEGORY_LABELS,
    PLACEHOLDER_IMAGE_SRC,
    isPlaceholderImageSrc,
    firstProductImageRaw,
    resolveProductImageUrlFromString,
    resolveProductImageUrl,
    bindProductImageError,
    normalizeImageUrl,
    cloudinaryImageSrc,
    siteAssetImageSrc,
    loadData,
    unregisterServiceWorkers,
    getCategory,
    inferCategoryKey,
    escapeHtml,
    cleanDescription,
    cleanCatalogDescription,
    normalizeProductsFromJson,
    slugifyForSeo,
    buildProductSlugMaps,
    setProductSlugCacheFromNormalized,
    getProductPageUrlById,
    getProductIdFromSlug,
    buildProductSeoTitle,
    buildProductSeoDescription,
    metaDescriptionFromDescriptionData,
    buildProductKeywords,
    applyProductDocumentSeo,
    resolveDescriptionBucket,
    buildProductDescription,
    buildProductDescriptionHtml,
    categoryLabel,
    bindMobileMenu,
    normalizePhone,
    phoneOk,
    getWhatsAppLinkGeneral,
    getWhatsAppLinkProduct,
    getWhatsAppLinkAdvanced,
    trackEvent,
    GA4_MEASUREMENT_ID,
  };

  unregisterServiceWorkers().catch(() => {});

  if (typeof window.trackEvent !== "function") window.trackEvent = trackEvent;

  if (typeof document !== "undefined") {
    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    function runImgRewrite() {
      rewriteImgTagsToCloudinary(document);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runImgRewrite);
    } else {
      runImgRewrite();
    }
  }
})();
