// Jikan API (MyAnimeList) からキャラクター画像をダウンロードするスクリプト
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTERS_PATH = path.join(__dirname, "../server/data/characters.json");
const IMAGES_DIR = path.join(__dirname, "../client/public/images");
const JIKAN_BASE = "https://api.jikan.moe/v4";

// Jikan API レート制限: 3req/sec, 60req/min
const DELAY_MS = 400;

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
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
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
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

async function searchCharacter(name, anime) {
  const q = encodeURIComponent(name);
  const url = `${JIKAN_BASE}/characters?q=${q}&limit=8`;
  const data = await fetchJson(url);

  if (!data.data || data.data.length === 0) return null;

  // アニメ名で絞り込み（部分一致）
  const animeKeyword = anime.replace(/[（）\-\s]/g, "").slice(0, 6);
  const matched = data.data.find((c) => {
    if (!c.anime) return false;
    return c.anime.some((a) =>
      a.anime?.title?.includes(animeKeyword) ||
      anime.includes(a.anime?.title?.slice(0, 4) ?? "____")
    );
  });

  const best = matched || data.data[0];
  return best?.images?.jpg?.image_url || best?.images?.webp?.image_url || null;
}

async function main() {
  const characters = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;
  const failedList = [];

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const ext = "jpg";
    const filename = `${char.id}.${ext}`;
    const destPath = path.join(IMAGES_DIR, filename);

    // すでにダウンロード済みならスキップ
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 1000) {
        characters[i].imageUrl = `/images/${filename}`;
        console.log(`[SKIP] ${char.id} ${char.name} (already exists)`);
        success++;
        continue;
      }
    }

    process.stdout.write(
      `[${i + 1}/${characters.length}] ${char.name} (${char.anime}) ... `
    );

    let retries = 3;
    let imageUrl = null;

    while (retries > 0) {
      try {
        imageUrl = await searchCharacter(char.name, char.anime);
        break;
      } catch (e) {
        if (e.message === "RATE_LIMIT") {
          console.log("レート制限 - 10秒待機...");
          await sleep(10000);
          retries--;
        } else {
          break;
        }
      }
    }

    if (!imageUrl) {
      console.log("NOT FOUND");
      failed++;
      failedList.push(`${char.id}: ${char.name} (${char.anime})`);
      await sleep(DELAY_MS);
      continue;
    }

    try {
      await downloadImage(imageUrl, destPath);
      const stat = fs.statSync(destPath);
      if (stat.size < 500) {
        throw new Error("image too small");
      }
      characters[i].imageUrl = `/images/${filename}`;
      console.log(`OK (${Math.round(stat.size / 1024)}KB)`);
      success++;
    } catch (e) {
      console.log(`DL ERROR: ${e.message}`);
      failed++;
      failedList.push(`${char.id}: ${char.name} - ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  // characters.json を更新
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), "utf-8");

  console.log("\n===== 完了 =====");
  console.log(`成功: ${success} / ${characters.length}`);
  console.log(`失敗: ${failed}`);
  if (failedList.length > 0) {
    console.log("\n失敗リスト:");
    failedList.forEach((f) => console.log("  -", f));
  }
}

main().catch(console.error);
