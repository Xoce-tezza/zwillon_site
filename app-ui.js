// UI слой: каталог, продукт, анимации, форма заявки.
// Требуется: app-data.js (window.ZWILLON_PRODUCTS / window.ZWILLON_CATEGORIES)

(function () {
  const STORAGE_KEY = "zwillon_leads_v1";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#039;";
        default: return m;
      }
    });
  }

  function normalizeImageUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("data:")) return s;
    if (s.startsWith("//")) return "https:" + s;
    if (s.startsWith("/")) return BASE_URL + s;
    // иногда встречается без протокола/с пробелами
    if (!/^https?:\/\//i.test(s)) {
      try {
        return new URL(s, window.location.href).href;
      } catch {
        return s;
      }
    }
    return s;
  }

  function setMeta({ title, description }) {
    if (title) document.title = title;
    if (description) {
      const el = $("meta[name='description']");
      if (el) el.setAttribute("content", description);
    }
  }

  function phoneOk(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits.length >= 10;
  }

  function getLeads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLead(lead) {
    const leads = getLeads();
    leads.push(lead);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }

  // Reveal animations (premium scroll reveal)
  function initReveals() {
    const revealEls = $$("[data-reveal]");
    if (!revealEls.length) return;

    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Number(el.dataset.delay || 0);
        el.style.transitionDelay = delay + "ms";
        el.classList.add("is-visible");
        io.unobserve(el);
      });
    }, { threshold: 0.15 });

    revealEls.forEach((el) => io.observe(el));
  }

  // Parallax: elements with data-parallax
  function initParallax() {
    const parallaxEls = $$("[data-parallax]");
    if (!parallaxEls.length) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight || 800;
      parallaxEls.forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed || 1);
        const rect = el.getBoundingClientRect();
        const rel = (rect.top + rect.height / 2 - vh / 2) / vh;
        const shift = clamp(-rel * 20 * speed, -20, 20);
        el.style.transform = "translateY(" + shift.toFixed(2) + "px)";
      });
    };

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function initNavbarScroll() {
    const header = $("#siteHeader");
    if (!header) return;

    const apply = () => {
      const scrolled = window.scrollY > 10;
      header.classList.toggle("nav-scrolled", scrolled);
    };

    apply();
    window.addEventListener(
      "scroll",
      () => requestAnimationFrame(apply),
      { passive: true }
    );
  }

  // Hero load animation (title/subtitle/buttons) — for landing pages
  function initHeroLoad() {
    const title = $("[data-hero-title]");
    const subtitle = $("[data-hero-subtitle]");
    const buttons = $("[data-hero-buttons]");
    if (!title || !subtitle || !buttons) return;

    // Basic JS animations; no heavy libs required.
    // 1) Title
    title.style.opacity = "0";
    title.style.transform = "translateY(14px)";
    subtitle.style.opacity = "0";
    subtitle.style.transform = "translateY(10px)";
    buttons.style.opacity = "0";

    const ease = "cubic-bezier(.2,.8,.2,1)";

    title.style.transition = "opacity 900ms " + ease + ", transform 900ms " + ease;
    subtitle.style.transition = "opacity 780ms " + ease + ", transform 780ms " + ease;
    buttons.style.transition = "opacity 780ms " + ease;

    requestAnimationFrame(() => {
      title.style.opacity = "1";
      title.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      subtitle.style.opacity = "1";
      subtitle.style.transform = "translateY(0)";
    }, 140);

    setTimeout(() => {
      buttons.style.opacity = "1";
      const ctas = $$("a,button", buttons);
      ctas.forEach((b, i) => {
        b.style.transformOrigin = "center";
        b.style.transition = "transform 700ms " + ease + ", filter 700ms " + ease;
        b.style.transform = "scale(.95)";
        b.style.filter = "brightness(.98)";
        setTimeout(() => {
          b.style.transform = "scale(1)";
          b.style.filter = "brightness(1.06)";
        }, i * 70);
      });
    }, 340);
  }

  function mockCharacteristics(product) {
    const c = product.category;
    if (c === "posuda") {
      return [
        "Материалы под ежедневный сервис",
        "Комплектность под HoReCa и розницу",
        "Упаковка для безопасной транспортировки",
        "Стабильность наличия в партиях"
      ];
    }
    if (c === "chainiki") {
      return [
        "Фокус на стабильном спросе",
        "Витринная привлекательность",
        "Партии с понятными сроками",
        "Поддержка регулярных закупок"
      ];
    }
    if (c === "tehnika") {
      return [
        "Модели под ежедневный ритм",
        "Подбор под формат кухни и сервиса",
        "Логистика по согласованному графику",
        "Комплектация под объём"
      ];
    }
    return [
      "Товары для повышения среднего чека",
      "Гибкая комплектация наборов",
      "Доступность в оптовых партиях",
      "Поддержка повторных продаж"
    ];
  }

  function statusHint(text) {
    return text ? text : "—";
  }

  function renderProductCard(product, index = 0) {
    const categoryLabel = (window.ZWILLON_CATEGORIES || []).find((c) => c.key === product.category)?.label || product.category;
    const Z = window.ZWILLON;
    const imageSrc =
      Z && typeof Z.siteAssetImageSrc === "function"
        ? Z.siteAssetImageSrc(product.image || "")
        : normalizeImageUrl(product.image) || product.image || "";
    return `
      <article class="reveal group card-hover rounded-2xl border border-white/10 bg-[#111] overflow-hidden flex flex-col h-full" data-reveal data-delay="${Math.min(index * 40, 220)}">
        <a href="${escapeHtml(
          window.ZWILLON && typeof window.ZWILLON.getProductPageUrlById === "function"
            ? window.ZWILLON.getProductPageUrlById(product.id)
            : "/product.html?id=" + encodeURIComponent(product.id)
        )}" class="block flex flex-col h-full">
          <div class="relative h-[240px] bg-white flex items-center justify-center p-4">
            <img src="${escapeHtml(imageSrc)}" onerror="this.src='/images/placeholder.png'" referrerpolicy="no-referrer" alt="${escapeHtml(product.name_ru)}" class="w-full h-full object-contain image-zoom transition-transform duration-500" loading="lazy" />
          </div>
          <div class="p-5 flex flex-col flex-1">
            <div class="text-xs tracking-[.18em] text-[#AAAAAA] font-semibold">${escapeHtml(categoryLabel)}</div>
            <h3 class="mt-2 text-[16px] font-semibold leading-snug">${escapeHtml(product.name_ru)}</h3>
            <p class="mt-2 text-sm text-[#AAAAAA] card-desc">${escapeHtml(product.description_ru)}</p>
            <div class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-accent text-black font-semibold shadow-accent transition duration-300 ease-in-out hover:brightness-110">
              Запросить цену
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderProducts(container, products) {
    if (!container) return;
    products.forEach((p) => console.log("RENDER PRODUCT:", p.id));
    container.innerHTML = products.map((p, i) => renderProductCard(p, i)).join("");
  }

  function initCatalogPage() {
    const grid = $("#productGrid");
    if (!grid) return;

    const products = window.ZWILLON_PRODUCTS || [];
    const categories = window.ZWILLON_CATEGORIES || [];

    if (
      window.ZWILLON &&
      typeof window.ZWILLON.setProductSlugCacheFromNormalized === "function"
    ) {
      window.ZWILLON.setProductSlugCacheFromNormalized(products);
    }

    const searchInput = $("#searchInput");
    const statusFilter = $("#categoryFilter");
    const sortBtn = $("#sortBtn");
    const sidebarCategories = $("#sidebarCategories");

    let sortDir = "desc";

    const normalizeCategory = (key) => {
      if (!key) return "all";
      if (key === "all") return "all";
      const exists = (categories || []).some((c) => c.key === key);
      return exists ? key : "all";
    };

    function apply() {
      const q = (searchInput?.value || "").toLowerCase().trim();
      let cat = normalizeCategory(statusFilter?.value || "all");

      let out = products.slice();
      if (cat !== "all") out = out.filter((p) => p.category === cat);
      if (cat !== "all" && out.length === 0) {
        // fallback: если данных под конкретную категорию нет — показываем всё
        cat = "all";
        out = products.slice();
      }
      if (q) {
        out = out.filter((p) => {
          const s = (p.name_ru + " " + p.description_ru).toLowerCase();
          return s.includes(q);
        });
      }
      // simple sort by id string (stable)
      out.sort((a, b) => (sortDir === "desc" ? String(b.id).localeCompare(String(a.id)) : String(a.id).localeCompare(String(b.id))));

      if (!out.length) {
        grid.innerHTML = `
          <div class="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-muted text-sm">
            Пока нет товаров по выбранным условиям.
          </div>
        `;
      } else {
        renderProducts(grid, out);
      }
      const countEl = $("#resultsCount");
      if (countEl) countEl.textContent = `Найдено: ${out.length}`;

      const activeLabel = $("#activeCategoryLabel");
      if (activeLabel && categories?.length) {
        activeLabel.textContent =
          cat === "all"
            ? "Все категории"
            : (categories.find((c) => c.key === cat)?.label || cat);
      }

      // sync active sidebar state
      if (sidebarCategories && categories?.length) {
        const active = cat;
        sidebarCategories.querySelectorAll("button[data-cat]").forEach((b) => {
          const k = b.getAttribute("data-cat");
          const isActive = String(k) === String(active);
          b.classList.toggle("is-active", isActive);
        });
      }
    }

    // Sidebar render + handlers
    if (sidebarCategories && Array.isArray(categories) && categories.length) {
      const current = normalizeCategory(statusFilter?.value || "all");
      sidebarCategories.innerHTML = `
        <button type="button" class="sidebar-cat is-active" data-cat="all">Все категории</button>
        ${categories.map((c) => `
          <button type="button" class="sidebar-cat" data-cat="${escapeHtml(c.key)}">${escapeHtml(c.label)}</button>
        `).join("")}
      `;

      // initial active
      sidebarCategories.querySelectorAll("button[data-cat]").forEach((b) => {
        const k = b.getAttribute("data-cat");
        const isActive = String(k) === String(current);
        b.classList.toggle("is-active", isActive);
      });

      sidebarCategories.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("button[data-cat]") : null;
        if (!btn) return;
        const key = btn.getAttribute("data-cat") || "all";
        if (statusFilter) {
          statusFilter.value = key;
        }
        apply();
      });
    }

    if (searchInput) searchInput.addEventListener("input", apply);
    if (statusFilter) statusFilter.addEventListener("change", apply);
    if (sortBtn) {
      sortBtn.addEventListener("click", () => {
        sortDir = sortDir === "desc" ? "asc" : "desc";
        sortBtn.textContent = "Сортировка: " + (sortDir === "desc" ? "новые ↓" : "старые ↑");
        apply();
      });
    }

    // Initial
    apply();

    // Active category label (optional)
    const label = $("#activeCategoryLabel");
    if (label && categories.length) {
      const initial = statusFilter?.value || "all";
      label.textContent = initial === "all" ? "Все категории" : (categories.find((c) => c.key === initial)?.label || initial);
    }
  }

  function initCategoryPage() {
    const grid = $("#productGrid");
    if (!grid) return;

    const products = window.ZWILLON_PRODUCTS || [];
    const categories = window.ZWILLON_CATEGORIES || [];
    const catFromQuery = getQueryParam("category") || "";
    const catFromBody = document.body?.dataset?.categoryKey || "";
    const cat = catFromQuery || catFromBody;

    const category = categories.find((c) => c.key === cat) || { key: cat, label: cat };
    const h1 = $("#categoryH1");
    if (h1) h1.textContent = category.label;
    setMeta({
      title: `Каталог — ${category.label} | ZWILLON`,
      description: `Каталог продукции категории «${category.label}». Посуда оптом и кухонные решения для B2B.`
    });

    const list = products.filter((p) => p.category === category.key);
    renderProducts(grid, list);
    const countEl = $("#resultsCount");
    if (countEl) countEl.textContent = `Найдено: ${list.length}`;

    const intro = $("#categoryIntro");
    if (intro) intro.textContent = "Подбираем партии под ваш оборот: оптовая логика, стабильные сроки и аккуратная упаковка.";
  }

  function initProductPage() {
    const productH1 = $("#productH1");
    const img = $("#productImage");
    const desc = $("#productDescription");
    const meta = $("#productMeta");
    const chars = $("#productCharacteristics");
    const btn = $("#requestPriceBtn");
    if (!productH1 || !img || !desc || !chars) return;

    const products = window.ZWILLON_PRODUCTS || [];
    const id = getQueryParam("id");
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) {
      productH1.textContent = "Товар не найден";
      desc.textContent = "Перейдите в каталог и выберите позицию.";
      return;
    }

    const categories = window.ZWILLON_CATEGORIES || [];
    const catLabel = categories.find((c) => c.key === product.category)?.label || product.category;

    productH1.textContent = product.name_ru;
    img.src = product.image;
    img.alt = product.name_ru;
    desc.textContent = product.description_ru;

    meta && (meta.textContent = "Категория: " + catLabel);

    const specsObj = product?.specifications;
    let list = null;
    if (specsObj && typeof specsObj === "object" && Object.keys(specsObj).length) {
      list = Object.entries(specsObj).map(([k, v]) => `${k}: ${v}`);
    } else {
      list = mockCharacteristics(product);
    }

    chars.innerHTML = list
      .map((x) => `<li class="flex items-start gap-2"><span class="mt-1 w-2 h-2 rounded-full bg-accent2 shrink-0"></span><span>${escapeHtml(x)}</span></li>`)
      .join("");

    setMeta({
      title: `${product.name_ru} | ZWILLON`,
      description: `Оптовая продукция: «${product.name_ru}». Поставки партиями для B2B и HoReCa.`
    });

    // Request button opens modal with context
    if (btn) {
      btn.addEventListener("click", () => openLeadModal({ product: product.name_ru, category: catLabel }));
    }
  }

  function openLeadModal({ product = "", category = "" } = {}) {
    const overlay = $("#leadModalOverlay");
    if (!overlay) return;

    const modal = $(".lead-modal", overlay);
    const form = $("#leadModalForm", overlay);
    const productField = $("#leadModalProduct", overlay);

    if (productField) productField.value = [product, category].filter(Boolean).join(" — ");

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const close = $("#leadModalClose", overlay);
    close?.focus();
  }

  function closeLeadModal() {
    const overlay = $("#leadModalOverlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function initLeadModal() {
    const overlay = $("#leadModalOverlay");
    if (!overlay) return;

    const close = $("#leadModalClose", overlay);
    close?.addEventListener("click", closeLeadModal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeLeadModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLeadModal();
    });

    const form = $("#leadModalForm", overlay);
    const msg = $("#leadModalMsg", overlay);
    form?.addEventListener("submit", (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const company = String(fd.get("company") || "").trim();
      const comment = String(fd.get("comment") || "").trim();
      const context = String(fd.get("context") || "").trim();

      msg.classList.add("hidden");
      if (!name) {
        msg.classList.remove("hidden");
        msg.textContent = "Укажите имя.";
        return;
      }
      if (!phoneOk(phone)) {
        msg.classList.remove("hidden");
        msg.textContent = "Укажите корректный телефон.";
        return;
      }

      saveLead({
        id: String(Date.now()) + "_" + Math.random().toString(36).slice(2, 7),
        name,
        phone,
        company,
        message: context ? (comment ? comment + "\n\n" + context : context) : comment,
        status: "new",
        createdAt: new Date().toISOString()
      });

      msg.classList.remove("hidden");
      msg.textContent = "Заявка сохранена. Мы свяжемся с вами в ближайшее время.";
      form.reset();
      setTimeout(() => closeLeadModal(), 900);
    });
  }

  // Boot per page
  window.ZWILLON_UI = {
    init() {
      initReveals();
      initParallax();
      initNavbarScroll();
      initHeroLoad();
      initLeadModal();

      // catalog/category/product routing
      const catalogGrid = $("#productGrid");
      const isCatalog = $("#catalogTop") || $("#resultsCount") && $("#searchInput");
      if (isCatalog) initCatalogPage();

      const categoryH1 = $("#categoryH1");
      if (categoryH1) initCategoryPage();

      const productH1 = $("#productH1");
      if (productH1) initProductPage();

      // Common lead form on landing page
      const leadForm = $("#leadForm");
      const leadMsg = $("#formMsg");
      if (leadForm && leadMsg) {
        leadForm.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(leadForm);
          const name = String(fd.get("name") || "").trim();
          const phone = String(fd.get("phone") || "").trim();
          const company = String(fd.get("company") || "").trim();
          const comment = String(fd.get("comment") || fd.get("message") || "").trim();

          leadMsg.classList.remove("hidden");

          if (!name) {
            leadMsg.textContent = "Укажите имя.";
            return;
          }
          if (!phoneOk(phone)) {
            leadMsg.textContent = "Укажите корректный телефон.";
            return;
          }

          saveLead({
            id: String(Date.now()) + "_" + Math.random().toString(36).slice(2, 7),
            name,
            phone,
            company,
            message: comment,
            status: "new",
            createdAt: new Date().toISOString()
          });

          leadMsg.textContent = "Заявка отправлена. Мы свяжемся с вами в ближайшее время.";
          leadForm.reset();
        });
      }
    }
  };

  // Вынесем для удобной интеграции между страницами
  window.ZWILLON_UI.openLeadModal = openLeadModal;
  window.ZWILLON_UI.closeLeadModal = closeLeadModal;
})();

