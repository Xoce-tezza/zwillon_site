window.openProduct = function openProduct(id) {
  const raw = String(id || "").trim();
  if (!raw) return;
  const Z = window.ZWILLON;
  try {
    sessionStorage.setItem("zwillon_pending_product_id", raw);
  } catch (_) {
    /* ignore */
  }
  if (Z && typeof Z.getProductPageUrlById === "function") {
    window.location.href = Z.getProductPageUrlById(raw);
    return;
  }
  window.location.href = "/product.html?id=" + encodeURIComponent(raw);
};

document.addEventListener("DOMContentLoaded", () => {
  const Z = window.ZWILLON;
  if (!Z) {
    console.error("[index] zwillon-shared.js не подключён");
    return;
  }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  Z.bindMobileMenu(document.getElementById("menuBtn"), document.getElementById("mobilePanel"));

  const waCta = document.getElementById("waCtaLink");
  if (waCta && typeof Z.getWhatsAppLinkGeneral === "function") {
    waCta.href = Z.getWhatsAppLinkGeneral();
  }

  let revealIo = null;
  function observeRevealIn(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const els = Array.from(scope.querySelectorAll("[data-reveal]")).filter((el) => !el.classList.contains("is-visible"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    if (!revealIo) {
      revealIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const delay = Number(el.dataset.delay || 0);
            el.style.transitionDelay = delay + "ms";
            el.classList.add("is-visible");
            revealIo.unobserve(el);
          });
        },
        { threshold: 0.15 }
      );
    }
    els.forEach((el) => revealIo.observe(el));
  }
  observeRevealIn(document);

  const parallaxEls = $$("[data-parallax]");
  if (parallaxEls.length) {
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
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  const header = $("#siteHeader");
  if (header) {
    const apply = () => header.classList.toggle("nav-scrolled", window.scrollY > 10);
    apply();
    window.addEventListener("scroll", () => requestAnimationFrame(apply), { passive: true });
  }

  const title = $("[data-hero-title]");
  const subtitle = $("[data-hero-subtitle]");
  const b2bLine = $("[data-hero-b2b]");
  const buttons = $("[data-hero-buttons]");
  if (title && subtitle && buttons) {
    const ease = "cubic-bezier(.2,.8,.2,1)";
    title.style.opacity = "0";
    title.style.transform = "translateY(14px)";
    subtitle.style.opacity = "0";
    subtitle.style.transform = "translateY(10px)";
    if (b2bLine) {
      b2bLine.style.opacity = "0";
      b2bLine.style.transform = "translateY(10px)";
      b2bLine.style.transition = "opacity 780ms " + ease + ", transform 780ms " + ease;
    }
    buttons.style.opacity = "0";
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
      if (b2bLine) {
        b2bLine.style.opacity = "1";
        b2bLine.style.transform = "translateY(0)";
      }
    }, 220);
    setTimeout(() => {
      buttons.style.opacity = "1";
      $$("a,button", buttons).forEach((b, i) => {
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

  /** Сырой путь к кадру (для главной — без `_1`, если есть другие). */
  function pickHomeProductImageRaw(product) {
    if (!product) return "";
    if (Array.isArray(product.images) && product.images.length > 0) {
      const filtered = product.images.filter((img) => !String(img || "").includes("_1"));
      const pick = filtered[0] || product.images[0];
      return String(pick || "").trim();
    }
    return String(product.image || "").trim();
  }

  function getCardImageSrc(product) {
    const raw = pickHomeProductImageRaw(product);
    if (Z.resolveProductImageUrlFromString) {
      return Z.resolveProductImageUrlFromString(raw);
    }
    const src = raw ? Z.siteAssetImageSrc(raw) : Z.PLACEHOLDER_IMAGE_SRC;
    const ph = Z.PLACEHOLDER_IMAGE_SRC;
    if (src && !Z.isPlaceholderImageSrc(src)) return src;
    return ph;
  }

  let heroProducts = [];
  let currentHero = 0;
  let heroSliderTimer = null;

  function updateHero() {
    const product = heroProducts[currentHero];
    const titleEl = document.querySelector(".hero-title");
    const subEl = document.querySelector(".hero-subtitle");
    if (!product || !titleEl || !subEl) return;

    const name = String(product.name_ru || product.name || "").trim() || "Товар";
    titleEl.textContent = name;
    subEl.textContent = "Минимальный заказ от 10 шт";

  }

  function initHeroSlider(normalized) {
    heroProducts = normalized.slice(0, 5);
    const imgEl = document.querySelector(".hero-image");
    if (!imgEl || !heroProducts.length) return;

    if (heroSliderTimer) {
      clearInterval(heroSliderTimer);
      heroSliderTimer = null;
    }

    currentHero = 0;
    updateHero();

    // Статичное hero-изображение для стабильного LCP. Меняем только текст первого товара.
  }

  function renderHomeProductCard(p) {
    const id = String(p.id || "");
    const name = String(p.name_ru || p.name || "").trim() || "Товар";
    const imgSrc = getCardImageSrc(p);
    const productHref =
      typeof Z.getProductPageUrlById === "function"
        ? Z.getProductPageUrlById(id)
        : "/product.html?id=" + encodeURIComponent(id);
    return `
      <article class="card reveal group rounded-2xl border border-white/10 bg-[#111] overflow-hidden flex flex-col h-full" data-reveal>
        <a href="${Z.escapeHtml(productHref)}" class="block flex flex-col h-full">
          <div class="relative bg-white flex items-center justify-center p-0 overflow-hidden rounded-t-2xl min-h-[220px]">
            <img src="${Z.escapeHtml(imgSrc)}" onerror="this.onerror=null;this.src='${Z.escapeHtml(Z.PLACEHOLDER_IMAGE_SRC)}'" referrerpolicy="no-referrer" alt="${Z.escapeHtml(name)}" class="image-zoom transition-transform duration-500 w-full h-[220px] object-contain" loading="lazy" />
          </div>
          <div class="p-5 flex flex-col flex-1">
            <h3 class="text-[16px] font-semibold leading-snug">${Z.escapeHtml(name)}</h3>
            <span class="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-accent text-black font-semibold shadow-accent btn-premium cursor-pointer">Подробнее</span>
          </div>
        </a>
      </article>
    `;
  }

  async function initHomeCatalogBlocks() {
    const grid = document.getElementById("homeProductGrid");
    if (!grid) return;
    try {
      const json = await Z.loadData();
      const normalized = Z.normalizeProductsFromJson(Array.isArray(json) ? json : []);
      if (!normalized.length) {
        grid.innerHTML = `<div class="col-span-full rounded-2xl border border-white/10 bg-[#111] p-6 text-muted text-sm">Товары пока не загружены.</div>`;
        return;
      }
      Z.setProductSlugCacheFromNormalized?.(normalized);
      grid.innerHTML = normalized.slice(0, 8).map(renderHomeProductCard).join("");
      observeRevealIn(grid);
      initHeroSlider(normalized);
    } catch (e) {
      console.warn("[index catalog]", e?.message || e);
      grid.innerHTML = `<div class="col-span-full rounded-2xl border border-white/10 bg-[#111] p-6 text-muted text-sm">Не удалось загрузить товары.</div>`;
    }
  }

  initHomeCatalogBlocks();
});
