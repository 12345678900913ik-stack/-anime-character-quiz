// 失敗したキャラを英語名で再検索
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTERS_PATH = path.join(__dirname, "../server/data/characters.json");
const IMAGES_DIR = path.join(__dirname, "../client/public/images");
const JIKAN_BASE = "https://api.jikan.moe/v4";
const DELAY_MS = 500;

// 失敗したキャラの英語名マッピング
const RETRY_MAP = {
  char_009: "Levi Ackerman",
  char_015: "Kirito",
  char_023: "Conan Edogawa",
  char_054: "Gon Freecss",
  char_055: "Killua Zoldyck",
  char_058: "Leorio Paradinight",
  char_064: "Izuku Midoriya",
  char_069: "Shouta Aizawa",
  char_079: "Lelouch Lamperouge",
  char_080: "C.C.",
  char_082: "Usagi Tsukino",
  char_083: "Rei Hino",
  char_084: "Ami Mizuno",
  char_085: "Makoto Kino",
  char_086: "Minako Aino",
  char_090: "Artoria Pendragon",
  char_092: "Emiya",
  char_111: "Touka Kirishima",
  char_127: "Aqua Hoshino",
  char_164: "L Lawliet",
  char_165: "Kanade Tachibana",
  char_169: "Manjiro Sano",
  char_171: "Nobara Kugisaki",
  char_174: "Sora",
  char_176: "Ainz Ooal Gown",
  char_179: "Kazuma Satou",
  char_181: "Chihiro Ogino",
  char_191: "Shinnosuke Nohara",
  char_196: "Suguha Kirigaya",
};

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
          if (res.statusCode === 429) { reject(new Error("RATE_LIMIT")); return; }
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      })
      .on("error", reject);
  });
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { "User-Agent": "AnimeQuizGame/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}`)); return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

async function main() {
  const characters = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
  const ids = Object.keys(RETRY_MAP);
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    const idx = characters.findIndex((c) => c.id === id);
    if (idx === -1) continue;
    const char = characters[idx];
    const query = RETRY_MAP[id];
    const filename = `${id}.jpg`;
    const destPath = path.join(IMAGES_DIR, filename);

    process.stdout.write(`[${id}] ${char.name} → "${query}" ... `);

    let retries = 3;
    let imageUrl = null;

    while (retries > 0) {
      try {
        const q = encodeURIComponent(query);
        const data = await fetchJson(`${JIKAN_BASE}/characters?q=${q}&limit=5`);
        if (data.data && data.data.length > 0) {
          imageUrl =
            data.data[0]?.images?.jpg?.image_url ||
            data.data[0]?.images?.webp?.image_url ||
            null;
        }
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
      await sleep(DELAY_MS);
      continue;
    }

    try {
      await downloadImage(imageUrl, destPath);
      const stat = fs.statSync(destPath);
      if (stat.size < 500) throw new Error("too small");
      characters[idx].imageUrl = `/images/${filename}`;
      console.log(`OK (${Math.round(stat.size / 1024)}KB)`);
      success++;
    } catch (e) {
      console.log(`DL ERROR: ${e.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), "utf-8");

  console.log(`\n===== 再試行完了 =====`);
  console.log(`成功: ${success} / ${ids.length}`);
  console.log(`失敗: ${failed}`);
}

main().catch(console.error);
