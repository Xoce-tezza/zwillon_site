/**
 * Ядро buildProductDescription — то же правило, что в zwillon-shared.js (без DOM).
 * Используется seo-slugs.js / server.js для согласованности SEO и контента.
 */
function catalogLabelFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("кастрюля") || n.includes("сковорода")) return "Посуда";
  if (n.includes("чайник")) return "Чайники";
  if (n.includes("доска")) return "Аксессуары";
  if (n.includes("нож") || n.includes("набор")) return "Аксессуары";
  if (n.includes("блендер") || n.includes("миксер")) return "Техника";
  return "Другое";
}

function resolveDescriptionBucket(product) {
  const name = String(product.name_ru || product.name || "").toLowerCase();
  const key = String(product.category || "").toLowerCase();
  const label = catalogLabelFromName(
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
  const name = String(
    product.name_ru || product.name || "Позиция каталога"
  ).trim();
  const bucket = resolveDescriptionBucket(product);
  const label = catalogLabelFromName(name);
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

module.exports = {
  catalogLabelFromName,
  buildProductDescription,
  resolveDescriptionBucket,
};
