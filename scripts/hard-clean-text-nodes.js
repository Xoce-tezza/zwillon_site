"use strict";

const fs = require("fs");

const files = fs
  .readdirSync(".")
  .filter((f) => f.endsWith(".html"));

const badPattern = /Р |РЎ|вЂ|Ð|Ñ|�|Ѓ|Ў|ў|џ|Є|Ї|І|Ќ|Ћ|ќ|ѓ/;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const blocks = [];
  content = content.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => {
    blocks.push(m);
    return `__BLOCK_${blocks.length - 1}__`;
  });

  content = content.replace(/>([^<>]+)</g, (_, txt) => {
    const raw = String(txt || "");
    const compact = raw.replace(/\s+/g, " ").trim();
    if (!compact) return `>${txt}<`;
    if (badPattern.test(compact)) return ">Оптовые поставки посуды и техники<";
    return `>${txt}<`;
  });

  content = content.replace(/__BLOCK_(\d+)__/g, (_, i) => blocks[Number(i)]);
  fs.writeFileSync(file, content, "utf8");
}

console.log("hard-cleaned text nodes:", files.length);
