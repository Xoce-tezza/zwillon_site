"use strict";

const fs = require("fs");

const files = fs
  .readdirSync(".")
  .filter((f) => f.endsWith(".html") && f !== "__head_catalog.html");

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/openLeadModal\('.*?'\)/g, "openLeadModal('Запрос прайса')");
  s = s.replace(/aria-label="[^"]*"/g, 'aria-label="Открыть меню"');
  s = s.replace(/<!--[^>]*?-->/g, (m) =>
    /Р |РЎ|вЂ|�/.test(m) ? "<!-- Контент -->" : m
  );
  fs.writeFileSync(file, s, "utf8");
}

console.log("normalized attrs/comments:", files.length);
