"use strict";
const fs = require("fs");

const files = fs.readdirSync(".").filter((f) => f.endsWith(".html"));
const keywords =
  "посуда оптом, посуда для кафе и ресторанов, кастрюли оптом, сковороды оптом, прайс за 1 минуту, поставщик посуды Алматы";

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  if (/<meta name="keywords"/i.test(s)) {
    s = s.replace(
      /<meta name="keywords"[^>]*>/i,
      `<meta name="keywords" content="${keywords}" />`
    );
  }
  if (file === "index.html") {
    s = s.replace(
      /<script type="application\/ld\+json">[\s\S]*?"@type": "FAQPage"[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Минимальный заказ",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Минимальный заказ от 10 штук."
          }
        },
        {
          "@type": "Question",
          "name": "Доставка по Казахстану",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Да, доставка по Алматы и всему Казахстану."
          }
        }
      ]
    }
  </script>`
    );
  }
  fs.writeFileSync(file, s, "utf8");
}

console.log("fixed keywords/faq:", files.length);
