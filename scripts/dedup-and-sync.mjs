/**
 * 重複排除 + server → client 同期スクリプト
 * 実行: node scripts/dedup-and-sync.mjs
 *
 * 重複判定:
 *   1. malCharId が同じ → 先出優先で後を削除
 *   2. malCharId が null → (name + anime) が同じ → 先出優先で後を削除
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "../server/data/characters.json");
const CLIENT_PATH = path.join(__dirname, "../client/src/data/characters.json");

const chars = JSON.parse(fs.readFileSync(SERVER_PATH, "utf-8"));
console.log(`読み込み: ${chars.length} キャラ`);

const seen = new Set();
const dedupedByMal = [];
let malDupCount = 0;

for (const c of chars) {
  if (c.malCharId) {
    const key = String(c.malCharId);
    if (seen.has(key)) {
      console.log(`  [DUP-MAL] ${c.name} (${c.anime}) malCharId=${c.malCharId}`);
      malDupCount++;
    } else {
      seen.add(key);
      dedupedByMal.push(c);
    }
  } else {
    dedupedByMal.push(c);
  }
}

const seenNameAnime = new Set();
const deduped = [];
let nameDupCount = 0;

for (const c of dedupedByMal) {
  if (!c.malCharId) {
    const key = `${c.name}||${c.anime}`;
    if (seenNameAnime.has(key)) {
      console.log(`  [DUP-NAME] ${c.name} (${c.anime})`);
      nameDupCount++;
    } else {
      seenNameAnime.add(key);
      deduped.push(c);
    }
  } else {
    deduped.push(c);
  }
}

console.log(`\n重複排除結果:`);
console.log(`  malCharId重複: ${malDupCount} 件削除`);
console.log(`  name+anime重複: ${nameDupCount} 件削除`);
console.log(`  最終キャラ数: ${deduped.length}`);

// server に保存
fs.writeFileSync(SERVER_PATH, JSON.stringify(deduped, null, 2), "utf-8");
console.log(`\n✅ server/data/characters.json 保存完了`);

// client に同期
fs.writeFileSync(CLIENT_PATH, JSON.stringify(deduped, null, 2), "utf-8");
console.log(`✅ client/src/data/characters.json 同期完了`);
