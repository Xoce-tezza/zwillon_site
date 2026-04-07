function esc(s) {
  return window.ZWILLON ? window.ZWILLON.escapeHtml(String(s)) : String(s);
}

function cleanDescription(text) {
  if (!text) return "";

  const cleaned = String(text)
    .replace(/[\u4e00-\u9fa5]+/g, "")
    .replace(/Главная страница.*?Свяжитесь с нами/gi, "")
    .replace(/Powered by.*$/gi, "")
    .replace(/ꄴ.*?ꄲ/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned
    .split(/(?=Модель|Материал|Размер|Цвет|Емкость|Мощность)/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!parts.length) return "";
  return parts.map((line) => `<div class="spec-line">${esc(line)}</div>`).join("");
}

function getGalleryImages(product) {
  const Z = window.ZWILLON;
  const toSrc = (u) => (Z && Z.siteAssetImageSrc ? Z.siteAssetImageSrc(u || "") : String(u || "").replace(/^\//, ""));
  const all = Array.isArray(product?.images) ? product.images : [];
  let paths = all.slice(1).map(toSrc).filter((s) => s && s !== "images/placeholder.png");
  if (!paths.length && all[0]) {
    const s = toSrc(all[0]);
    if (s && s !== "images/placeholder.png") paths = [s];
  }
  return paths.length ? paths : ["images/placeholder.png"];
}

let currentIndex = 0;

function enableZoom() {
  const img = document.getElementById("mainImage");
  if (!img) return;
  if (img.dataset.zoomBound === "1") return;
  img.dataset.zoomBound = "1";

  img.addEventListener("mousemove", (e) => {
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = "scale(1.8)";
  });

  img.addEventListener("mouseleave", () => {
    img.style.transform = "scale(1)";
    img.style.transformOrigin = "50% 50%";
  });
}

function updateImage(images) {
  if (!images.length) return;
  const img = document.getElementById("mainImage");
  if (img) {
    img.style.opacity = "0";
    setTimeout(() => {
      img.src = images[currentIndex];
      img.style.opacity = "1";
      img.onerror = function () {
        img.src = "images/placeholder.png";
      };
    }, 150);
  }

  document.querySelectorAll(".thumb").forEach((t, i) => {
    t.classList.toggle("active", i === currentIndex);
  });
}

window.nextImage = function nextImage() {
  const product = window.currentProduct;
  if (!product) return;
  const images = getGalleryImages(product);
  currentIndex = (currentIndex + 1) % images.length;
  updateImage(images);
};

window.prevImage = function prevImage() {
  const product = window.currentProduct;
  if (!product) return;
  const images = getGalleryImages(product);
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  updateImage(images);
};

window.selectImage = function selectImage(i) {
  const product = window.currentProduct;
  if (!product) return;
  const images = getGalleryImages(product);
  currentIndex = Math.max(0, Math.min(Number(i) || 0, images.length - 1));
  updateImage(images);
};

let startX = 0;
function ensureSwipe() {
  if (window.__zwillonSwipeBound) return;
  window.__zwillonSwipeBound = true;
  document.addEventListener("touchstart", (e) => {
    startX = e.touches?.[0]?.clientX || 0;
  });
  document.addEventListener("touchend", (e) => {
    const endX = e.changedTouches?.[0]?.clientX || 0;
    if (endX - startX > 50) window.prevImage();
    if (startX - endX > 50) window.nextImage();
  });
}

function renderProduct(p) {
  const container = document.querySelector(".product");

  if (!container) {
    document.body.insertAdjacentHTML("beforeend", '<p style="color:red;padding:24px">NO .product CONTAINER</p>');
    return;
  }

  const images = getGalleryImages(p);
  currentIndex = 0;
  const name = String(p.name || p.name_ru || "");
  const Z = window.ZWILLON;
  const waProductHref =
    Z && typeof Z.getWhatsAppLinkProduct === "function"
      ? Z.getWhatsAppLinkProduct(p)
      : "https://wa.me/77782388238";
  const scrapedBlock = cleanDescription(p.description || p.description_ru || "");
  let descriptionHtml = "";
  if (Z && typeof Z.buildProductDescriptionHtml === "function") {
    const smartBlock = Z.buildProductDescriptionHtml(p);
    descriptionHtml = scrapedBlock
      ? `<div class="desc-supplier mb-8 border-b border-white/10 pb-8">${scrapedBlock}</div>${smartBlock}`
      : smartBlock;
  } else {
    descriptionHtml =
      scrapedBlock || '<div class="spec-line">Описание уточняется.</div>';
  }

  container.innerHTML = `
    <div class="apple-product">
      <div class="gallery">
        <button class="gal-nav prev" type="button" onclick="prevImage()" ${images.length > 1 ? "" : "hidden"}>‹</button>
        <img id="mainImage" src="${esc(images[0])}" alt="${esc(name)}" class="main-img" referrerpolicy="no-referrer" onerror="this.src='images/placeholder.png'"/>
        <button class="gal-nav next" type="button" onclick="nextImage()" ${images.length > 1 ? "" : "hidden"}>›</button>

        <div class="thumbs">
          ${images
            .map(
              (img, i) => `
            <img
              src="${esc(img)}"
              class="thumb ${i === 0 ? "active" : ""}"
              data-index="${i}"
              onclick="selectImage(${i})"
              referrerpolicy="no-referrer"
              onerror="this.src='images/placeholder.png'"
            />
          `
            )
            .join("")}
        </div>
      </div>

      <div class="info">
        <h1>${esc(name)}</h1>
        <p class="b2b-hint">Данный товар доступен только для оптовых закупок</p>
        <div class="description">${descriptionHtml}</div>
        <div class="product-actions">
          <button type="button" class="cta" onclick="openProductLeadModal()">Запрос оптовой цены</button>
          <div class="wa-wrap">
            <a
              href="${esc(waProductHref)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn whatsapp whatsapp-pulse"
              data-product-name="${esc(name)}"
            >
              Получить прайс в WhatsApp
            </a>
            <p class="wa-trust">Ответим в течение 5–15 минут • Работаем только с оптом</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const meta = document.getElementById("productMeta");
  if (meta) meta.textContent = "B2B · запрос опта";

  setTimeout(() => {
    const card = document.querySelector(".apple-product");
    if (card) card.classList.add("show");
  }, 50);

  if (Z && typeof Z.applyProductDocumentSeo === "function") {
    Z.applyProductDocumentSeo(p);
  }
  if (Z && typeof Z.trackEvent === "function") {
    Z.trackEvent("view_product", {
      product_id: String(p.id || ""),
      product_name: String(p.name || p.name_ru || "").slice(0, 120),
      page_path: window.location.pathname || "",
    });
  }
}

async function loadData() {
  const res = await fetch("./data.local.json?cache=" + Date.now());
  const data = await res.json();
  console.log("DATA LOADED:", Array.isArray(data) ? data.length : 0);
  return data;
}

function readProductSlugFromPath() {
  const path = window.location.pathname || "";
  const m = path.match(/\/product\/([^/]+)\.html$/i);
  if (!m) return "";
  return decodeURIComponent(m[1] || "").trim();
}

function showProductError(title, hintHtml) {
  const slot = document.querySelector(".product");
  const html = `<div class="site-container py-10 px-4 text-white"><h1 class="text-2xl font-bold">${title}</h1><div class="mt-4 text-muted text-[15px] leading-relaxed">${hintHtml}</div></div>`;
  if (slot) slot.innerHTML = html;
  else document.body.insertAdjacentHTML("beforeend", html);
}

function bindProductPageChrome() {
  const Z = window.ZWILLON;
  if (!Z) return;
  Z.bindMobileMenu(document.getElementById("menuBtn"), document.getElementById("mobilePanel"));
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

async function init() {
  console.log("PAGE LOADED");
  console.log("LOCATION:", window.location.href);

  bindProductPageChrome();

  const data = await loadData();
  const Z = window.ZWILLON;
  const rawArr = Array.isArray(data) ? data : [];
  const normalized = Z && Z.normalizeProductsFromJson ? Z.normalizeProductsFromJson(rawArr) : rawArr;
  if (Z && Z.setProductSlugCacheFromNormalized) {
    Z.setProductSlugCacheFromNormalized(normalized);
  }

  const q = new URLSearchParams(window.location.search);
  let id = String(q.get("id") || "").trim();
  if (!id && window.location.hash.length > 1) {
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    id = String(hp.get("id") || "").trim();
  }
  if (!id) {
    const slug = readProductSlugFromPath();
    if (slug && Z && Z.getProductIdFromSlug) {
      id = Z.getProductIdFromSlug(slug) || "";
    }
  }
  if (!id) {
    try {
      id = String(sessionStorage.getItem("zwillon_pending_product_id") || "").trim();
      if (id) sessionStorage.removeItem("zwillon_pending_product_id");
    } catch (_) {
      /* ignore */
    }
  }

  console.log("PRODUCT ID:", id || "(пусто)");

  if (!id) {
    showProductError(
      "ID НЕ ПЕРЕДАН",
      'Откройте карточку из <a href="catalog.html" class="text-accent underline hover:text-white">каталога</a> или перейдите по ссылке вида <code class="text-accent">/product/название.html</code>.'
    );
    return;
  }

  console.log("DATA LENGTH:", rawArr.length);

  const product =
    normalized.find((p) => String(p.id) === String(id)) ||
    rawArr.find((p) => String(p.id) === String(id));

  console.log("FOUND PRODUCT:", product);

  if (!product) {
    showProductError("Товар не найден", `Нет позиции с id <code class="text-accent">${esc(id)}</code> в data.local.json.`);
    return;
  }

  window.currentProduct = product;
  renderProduct(product);
  ensureSwipe();
  enableZoom();
}

window.onload = init;
