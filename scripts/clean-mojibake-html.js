"use strict";

const fs = require("fs");

const files = [
  "index.html",
  "catalog.html",
  "category.html",
  "product.html",
  "zwillon-optom.html",
  "fissman-optom.html",
  "posuda-optom-almaty.html",
  "posuda-dlya-kafe.html",
  "kastruli-optom.html",
  "skovorody-optom.html",
];

const mojibakePattern = /Р.|С.|вЂ|Ð|Ñ|�/;

function cleanTextNode(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return text;
  if (!mojibakePattern.test(trimmed)) return text;
  return "Оптовые поставки посуды и техники";
}

const titles = {
  "index.html": "Zwillon оптом в Алматы — прайс за 1 минуту | Поставщик посуды",
  "catalog.html": "Каталог посуды оптом Алматы — цены для ресторанов",
  "category.html": "Категория товаров — ZWILLON",
  "product.html": "Карточка товара — ZWILLON",
  "zwillon-optom.html": "Zwillon оптом в Алматы — поставщик посуды",
  "fissman-optom.html": "Fissman оптом Алматы — поставщик посуды",
  "posuda-optom-almaty.html": "Посуда оптом Алматы — поставщик для HoReCa",
  "posuda-dlya-kafe.html": "Посуда для кафе и ресторанов — оптом",
  "kastruli-optom.html": "Кастрюли оптом Алматы — для кафе и ресторанов",
  "skovorody-optom.html": "Сковороды оптом Алматы — поставщик для HoReCa",
};

const description =
  "Оптовые поставки посуды и техники для кафе, ресторанов и бизнеса. Прайс за 1 минуту в WhatsApp.";

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");

  const protectedBlocks = [];
  content = content.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (match) => {
    protectedBlocks.push(match);
    return `__BLOCK_${protectedBlocks.length - 1}__`;
  });

  content = content.replace(/>([^<>]+)</g, (_, text) => `>${cleanTextNode(text)}<`);

  content = content.replace(/alt="[^"]*"/g, (m) =>
    mojibakePattern.test(m) ? 'alt="Посуда оптом"' : m
  );
  content = content.replace(/placeholder="[^"]*"/g, (m) =>
    mojibakePattern.test(m) ? 'placeholder="Введите данные"' : m
  );

  content = content.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titles[file]}</title>`);
  if (/<meta name="description"/i.test(content)) {
    content = content.replace(
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${description}" />`
    );
  }

  content = content.replace(/__BLOCK_(\d+)__/g, (_, i) => protectedBlocks[Number(i)]);

  fs.writeFileSync(file, content, "utf8");
}

console.log("cleaned html files:", files.length);
