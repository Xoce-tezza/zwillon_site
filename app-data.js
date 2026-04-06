// Каталог ZWILLON для клиентской части (без backend).
// Структура по ТЗ: id, name_ru, category, image, description_ru

function svgToDataUrl(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function makeProductImage({ title, accent = "#FFC107", bg = "#0B0B0B", tone = "rgba(255,193,7,.18)" }) {
  const safeTitle = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <radialGradient id="r" cx="0" cy="0" r="1" gradientTransform="translate(850 260) rotate(90) scale(420 320)">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.35"/>
        <stop offset="0.55" stop-color="${accent}" stop-opacity="0.12"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="m" x1="200" y1="120" x2="980" y2="720" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFFFFF" stop-opacity="0.18"/>
        <stop offset="0.45" stop-color="${accent}" stop-opacity="0.14"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.08"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="${bg}"/>
    <ellipse cx="840" cy="270" rx="470" ry="320" fill="url(#r)"/>
    <g opacity="0.95">
      <rect x="170" y="150" width="860" height="500" rx="48" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)" stroke-width="3"/>
      <path d="M320 420c80-150 220-220 360-160 90 40 150 140 160 250" fill="none" stroke="url(#m)" stroke-width="14" stroke-linecap="round"/>
      <path d="M330 520h540" stroke="rgba(255,255,255,.16)" stroke-width="10" stroke-linecap="round"/>
      <circle cx="420" cy="320" r="26" fill="${tone}" />
      <circle cx="790" cy="520" r="20" fill="${tone}" />
    </g>
    <text x="210" y="260" font-family="Inter, Manrope, Arial" font-size="38" font-weight="700" fill="rgba(255,255,255,.92)">${safeTitle}</text>
    <text x="210" y="315" font-family="Inter, Manrope, Arial" font-size="22" font-weight="600" fill="rgba(255,193,7,.72)">ZWILLON</text>
  </svg>
  `;
  return svgToDataUrl(svg);
}

const CATEGORIES = [
  { key: "posuda", label: "Посуда" },
  { key: "chainiki", label: "Чайники" },
  { key: "tehnika", label: "Кухонная техника" },
  { key: "accessories", label: "Аксессуары" }
];

const PRODUCTS = [
  {
    id: "posuda-01",
    name_ru: "Набор кухонной посуды для HoReCa",
    category: "posuda",
    image: makeProductImage({ title: "Посуда", accent: "#FFC107" }),
    description_ru: "Комплект под кухню и зал: аккуратная геометрия, удобная сервировка и готовность к регулярным поставкам."
  },
  {
    id: "posuda-02",
    name_ru: "Премиальная посуда для сервиса",
    category: "posuda",
    image: makeProductImage({ title: "Сервис", accent: "#FFD000" }),
    description_ru: "Позиции, которые держат внешний вид витрины и стабильно проходят повторные заказы."
  },
  {
    id: "chainiki-01",
    name_ru: "Чайник для плиты — стабильная партия",
    category: "chainiki",
    image: makeProductImage({ title: "Чайники", accent: "#FFC107" }),
    description_ru: "Чайники для розничной выдачи и ресторанного оборота: подбор под спрос и предсказуемые сроки."
  },
  {
    id: "chainiki-02",
    name_ru: "Чайник с акцентной фактурой",
    category: "chainiki",
    image: makeProductImage({ title: "Фактура", accent: "#FFD000" }),
    description_ru: "Визуально сильная позиция: помогает продавать быстрее и снижает количество возвратов."
  },
  {
    id: "tehnika-01",
    name_ru: "Кухонная техника под ежедневный ритм",
    category: "tehnika",
    image: makeProductImage({ title: "Техника", accent: "#FFC107" }),
    description_ru: "Модели, которые поддерживают темп кухни и сервиса. Подбираем партии под ваш поток заказов."
  },
  {
    id: "tehnika-02",
    name_ru: "Партия техники для кафе и кейтеринга",
    category: "tehnika",
    image: makeProductImage({ title: "Кафе", accent: "#FFD000" }),
    description_ru: "Комплектация под сценарии HoReCa: аккуратная логистика и понятные условия поставки."
  },
  {
    id: "accessories-01",
    name_ru: "Аксессуары для роста среднего чека",
    category: "accessories",
    image: makeProductImage({ title: "Аксессуары", accent: "#FFC107" }),
    description_ru: "Товары, которые дополняют основной спрос: удобные комплекты и стабильная доступность."
  },
  {
    id: "accessories-02",
    name_ru: "Комплектующие для сервиса и витрины",
    category: "accessories",
    image: makeProductImage({ title: "Комплект", accent: "#FFD000" }),
    description_ru: "Детали, которые повышают ценность предложения и помогают удерживать регулярные закупки."
  }
];

window.ZWILLON_CATEGORIES = CATEGORIES;
window.ZWILLON_PRODUCTS = PRODUCTS;

