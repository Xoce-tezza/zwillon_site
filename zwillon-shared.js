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

  initGa4Once();
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attachGa4ClickDelegation);
    } else {
      attachGa4ClickDelegation();
    }
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
    if (!s) return "catalog.html";
    if (!_productSlugCache || !_productSlugCache.idToSlug[s])
      return "product.html?id=" + encodeURIComponent(s);
    return "/product/" + encodeURIComponent(_productSlugCache.idToSlug[s]) + ".html";
  }

  function getProductIdFromSlug(slug) {
    const key = String(slug || "").replace(/\.html$/i, "").trim();
    if (!_productSlugCache || !key) return "";
    return String(_productSlugCache.slugToId[key] || "");
  }

  function stripHtmlLite(s) {
    return String(s || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function catalogDisplayCategory(name) {
    return getCategory(name);
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

  function hashPick(str, modulo) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % Math.max(1, modulo);
  }

  function hintsFromProductName(nameRaw) {
    const t = String(nameRaw || "").toLowerCase();
    return {
      stainless: /нерж|inox|сталь/i.test(t),
      ceramic: /керамик|фарфор|фаянс|камен/i.test(t),
      glass: /стекл|borosilicate|жаропрочн/i.test(t),
      cast: /чугун|cast/i.test(t),
      nonstick: /антипригар|non-?stick/i.test(t),
      large: /больш|xl|професс|pro/i.test(t),
      set: /набор|комплект|set/i.test(t),
    };
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

  /**
   * Структурированное описание под категорию: короткий текст, плюсы, строки характеристик, сценарий использования.
   * Тексты на русском, без шаблонных «лучший в мире».
   */
  function buildProductDescription(product) {
    const name = String(product.name_ru || product.name || "Позиция каталога").trim();
    const bucket = resolveDescriptionBucket(product);
    const label = getCategory(name);
    const h = hintsFromProductName(name);
    const v = hashPick(name, 4);
    const fromSpecs = specLinesFromProduct(product);

    let short = "";
    let benefits = [];
    let specifications = fromSpecs.slice();
    let useCase = "";

    const optCue =
      v % 2 === 0
        ? "Подходит под оптовые партии: уточняем фасовку и маркировку под ваш склад или сеть."
        : "Для опта важны повторяемость качества и одинаковый внешний вид в партии — это учитываем при подборе.";

    if (bucket === "tehnika") {
      const angles = [
        `${name} рассчитана на рабочий ритм кухни: меньше ручных операций, выше предсказуемость результата на смене.`,
        `Позиция ${name} помогает выдерживать однотипные операции без «плывущих» настроек — удобно для сетевого стандарта.`,
        `${name} — про функциональность и устойчивую работу в нагрузке: форматы HoReCa и активная смена не страшны.`,
      ];
      short = `${angles[v]} ${optCue}`;
      benefits = [
        h.large
          ? "Ресурс и настройки ориентированы на интенсив: дольше держит темп без лишних простоев."
          : "Баланс мощности и компактности — проще встроить в линейку оборудования на кухне.",
        "Понятный функционал для персонала: меньше ошибок при передаче смены.",
        "Помогаем с документами и условиями поставки под B2B: сертификация и партии — по запросу.",
        "Можно согласовать регулярные поставки под прогноз спроса — меньше скачков по наличию.",
        v % 2 === 0
          ? "Сервис и расходники обсуждаем заранее — экономите время на закупке комплектующих."
          : "Сверим напряжение, интерфейс и комплектацию перед отгрузкой, чтобы не ловить сюрпризы на монтаже.",
      ].filter(Boolean);
      if (specifications.length < 2) {
        specifications.push(
          "Режим работы и комплектация уточняются под ваш объект и сценарий использования.",
          "Параметры мощности, производительности и совместимости согласовываем до резерва партии."
        );
      }
      useCase =
        "Оптимально для кафе, ресторанов с горячим цехом, кейтеринга и оптовых поставок в retail, где кухня работает в постоянном потоке. Для магазинов и маркетплейсов — стабильные карточки товара и понятные ожидания покупателя.";
    } else if (bucket === "posuda") {
      const mat = h.stainless
        ? "нержавеющей стали"
        : h.ceramic
          ? "керамики или фарфора"
          : h.glass
            ? "стекла или закалённого стекла"
            : h.cast
              ? "чугуна"
              : "подходящего под задачу материала";
      short = `${name} внимательно смотрится на подаче и в витрине: акцент на материале (${mat}), аккуратных линиях и том, как позиция живёт в ежедневной мойке и раздаче. ${optCue}`;
      benefits = [
        h.nonstick
          ? "Покрытие и уход продуманы под частый цикл готовки без лишней возни с застрявшей пищей."
          : "Форма и баланс удобны на линии: меньше микродвижений и случайных проливов на смене.",
        "Выдерживает регулярный цикл «готовка — охлаждение — мойка» без быстрой потери внешнего вида.",
        h.set
          ? "Набор согласован по стилю: проще выстроить сервировку и витрину как единый ансамбль."
          : "Универсальность под ваш сценарий: от демо-кухни до стандартной выдачи.",
        "Партии подбираем так, чтобы сроки и вложение в оборотный капитал оставались прогнозируемыми.",
        "При необходимости подскажем по сертификации, маркировке и логистике — работаем в опте прозрачно.",
      ];
      if (specifications.length < 2) {
        specifications.push(
          "Материал и отделка согласуются под ваш формат: от высокого потока гостей до спокойной премиальной подачи.",
          "Объём, габариты и совместимость с плитами/духовками — уточняем по карточке и образцам."
        );
      }
      useCase =
        "Зайдёт точкам HoReCa с активной подачей, банкетным форматом, столовым сетям и оптовым покупателям, которым нужна предсказуемая сервировка без визуального «шума» в партии.";
    } else if (bucket === "chainiki") {
      short = `${name} — про уверенную работу на плите и аккуратную подачу чая: важны толщина металла, баланс ручки и то, как позиция ведёт себя при ежедневном нагреве и охлаждении. ${optCue}`;
      benefits = [
        "Равномерный прогрев и устойчивость на конфорке — меньше сюрпризов в пиковые часы.",
        "Продуманный носик и крышка помогают наливать без лишних капель на скатерть и форму персонала.",
        "Подходит под регулярный цикл мытья и сушки: внешний вид дольше остаётся «витринным».",
        "Для опта можем подобрать партии с единым оттенком и фактурой — проще держать единый стиль сети.",
        "Согласуем упаковку и маркировку под ваш склад или маркетплейс.",
      ];
      if (specifications.length < 2) {
        specifications.push(
          "Объём и тип крышки/фильтра уточняются по модели и вашему сценарию заваривания.",
          "Совместимость с индукционными плитами — проверяем до брони партии."
        );
      }
      useCase =
        "Для кофеен с чайной линией, гостиниц, ресторанов с полноценным сервисом напитков и оптовых поставок в магазины домашнего инвентаря.";
    } else if (bucket === "accessories") {
      short = `${name} закрывает практичные задачи на кухне и в зале: скорость подготовки, аккуратная подача и меньше мелких задержек у линии. ${optCue}`;
      benefits = [
        "Эргономика и износостойкость под реальный ритм — не «игрушечный» уровень для витрины.",
        h.stainless || h.ceramic
          ? "Материал проще поддерживать в санитарном регламенте: меньше пятен и въевшейся грязи."
          : "Форма упрощает уборку и укладку на тележках/в ящиках — экономит минуты на смене.",
        "Хорошо сочетается с остальным инвентарём: проще собрать комплект под серию или бренд-зону.",
        "Партии стабильны по размеру и оттенку — важно для витрины и оптовых отгрузок.",
        "Можем сопроводить подбором по минимальному заказу и прогнозу повторных закупок.",
      ];
      if (specifications.length < 2) {
        specifications.push(
          "Точные размеры и вес — по запросу, ориентируемся на вашу техкарту и место хранения.",
          "Состав материала и допустимые температуры — подтверждаем перед отгрузкой."
        );
      }
      useCase =
        "Подходит кафе, барам, ресторанам с открытой кухней, кейтерингу и оптовым каналам, где ценят аккуратный бэк-офис и понятный внешний вид полки.";
    } else {
      short = `${name} — позиция из линейки ZWILLON для B2B: ориентируемся на то, как товар выглядит в партии, как ведёт себя в работе и что нужно именно вашим клиентам в Казахстане. ${optCue}`;
      benefits = [
        `Категория «${label}»: подберем аналоги, если нужен другой ценовой ярус или срок поставки.`,
        "Понятные условия опта: минимальная партия, документы и логистика — без размытых формулировок.",
        "Помогаем согласовать образцы и спецификацию, чтобы закупка не превратилась в лотерею.",
        "Работаем с горячим цехом, залом и складом — можно закрыть несколько направлений одним контактом.",
      ];
      if (specifications.length < 2) {
        specifications.push(
          "Технические детали и наличие по модели — уточняем после заявки.",
          "Сроки и график поставок согласуем под ваш оборот."
        );
      }
      useCase =
        "Для ресторанных групп, дистрибьюторов, магазинов horeca-инвентаря и маркетплейсов, где важны повторяемость качества и предсказуемые поставки.";
    }

    return {
      bucket,
      categoryLabel: label,
      short: short.replace(/\s+/g, " ").trim(),
      benefits,
      specifications,
      useCase: useCase.replace(/\s+/g, " ").trim(),
    };
  }

  /** Сниппет 140–160 символов из buildProductDescription — как на сервере (meta / OG / JSON-LD). */
  function metaDescriptionFromDescriptionData(product, d) {
    const name = (
      String(product.name_ru || product.name || "").trim() || "Товар ZWILLON"
    )
      .replace(/\s+/g, " ")
      .trim();
    const catLower = String(d.categoryLabel || "").toLowerCase();
    const b0 = (d.benefits[0] || "").replace(/\s+/g, " ").trim();
    let key = "";
    if (b0.length >= 22 && b0.length <= 92) {
      key = b0;
    } else {
      const parts = d.short.split(/(?<=[.!?])\s+/).filter(Boolean);
      key = (parts[0] || d.short).replace(/\.$/, "").trim();
      if (key.length > 90) {
        key = key.slice(0, 87).trim();
        const cut = key.lastIndexOf(" ");
        if (cut > 40) key = key.slice(0, cut);
        key += "…";
      }
    }
    const tail = " Оптом для кафе, ресторанов, HoReCa — ZWILLON, Казахстан.";
    function assemble(k) {
      const kk = String(k).replace(/\s+$/, "").replace(/\.+$/, "");
      return `${name}. ${kk}.${tail}`
        .replace(/\s+/g, " ")
        .replace(/\.\s*\./g, ".")
        .trim();
    }
    let out = assemble(key);
    if (out.length > 160) {
      const budget = 160 - name.length - tail.length - 3;
      let k2 = key;
      if (k2.length > budget) {
        k2 = k2.slice(0, Math.max(28, budget - 1)).trim();
        const ls = k2.lastIndexOf(" ");
        if (ls > 22) k2 = k2.slice(0, ls);
        k2 += "…";
      }
      out = assemble(k2);
    }
    if (out.length > 160) {
      out = out.slice(0, 157).trim();
      const ls = out.lastIndexOf(" ");
      if (ls > 110) out = out.slice(0, ls);
      out += "…";
    }
    if (out.length < 140) {
      out =
        `${name} — ${catLower} оптом для ресторанов, кафе и сетей HoReCa. Поставщик ZWILLON, Казахстан, документы B2B.`.replace(
          /\s+/g,
          " "
        );
    }
    if (out.length > 160) {
      out = out.slice(0, 157).trim();
      const ls = out.lastIndexOf(" ");
      if (ls > 100) out = out.slice(0, ls);
      out += "…";
    }
    if (out.length < 140) {
      out = `${out} Партии и логистика под запрос.`.replace(/\s+/g, " ").slice(0, 160);
    }
    return out.slice(0, 160);
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
    const h3 =
      'font-size:1.05rem;font-weight:700;color:#fff;margin:1.4rem 0 0.55rem;letter-spacing:-0.01em;';
    const benefitsLi = d.benefits
      .map(
        (b) =>
          `<li style="margin:0.4rem 0;color:rgba(255,255,255,.82);">${esc(b)}</li>`
      )
      .join("");
    const specItems = d.specifications.length
      ? d.specifications
          .map((line) => `<div class="spec-line">${esc(line)}</div>`)
          .join("")
      : `<div class="spec-line">Детали по запросу — пришлём спецификацию под вашу партию.</div>`;
    return (
      `<div class="product-desc-smart" style="font-size:15px;line-height:1.65;color:rgba(255,255,255,.78);">` +
      `<p style="color:rgba(255,255,255,.95);margin:0 0 1rem;">${esc(d.short)}</p>` +
      `<h3 style="${h3}">Плюсы для закупки</h3>` +
      `<ul style="margin:0.4rem 0 1.25rem 1.15rem;padding:0;list-style:disc;">${benefitsLi}</ul>` +
      `<h3 style="${h3}">Характеристики и детали</h3>` +
      `<div style="margin-bottom:1.25rem;">${specItems}</div>` +
      `<h3 style="${h3}">Где уместна позиция</h3>` +
      `<p style="color:rgba(255,255,255,.9);margin:0;">${esc(d.useCase)}</p>` +
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
    bindLeadModal,
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
