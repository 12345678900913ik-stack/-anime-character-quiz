/**
 * 既存の characters.json と excel_data.json を照合して
 * processed_titles.json を生成するユーティリティ
 *
 * 実行: node scripts/build-processed-titles.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_PATH   = path.join(__dirname, "../server/data/characters.json");
const EXCEL_PATH   = path.join(__dirname, "excel_data.json");
const OUTPUT_PATH  = path.join(__dirname, "processed_titles.json");

const characters = JSON.parse(fs.readFileSync(CHARS_PATH, "utf-8"));
const excelData  = JSON.parse(fs.readFileSync(EXCEL_PATH,  "utf-8"));

// processedCharIds: 既存の malCharId セット
const processedCharIds = new Set(
  characters.filter(c => c.malCharId).map(c => String(c.malCharId))
);

const norm = s => s.toLowerCase().replace(/[\s,.\-']/g, "");
// "Last, First" → "First Last" に変換
const fmtEN = s => { const m = s.match(/^([^,]+),\s*(.+)$/); return m ? `${m[2].trim()} ${m[1].trim()}` : s; };

let doneCount = 0;
const doneMalIds = [];

for (const title of excelData) {
  const excelNames = title.characters || [];
  if (excelNames.length === 0) { doneMalIds.push(title.mal_id); continue; }

  // Excel のキャラが characters.json 内に名前で存在するか確認
  const allFound = excelNames.every(en => {
    const e1 = norm(en);           // "ackermanmikasa"
    const e2 = norm(fmtEN(en));    // "mikasakerman"
    return characters.some(c => {
      if (c.anime !== title.title) return false;
      const cName = norm(c.nameEn || "");
      return cName === e1 || cName === e2 ||
             cName.includes(e1) || cName.includes(e2) ||
             e1.includes(cName) || e2.includes(cName);
    });
  });

  if (allFound) {
    doneMalIds.push(title.mal_id);
    doneCount++;
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(doneMalIds), "utf-8");
console.log(`処理済みタイトル: ${doneCount} / ${excelData.length} 作品`);
console.log(`→ ${OUTPUT_PATH} に保存しました`);
