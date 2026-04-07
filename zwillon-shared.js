/**
 * ZWILLON — общие утилиты (один раз на страницу, без дублирования const в глобальной области).
 */
(function () {
  if (window.ZWILLON) return;

  const STORAGE_KEY = "zwillon_leads_v1";

  const CATEGORY_LABELS = {
    posuda: "Посуда",
    chainiki: "Чайники",
    tehnika: "Кухонная техника",
    accessories: "Аксессуары",
  };

  const PLACEHOLDER_IMAGE_SRC = "images/placeholder.png";
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

  function cloudinaryPublicIdFromRef(ref) {
    const s = stripUrlQuery(String(ref || "").trim());
    if (!s) return "";
    let pathPart = s;
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) {
      const abs = s.startsWith("//") ? "https:" + s : s;
      try {
        pathPart = new URL(abs).pathname;
      } catch {
        return "";
      }
    } else {
      pathPart = s.replace(/^\/+/, "");
    }
    const last = pathPart.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.[^.]+$/, "").trim();
  }

  /**
   * URL для <img>: локальные /images/… и zwillon.cn → Cloudinary public_id (без расширения).
   * Внешние абсолютные URL без /images/ оставляем как есть.
   */
  function cloudinaryImageSrc(raw) {
    const u = String(raw || "").trim();
    if (!u) return PLACEHOLDER_IMAGE_SRC;
    if (u.startsWith("data:")) return u;
    const baseOnly = stripUrlQuery(u);
    if (
      baseOnly === PLACEHOLDER_IMAGE_SRC ||
      /(^|\/)placeholder\.png$/i.test(baseOnly)
    ) {
      return PLACEHOLDER_IMAGE_SRC;
    }
    if (/res\.cloudinary\.com\/dyciy0kdx/i.test(baseOnly)) return u;

    if (!needsCloudinaryRewrite(baseOnly)) return u;

    const id = cloudinaryPublicIdFromRef(u);
    if (!id) return PLACEHOLDER_IMAGE_SRC;
    return CLOUDINARY_UPLOAD_BASE + id;
  }

  function rewriteImgTagsToCloudinary(root) {
    const docEl = root && root.querySelectorAll ? root : document;
    docEl.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;
      const next = cloudinaryImageSrc(src);
      if (next !== src) img.setAttribute("src", next);
    });
  }

  function normalizeImageUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("data:")) return s;
    if (s.startsWith("//")) return "https:" + s;
    if (s.startsWith("/")) return "https://zwillon.cn" + s;
    return s;
  }

  /** Как в ТЗ: пусто -> placeholder.png, // -> https: */
  function fixImage(url) {
    const u = String(url || "").trim();
    if (!u) return PLACEHOLDER_IMAGE_SRC;
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("http")) return u;
    return u;
  }

  /** Публичный URL картинки для UI: Cloudinary или внешний URL, локальный только placeholder. */
  function siteAssetImageSrc(url) {
    return cloudinaryImageSrc(url);
  }

  /** Критичная загрузка data.local.json без кэша. */
  async function loadData() {
    const res = await fetch("./data.local.json?cache=" + Date.now());
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

  function catalogDisplayCategory(name) {
    return getCategory(name);
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

  function phoneOk(v) {
    const digits = String(v || "").replace(/[^\d]/g, "");
    return digits.length >= 10;
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

  function bindLeadModal(opts) {
    const overlay = document.getElementById(opts.overlayId || "leadModalOverlay");
    const form = document.getElementById(opts.formId || "leadModalForm");
    const msg = document.getElementById(opts.msgId || "leadModalMsg");
    const closeBtn = document.getElementById(opts.closeId || "leadModalClose");
    const contextInput = document.getElementById(opts.contextInputId || "leadModalProduct");

    if (!overlay || !form) return { open: () => {}, close: () => {} };

    function open(ctx) {
      if (contextInput && ctx != null) contextInput.value = String(ctx);
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      msg?.classList.add("hidden");
    }

    function close() {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    closeBtn?.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      msg?.classList.add("hidden");

      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const company = String(fd.get("company") || "").trim();
      const comment = String(fd.get("comment") || "").trim();
      const context = String(fd.get("context") || "").trim();

      if (!name) {
        msg?.classList.remove("hidden");
        if (msg) msg.textContent = "Укажите имя.";
        return;
      }
      if (!phoneOk(phone)) {
        msg?.classList.remove("hidden");
        if (msg) msg.textContent = "Укажите корректный телефон.";
        return;
      }

      let leads = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        leads = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(leads)) leads = [];
      } catch {
        leads = [];
      }

      leads.push({
        id: String(Date.now()) + "_" + Math.random().toString(36).slice(2, 7),
        name,
        phone,
        company,
        message: comment || context,
        status: "new",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));

      if (msg) {
        msg.classList.remove("hidden");
        msg.textContent = "Заявка принята. Ответим с прайсом и условиями.";
      }
      form.reset();
      setTimeout(close, 900);
    });

    return { open, close };
  }

  window.ZWILLON = {
    STORAGE_KEY,
    CATEGORY_LABELS,
    normalizeImageUrl,
    fixImage,
    cloudinaryImageSrc,
    siteAssetImageSrc,
    loadData,
    unregisterServiceWorkers,
    getCategory,
    inferCategoryKey,
    escapeHtml,
    cleanDescription,
    cleanCatalogDescription,
    catalogDisplayCategory,
    normalizeProductsFromJson,
    categoryLabel,
    bindMobileMenu,
    bindLeadModal,
    phoneOk,
    getWhatsAppLinkGeneral,
    getWhatsAppLinkProduct,
    getWhatsAppLinkAdvanced,
  };

  unregisterServiceWorkers().catch(() => {});

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
