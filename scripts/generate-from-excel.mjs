/**
 * Excel データ → characters.json + 画像ダウンロード
 *
 * 処理フロー:
 *  1. scripts/excel_data.json を読み込む（事前に excel-to-json.py で生成）
 *  2. 各作品について Jikan API /anime(manga)/{id}/characters でキャラ一覧取得
 *  3. 上位キャラ（Main優先）を選択し /characters/{id} で日本語名を取得
 *  4. 画像をダウンロード
 *  5. server/data/characters.json を上書き保存
 *
 * 実行: node scripts/generate-from-excel.mjs [--limit N] [--anime-only] [--resume]
 *   --limit N      : 処理する作品数の上限（デフォルト: 全件）
 *   --anime-only   : アニメ作品のみ処理（漫画をスキップ）
 *   --resume       : 既存の characters.json を引き継いで追記モードで実行
 *   --max-per-title N : 1作品あたりの最大キャラ数（デフォルト: 3）
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_JSON = path.join(__dirname, "excel_data.json");
const CHARACTERS_PATH = path.join(__dirname, "../server/data/characters.json");
const IMAGES_DIR = path.join(__dirname, "../client/public/images");
const JIKAN_BASE = "https://api.jikan.moe/v4";
const FAILED_LOG = path.join(__dirname, "failed_characters.txt");
const PROGRESS_FILE = path.join(__dirname, "progress.json");
const PROCESSED_TITLES_FILE = path.join(__dirname, "processed_titles.json");

// Jikan API レート制限: 3req/sec, 60req/min
const DELAY_MS = 350;
const RETRY_WAIT_MS = 12000;

// CLI オプション
const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1]) : Infinity; })();
const ANIME_ONLY = args.includes("--anime-only");
const RESUME = args.includes("--resume");
const MAX_PER_TITLE = (() => { const i = args.indexOf("--max-per-title"); return i >= 0 ? parseInt(args[i + 1]) : 3; })();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "AnimeQuizGame/1.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 429) {
            reject(new Error("RATE_LIMIT"));
            return;
          }
          if (res.statusCode === 404) {
            reject(new Error("NOT_FOUND"));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP_${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("PARSE_ERROR"));
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url);
    } catch (e) {
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

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol
      .get(url, { headers: { "User-Agent": "AnimeQuizGame/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(destPath, () => {});
          downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        try { fs.unlink(destPath, () => {}); } catch (_) {}
        reject(err);
      });
  });
}

/** "Last, First" → "First Last" に変換（日本語名がない場合のフォールバック） */
function formatEnglishName(name) {
  if (!name) return name;
  const m = name.match(/^([^,]+),\s*(.+)$/);
  if (m) return `${m[2].trim()} ${m[1].trim()}`;
  return name;
}

