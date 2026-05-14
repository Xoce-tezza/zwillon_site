document.addEventListener("DOMContentLoaded", () => {
  const Z = window.ZWILLON;
  if (!Z) {
    console.error("[category] zwillon-shared.js не подключён");
    return;
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  Z.bindMobileMenu(document.getElementById("menuBtn"), document.getElementById("mobilePanel"));

  function getQueryParam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function productCardMarkup(p) {
    const imageSrc =
      typeof Z.resolveProductImageUrl === "function"
        ? Z.resolveProductImageUrl(p)
        : Z.siteAssetImageSrc(p.image || (Array.isArray(p.images) ? p.images[0] : "") || "");
    const cat = Z.categoryLabel(p.category);
    const name = String(p.name_ru || "").trim();
    const oneLine = name.length > 72 ? name.slice(0, 70) + "…" : name;

    return `
      <article class="group card-apple flex flex-col h-full rounded-2xl border border-white/10 bg-[#111] overflow-hidden card-hover">
        <a href="${Z.escapeHtml(
          typeof Z.getProductPageUrlById === "function"
            ? Z.getProductPageUrlById(p.id)
            : "/product.html?id=" + encodeURIComponent(p.id)
        )}" class="block flex flex-col flex-1 min-h-0">
          <div class="relative min-h-[280px] bg-white flex items-center justify-center p-6">
            <img src="${Z.escapeHtml(imageSrc)}" onerror="this.onerror=null;this.src='${Z.escapeHtml(Z.PLACEHOLDER_IMAGE_SRC)}'" referrerpolicy="no-referrer" alt="${Z.escapeHtml(name)}" class="w-full h-full max-h-[320px] object-contain image-zoom transition-transform duration-500 ease-out" loading="lazy" />
          </div>
          <div class="px-5 pt-4 pb-3 flex flex-col flex-1">
            <p class="text-[11px] tracking-[.2em] uppercase text-[#888] font-medium">${Z.escapeHtml(cat)}</p>
            <h3 class="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-white">${Z.escapeHtml(oneLine || "—")}</h3>
          </div>
        </a>
        <div class="px-5 pb-5">
          <button type="button" class="w-full rounded-xl bg-accent text-black text-sm font-semibold py-3 shadow-accent btn-premium" onclick="openLeadModal(${JSON.stringify(name || "Товар")})">
            Запросить оптовую цену
          </button>
        </div>
      </article>
    `;
  }

  async function init() {
    const categoryParam = getQueryParam("category") || "posuda";
    const productGrid = document.getElementById("productGrid");
    const resultsCount = document.getElementById("resultsCount");
    const h1 = document.getElementById("categoryH1");
    const intro = document.getElementById("categoryIntro");

    if (!productGrid || !h1) return;

    h1.textContent = Z.categoryLabel(categoryParam);
    if (intro)
      intro.textContent =
        "Оптовый подбор для кафе, ресторанов, магазинов и маркетплейсов. Цены и наличие — по запросу.";

    try {
      const json = await Z.loadData();
      const products = Z.normalizeProductsFromJson(json);
      Z.setProductSlugCacheFromNormalized?.(products);
      const filtered = products.filter((p) => p.category === categoryParam);
      const list = filtered.length ? filtered : products;

      productGrid.innerHTML = list.map(productCardMarkup).join("");
      if (resultsCount) resultsCount.textContent = `Найдено: ${list.length}`;
    } catch (e) {
      console.warn("[category]", e?.message || e);
      productGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-white/10 bg-[#111] p-6 text-muted text-sm">Не удалось загрузить каталог. Используйте локальный сервер и проверьте data.json.</div>`;
      if (resultsCount) resultsCount.textContent = "Найдено: 0";
    }
  }

  init();
});
