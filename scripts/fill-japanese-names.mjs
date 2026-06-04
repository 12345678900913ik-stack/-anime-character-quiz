/**
 * 英語名のままになっているキャラに日本語名を補完するスクリプト
 * 実行: node scripts/fill-japanese-names.mjs
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "../server/data/characters.json");
const CLIENT_PATH = path.join(__dirname, "../client/src/data/characters.json");
const JIKAN_BASE = "https://api.jikan.moe/v4";
const DELAY_MS = 360;
const RETRY_WAIT_MS = 12000;
const CONCURRENCY = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isEnglishName(name) {
  // 日本語文字（ひらがな・カタカナ・漢字）が含まれていなければ英語名と判定
  return !/[぀-ヿ㐀-鿿＀-￯]/.test(name);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "AnimeQuizGame/1.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 429) { reject(new Error("RATE_LIMIT")); return; }
        if (res.statusCode === 404) { reject(new Error("NOT_FOUND")); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP_${res.statusCode}`)); return; }
        try { resolve(JSON.parse(data)); } catch { reject(new Error("PARSE_ERROR")); }
      });
    }).on("error", reject);
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetchJson(url); }
    catch (e) {
      if (e.message === "RATE_LIMIT") {
        console.log(`  [レート制限] ${RETRY_WAIT_MS / 1000}秒待機...`);
        await sleep(RETRY_WAIT_MS);
      } else if (e.message === "NOT_FOUND") {
        throw e;
      } else if (i < retries - 1) {
        await sleep(2000);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const characters = JSON.parse(fs.readFileSync(SERVER_PATH, "utf-8"));
  console.log(`読み込み: ${characters.length} キャラ`);

  const targets = characters
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => c.malCharId && isEnglishName(c.name));

  console.log(`日本語名補完対象: ${targets.length} 件`);
  console.log("─".repeat(50));

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (c, bi) => {
        if (bi > 0) await sleep(bi * DELAY_MS);
        const detail = await fetchWithRetry(`${JIKAN_BASE}/characters/${c.malCharId}`);
        return { c, nameKanji: detail.data?.name_kanji || null };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { c, nameKanji } = result.value;
        if (nameKanji) {
          characters[c._idx].name = nameKanji;
          process.stdout.write(`  [${c._idx}] ${c.name} → ${nameKanji}\n`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        if (result.reason?.message !== "NOT_FOUND") {
          console.log(`  [ERR] ${result.reason?.message}`);
        }
        failed++;
      }
    }

    // バッチ間のレート制限待機
    await sleep(DELAY_MS);

    // 進捗表示（100件ごと）
    const done = Math.min(i + CONCURRENCY, targets.length);
    if (done % 100 === 0 || done === targets.length) {
      console.log(`進捗: ${done}/${targets.length} (更新${updated} スキップ${skipped} 失敗${failed})`);
      // 定期保存
      fs.writeFileSync(SERVER_PATH, JSON.stringify(characters, null, 2), "utf-8");
    }
  }

  // 最終保存
  fs.writeFileSync(SERVER_PATH, JSON.stringify(characters, null, 2), "utf-8");
  fs.writeFileSync(CLIENT_PATH, JSON.stringify(characters, null, 2), "utf-8");

  console.log("\n" + "═".repeat(50));
  console.log(`完了: 更新 ${updated} / スキップ ${skipped} / 失敗 ${failed}`);
  console.log(`✅ server/data/characters.json 保存完了`);
  console.log(`✅ client/src/data/characters.json 同期完了`);
}

main().catch(console.error);