/** 年代タグ生成 */
function yearTag(year) {
  if (!year) return "不明";
  const decade = Math.floor(year / 10) * 10;
  return `${decade}年代`;
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const excelData = JSON.parse(fs.readFileSync(EXCEL_JSON, "utf-8"));

  // 既存キャラを読み込む（resumeモード or 既存IDの重複排除用）
  let existingChars = [];
  if (RESUME && fs.existsSync(CHARACTERS_PATH)) {
    existingChars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
    console.log(`[RESUME] 既存キャラ数: ${existingChars.length}`);
  }

  // 処理済みの (mal_id + character_mal_id) セットを作成（重複スキップ用）
  const processedCharIds = new Set(
    existingChars
      .filter((c) => c.malCharId)
      .map((c) => String(c.malCharId))
  );

  const characters = [...existingChars];
  let counter = existingChars.length;
  const failedList = [];
  const runStartTime = Date.now();

  const writeProgress = (workIndex, totalWorks, currentTitle = "", lastChar = "", finished = false) => {
    try {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        workIndex,
        totalWorks,
        charCount: characters.length,
        currentTitle,
        lastChar,
        startTime: runStartTime,
        updatedAt: Date.now(),
        finished,
        failedCount: failedList.length,
      }), "utf-8");
    } catch (_) {}
  };

  // 処理済みタイトルを読み込む（resumeモードで高速スキップ用）
  const processedTitles = new Set(
    RESUME && fs.existsSync(PROCESSED_TITLES_FILE)
      ? JSON.parse(fs.readFileSync(PROCESSED_TITLES_FILE, "utf-8"))
      : []
  );

  const saveProcessedTitles = () => {
    try {
      fs.writeFileSync(PROCESSED_TITLES_FILE, JSON.stringify([...processedTitles]), "utf-8");
    } catch (_) {}
  };

  // 処理対象を絞り込む
  let targets = excelData;
  if (ANIME_ONLY) targets = targets.filter((t) => t.endpoint === "anime");
  if (LIMIT < Infinity) targets = targets.slice(0, LIMIT);

  const skippedTitles = targets.filter(t => processedTitles.has(t.mal_id)).length;
  console.log(`処理対象: ${targets.length} 作品 / うち処理済みスキップ: ${skippedTitles} 作品`);
  console.log(`Excelキャラ全員対象 (フォールバック最大${MAX_PER_TITLE}件)`);
  console.log("─".repeat(60));

  for (let ti = 0; ti < targets.length; ti++) {
    const title = targets[ti];
    // 処理済みタイトルはAPIコールなしでスキップ
    if (processedTitles.has(title.mal_id)) {
      process.stdout.write(`[${ti + 1}/${targets.length}] SKIP(done) ${title.title}\n`);
      continue;
    }

    writeProgress(ti + 1, targets.length, title.title, "");
    console.log(`\n[${ti + 1}/${targets.length}] ${title.title} (${title.endpoint}/${title.mal_id})`);

    // 1. キャラ一覧を取得
    let charList;
    try {
      await sleep(DELAY_MS);
      const url = `${JIKAN_BASE}/${title.endpoint}/${title.mal_id}/characters`;
      const data = await fetchWithRetry(url);
      charList = data.data || [];
    } catch (e) {
      console.log(`  [SKIP] キャラ一覧取得失敗: ${e.message}`);
      failedList.push(`[LIST] ${title.title}: ${e.message}`);
      continue;
    }

    // 2. Excel のキャラ名と Jikan の結果をマッチングして選択
    const excelNames = title.characters || [];
    const norm = (s) => s.toLowerCase().replace(/[\s,.\-']/g, "");

    let selected;
    if (excelNames.length > 0) {
      // Excel 記載のキャラを名前でマッチング（前方一致・部分一致）
      const matched = charList.filter((c) => {
        const jName = norm(c.character?.name || "");
        return excelNames.some((en) => {
          const eName = norm(en);
          return jName === eName || jName.includes(eName) || eName.includes(jName);
        });
      });
      // マッチしたものを Excel の順番に並べ直す
      selected = excelNames
        .map((en) => matched.find((c) => {
          const jName = norm(c.character?.name || "");
          const eName = norm(en);
          return jName === eName || jName.includes(eName) || eName.includes(jName);
        }))
        .filter(Boolean);
      // マッチゼロの場合は Main/Supporting 上位にフォールバック
      if (selected.length === 0) {
        selected = [
          ...charList.filter((c) => c.role === "Main"),
          ...charList.filter((c) => c.role === "Supporting"),
        ].slice(0, MAX_PER_TITLE);
      }
    } else {
      selected = [
        ...charList.filter((c) => c.role === "Main"),
        ...charList.filter((c) => c.role === "Supporting"),
      ].slice(0, MAX_PER_TITLE);
    }

    if (selected.length === 0) {
      console.log("  [SKIP] キャラが見つからない");
      continue;
    }

    // 3. 候補リストを収集（詳細APIスキップ・英語名をそのまま使用）
    const DOWNLOAD_CONCURRENCY = 3;
    const candidates = [];
    for (const entry of selected) {
      const charMalId = entry.character?.mal_id;
      const charNameEn = entry.character?.name || "";
      const role = entry.role || "Supporting";

      if (charMalId && processedCharIds.has(String(charMalId))) {
        console.log(`  [SKIP] ${charNameEn} (already processed)`);
        continue;
      }

      const imageUrl = entry.character?.images?.jpg?.image_url
        || entry.character?.images?.webp?.image_url
        || null;

      if (!imageUrl) {
        failedList.push(`[NOIMG] ${formatEnglishName(charNameEn)} (${title.title})`);
        continue;
      }

      candidates.push({ charMalId, charNameEn, imageUrl, role });
    }

    // 4. 画像を並列ダウンロード（DOWNLOAD_CONCURRENCY 枚同時）
    const downloaded = [];
    for (let ci = 0; ci < candidates.length; ci += DOWNLOAD_CONCURRENCY) {
      const batch = candidates.slice(ci, ci + DOWNLOAD_CONCURRENCY);
      const batchWithIds = batch.map((c) => {
        counter++;
        return {
          ...c,
          id: `char_${String(counter).padStart(5, "0")}`,
          displayName: formatEnglishName(c.charNameEn),
        };
      });

      const results = await Promise.allSettled(
        batchWithIds.map(async (c) => {
          const destPath = path.join(IMAGES_DIR, `${c.id}.jpg`);
          if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
            process.stdout.write(`  [${c.id}] ${c.displayName} ... SKIP(exists)\n`);
            return c;
          }
          process.stdout.write(`  [${c.id}] ${c.displayName} ... `);
          await downloadImage(c.imageUrl, destPath);
          const size = fs.statSync(destPath).size;
          if (size < 500) throw new Error("image too small");
          process.stdout.write(`OK (${Math.round(size / 1024)}KB)\n`);
          return c;
        })
      );

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          downloaded.push(batchWithIds[j]);
        } else {
          const c = batchWithIds[j];
          process.stdout.write(`  [${c.id}] ${c.displayName} ... DL ERROR: ${results[j].reason?.message}\n`);
          failedList.push(`[IMG] ${c.id} ${c.displayName}: ${results[j].reason?.message}`);
        }
      }
    }

    for (const c of downloaded) {
      characters.push({
        id: c.id,
        name: c.displayName,
        nameEn: c.displayName,
        anime: title.title,
        imageUrl: `/images/${c.id}.jpg`,
        difficulty: c.role === "Main" ? 1 : 2,
        tags: [title.type, yearTag(title.start_year)],
        memo: "",
        malCharId: c.charMalId || null,
      });
      if (c.charMalId) processedCharIds.add(String(c.charMalId));
    }

    if (downloaded.length > 0) {
      writeProgress(ti + 1, targets.length, title.title, downloaded[downloaded.length - 1].displayName);
    }

    // 定期保存（50件ごと）
    if (characters.length % 50 === 0) {
      fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), "utf-8");
      console.log(`  [SAVE] ${characters.length} 件保存`);
    }

    // タイトル処理完了を記録（次回resumeでスキップ）
    processedTitles.add(title.mal_id);
    if ((ti + 1) % 20 === 0) saveProcessedTitles();
  }

  // 最終保存
  saveProcessedTitles();
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), "utf-8");

  // 失敗ログ
  if (failedList.length > 0) {
    fs.writeFileSync(FAILED_LOG, failedList.join("\n"), "utf-8");
  }

  writeProgress(targets.length, targets.length, "", "", true);
  console.log("\n" + "═".repeat(60));
  console.log(`完了: ${characters.length} キャラ保存 / 失敗: ${failedList.length}`);
  if (failedList.length > 0) console.log(`失敗リスト → ${FAILED_LOG}`);
}

main().catch(console.error);
