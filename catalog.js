window.openProduct = function openProduct(id) {
  const raw = String(id || "").trim();
  console.log("OPEN PRODUCT WITH ID:", raw);
  if (!raw) {
    console.warn("OPEN PRODUCT: empty id");
    return;
  }
  try {
    sessionStorage.setItem("zwillon_pending_product_id", raw);
  } catch (_) {
    /* ignore */
  }
  window.location.href = "product.html?id=" + encodeURIComponent(raw);
};

window.filterCategory = function filterCategory(cat) {
  const evt = new CustomEvent("zwillon:filter-category", { detail: { cat } });
  window.dispatchEvent(evt);
};

document.addEventListener("DOMContentLoaded", () => {
  const Z = window.ZWILLON;
  if (!Z) {
    console.error("[catalog] zwillon-shared.js не подключён");
    return;
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  Z.bindMobileMenu(document.getElementById("menuBtn"), document.getElementById("mobilePanel"));

  const sidebarCategories = document.getElementById("sidebarCategories");
  const productGrid = document.getElementById("productGrid");
  const resultsCount = document.getElementById("resultsCount");
  const activeCategoryLabel = document.getElementById("activeCategoryLabel");
  const searchInput = document.getElementById("searchInput");
  const sortBtn = document.getElementById("sortBtn");

  let allProducts = [];
  let activeCategoryKey = "all";
  let sortAsc = true;

  function setMessage(html) {
    if (!productGrid) return;
    productGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-white/10 bg-[#111] p-6 text-muted text-sm">${html}</div>`;
  }

  function getMainImage(product) {
    const CLOUDINARY_BASE = "https://res.cloudinary.com/dyciy0kdx/image/upload/";

    function toCloudinarySrc(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const fileName = raw.split("/").pop() || "";
      const publicId = fileName.replace(/\.[^.]+$/, "").trim();
      if (!publicId) return "";
      return `${CLOUDINARY_BASE}${publicId}`;
    }

    const list = Array.isArray(product.images) ? product.images : [];
    for (const u of [list[1], list[0]]) {
      const src = toCloudinarySrc(u);
      if (src) return src;
    }
    return "images/placeholder.png";
  }

  function productCardMarkup(p) {
    const imageSrc = getMainImage(p);
    const cat = String(p.category || "Другое");
    const name = String(p.name_ru || "").trim();
    const id = String(p.id);

    return `
      <article class="card group card-apple flex flex-col h-full rounded-2xl border border-white/10 bg-[#111] overflow-hidden card-hover" role="listitem">
        <div class="block flex flex-col flex-1 min-h-0 cursor-pointer card-open" data-product-id="${Z.escapeHtml(id)}" tabindex="0">
          <div class="relative min-h-[240px] bg-white flex items-center justify-center p-5">
            <img src="${Z.escapeHtml(imageSrc)}" onerror="this.src='images/placeholder.png'" referrerpolicy="no-referrer" alt="${Z.escapeHtml(name || "Товар")}" class="w-full h-full max-h-[280px] object-contain image-zoom transition-transform duration-500 ease-out" loading="lazy" />
          </div>
          <div class="px-5 pt-4 pb-2 flex flex-col flex-1">
            <p class="text-[11px] tracking-[.2em] uppercase text-[#888] font-medium">${Z.escapeHtml(cat)}</p>
            <h3 class="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-white">${Z.escapeHtml(name || "—")}</h3>
          </div>
        </div>
        <div class="px-5 pb-5">
          <button type="button" class="w-full rounded-xl bg-accent text-black text-sm font-semibold py-3 shadow-accent btn-premium" onclick="openProduct('${id}')">
            Подробнее
          </button>
        </div>
      </article>
    `;
  }

  const CATEGORY_ORDER = ["Посуда", "Чайники", "Аксессуары", "Техника", "Другое"];

  function renderSidebar(catKeys, activeKey) {
    if (!sidebarCategories) return;
    sidebarCategories.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.dataset.cat = "all";
    allBtn.className = "sidebar-cat" + (activeKey === "all" ? " is-active" : "");
    allBtn.textContent = "Все позиции";
    sidebarCategories.appendChild(allBtn);

    const sorted = [...catKeys].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b, "ru");
    });

    sorted.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.cat = key;
      btn.className = "sidebar-cat" + (key === activeKey ? " is-active" : "");
      btn.textContent = key;
      sidebarCategories.appendChild(btn);
    });
  }

  function filteredList() {
    const q = (searchInput?.value || "").toLowerCase().trim();
    let list = allProducts.slice();

    if (activeCategoryKey !== "all") {
      list = list.filter((p) => String(p.category || "") === activeCategoryKey);
    }

    if (q) {
      list = list.filter((p) => {
        const s = (String(p.name_ru || "") + " " + String(p.description_ru || "")).toLowerCase();
        return s.includes(q);
      });
    }

    list.sort((a, b) => {
      const an = (a.name_ru || "").toLowerCase();
      const bn = (b.name_ru || "").toLowerCase();
      return sortAsc ? an.localeCompare(bn, "ru") : bn.localeCompare(an, "ru");
    });

    return list;
  }

  function rerender() {
    const list = filteredList();

    if (!list.length) {
      setMessage("В этой категории пока нет позиций или ничего не найдено. Смените фильтр или напишите нам — подберём аналог.");
      if (resultsCount) resultsCount.textContent = "Найдено: 0";
      if (activeCategoryLabel)
        activeCategoryLabel.textContent = activeCategoryKey === "all" ? "Все позиции" : activeCategoryKey;
      return;
    }

    list.forEach((p) => console.log("REAL PRODUCT ID:", p.id));
    if (productGrid) productGrid.innerHTML = list.map(productCardMarkup).join("");
    if (resultsCount) resultsCount.textContent = `Найдено: ${list.length}`;
    if (activeCategoryLabel)
      activeCategoryLabel.textContent = activeCategoryKey === "all" ? "Все позиции" : activeCategoryKey;

    productGrid?.querySelectorAll(".card-open").forEach((el) => {
      const go = () => {
        const id = el.getAttribute("data-product-id");
        if (id) openProduct(id);
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });
  }

  sortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    sortBtn.textContent = sortAsc ? "Сортировка: А → Я" : "Сортировка: Я → А";
    rerender();
  });

  sidebarCategories?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-cat]");
    if (!btn) return;
    activeCategoryKey = btn.dataset.cat || "all";
    sidebarCategories.querySelectorAll("button[data-cat]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.cat === activeCategoryKey);
    });
    rerender();
  });

  searchInput?.addEventListener("input", rerender);

  window.addEventListener("zwillon:filter-category", (e) => {
    const cat = e.detail?.cat;
    if (!cat || !sidebarCategories) return;
    activeCategoryKey = cat;
    sidebarCategories.querySelectorAll("button[data-cat]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.cat === activeCategoryKey);
    });
    rerender();
  });

  async function init() {
    try {
      if (productGrid) productGrid.innerHTML = "";
      const json = await Z.loadData();
      const raw = Array.isArray(json) ? json : [];
      allProducts = Z.normalizeProductsFromJson(raw).map((p) => {
        const desc = Z.cleanCatalogDescription(p.description_ru || p.description || "", 300);
        const name = String(p.name_ru || "").trim();
        return {
          ...p,
          name_ru: name,
          description_ru: desc,
          category: Z.getCategory(name),
        };
      });

      const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))];

      renderSidebar(categories, activeCategoryKey);
      if (sortBtn) sortBtn.textContent = "Сортировка: А → Я";
      rerender();
    } catch (e) {
      console.warn("[catalog]", e?.message || e);
      setMessage("Не удалось загрузить каталог. Проверьте, что <code class=\"text-accent\">data.json</code> лежит рядом со страницей, и откройте сайт через локальный сервер.");
      if (resultsCount) resultsCount.textContent = "Найдено: 0";
    }
  }

  init();
});
