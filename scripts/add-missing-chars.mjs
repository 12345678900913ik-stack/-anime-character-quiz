// 取得できなかった主要キャラクターを補完追加するスクリプト
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTERS_PATH = path.join(__dirname, '../server/data/characters.json');
const IMAGES_DIR = path.join(__dirname, '../client/public/images');
const JIKAN_BASE = 'https://api.jikan.moe/v4';
const DELAY_MS = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AnimeQuizGame/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) { reject(new Error('RATE_LIMIT')); return; }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetchJson(url); }
    catch (e) {
      if (e.message === 'RATE_LIMIT') { console.log('  レート制限 - 12秒待機...'); await sleep(12000); }
      else if (i < retries - 1) { await sleep(2000); }
      else throw e;
    }
  }
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol.get(url, { headers: { 'User-Agent': 'AnimeQuizGame/1.0' } }, (res) => {
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
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { try { fs.unlink(destPath, () => {}); } catch(_) {} reject(err); });
  });
}

function formatEnglishName(name) {
  if (!name) return name;
  const m = name.match(/^([^,]+),\s*(.+)$/);
  if (m) return `${m[2].trim()} ${m[1].trim()}`;
  return name;
}

// 追加したいキャラのターゲットリスト
// { animeTitle, endpoint, malId, searchName, nameJa }
const targets = [
  // 逃げ上手の若君 - 北条時行（主人公）
  { animeTitle: '逃げ上手の若君', endpoint: 'anime', malId: 54724, searchName: 'tokiyuki', nameJa: '北条 時行' },
  // ウマ娘 S2 - 東海帝王
  { animeTitle: 'ウマ娘 プリティーダービー Season 2', endpoint: 'anime', malId: 42941, searchName: 'tokai', nameJa: '東海帝王' },
  // ドラえもん - ジャイアン（剛田武）
  { animeTitle: 'ドラえもん (2005)', endpoint: 'anime', malId: 8687, searchName: 'goda', nameJa: '剛田 武（ジャイアン）' },
  // 名探偵コナン - 降谷零/安室透
  { animeTitle: '名探偵コナン', endpoint: 'anime', malId: 235, searchName: 'furuya', nameJa: '降谷 零' },
  // Fate/Zero - イスカンダル (Iskandar/Rider)
  { animeTitle: 'Fate/Zero', endpoint: 'manga', malId: 3649, searchName: 'iskandar', nameJa: 'イスカンダル' },
  // Fate/Zero - アルトリア・ペンドラゴン (Saber)
  { animeTitle: 'Fate/Zero', endpoint: 'manga', malId: 3649, searchName: 'artoria', nameJa: 'アルトリア・ペンドラゴン' },
  // シン・エヴァ - マリ
  { animeTitle: 'シン・エヴァンゲリオン劇場版𝄇', endpoint: 'anime', malId: 3786, searchName: 'mari', nameJa: 'マリ・イラストリアス・マキナミ' },
  // ガンダムSEED - アスラン
  { animeTitle: '機動戦士ガンダムSEED', endpoint: 'anime', malId: 93, searchName: 'athrun', nameJa: 'アスラン・ザラ' },
  // ガンダムSEED - カガリ
  { animeTitle: '機動戦士ガンダムSEED', endpoint: 'anime', malId: 93, searchName: 'cagalli', nameJa: 'カガリ・ユラ・アスハ' },
  // ガンダムW - カトル
  { animeTitle: '新機動戦記ガンダムW', endpoint: 'anime', malId: 90, searchName: 'quatre', nameJa: 'カトル・ラバーバ・ウィナー' },
  // ガンダムW - ウーフェイ
  { animeTitle: '新機動戦記ガンダムW', endpoint: 'anime', malId: 90, searchName: 'wufei', nameJa: 'チャン・ウーフェイ' },
  // ガンダムW - トレーズ
  { animeTitle: '新機動戦記ガンダムW', endpoint: 'anime', malId: 90, searchName: 'treize', nameJa: 'トレーズ・クシュリナーダ' },
  // ガンダム00 - セツナ
  { animeTitle: '機動戦士ガンダム00', endpoint: 'anime', malId: 2581, searchName: 'setsuna', nameJa: 'セツナ・F・セイエイ' },
];

async function main() {
  const characters = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf-8'));
  const processedCharIds = new Set(
    characters.filter(c => c.malCharId).map(c => String(c.malCharId))
  );
  let counter = characters.length;

  // 各ターゲットアニメのキャラ一覧をキャッシュ
  const charListCache = {};

  for (const target of targets) {
    const cacheKey = `${target.endpoint}/${target.malId}`;
    if (!charListCache[cacheKey]) {
      await sleep(DELAY_MS);
      try {
        const data = await fetchWithRetry(`${JIKAN_BASE}/${target.endpoint}/${target.malId}/characters`);
        charListCache[cacheKey] = data.data || [];
      } catch (e) {
        console.log(`[SKIP] キャラ一覧取得失敗 ${cacheKey}: ${e.message}`);
        charListCache[cacheKey] = [];
        continue;
      }
    }

    const charList = charListCache[cacheKey];
    const norm = s => s.toLowerCase().replace(/[\s,.\-']/g, '');
    const searchNorm = norm(target.searchName);

    const found = charList.find(c => {
      const jName = norm(c.character?.name || '');
      return jName.includes(searchNorm) || searchNorm.includes(jName.replace(norm(''), ''));
    });

    if (!found) {
      console.log(`[NOT FOUND] ${target.nameJa} in ${target.animeTitle}`);
      continue;
    }

    const charMalId = found.character?.mal_id;
    if (charMalId && processedCharIds.has(String(charMalId))) {
      console.log(`[SKIP] ${target.nameJa} (already processed, malId=${charMalId})`);
      continue;
    }

    // 詳細情報を取得
    let nameJa = target.nameJa;
    let imageUrl = found.character?.images?.jpg?.image_url || found.character?.images?.webp?.image_url || null;

    if (charMalId) {
      try {
        await sleep(DELAY_MS);
        const detail = await fetchWithRetry(`${JIKAN_BASE}/characters/${charMalId}`);
        if (detail.data?.name_kanji) nameJa = detail.data.name_kanji;
        const detailImg = detail.data?.images?.jpg?.image_url || detail.data?.images?.webp?.image_url;
        if (detailImg) imageUrl = detailImg;
      } catch (e) {
        console.log(`  [WARN] 詳細取得失敗: ${e.message}`);
      }
    }

    if (!imageUrl) {
      console.log(`[NO IMG] ${nameJa} (${target.animeTitle})`);
      continue;
    }

    counter++;
    const id = `char_${String(counter).padStart(5, '0')}`;
    const destPath = path.join(IMAGES_DIR, `${id}.jpg`);

    process.stdout.write(`  [${id}] ${nameJa} (${target.animeTitle}) ... `);
    try {
      await downloadImage(imageUrl, destPath);
      const size = fs.statSync(destPath).size;
      if (size < 500) throw new Error('image too small');
      process.stdout.write(`OK (${Math.round(size / 1024)}KB)\n`);

      characters.push({
        id,
        name: nameJa,
        nameEn: formatEnglishName(found.character?.name || ''),
        anime: target.animeTitle,
        imageUrl: `/images/${id}.jpg`,
        difficulty: found.role === 'Main' ? 1 : 2,
        tags: ['アニメ'],
        memo: '',
        malCharId: charMalId || null,
      });

      if (charMalId) processedCharIds.add(String(charMalId));
    } catch (e) {
      process.stdout.write(`DL ERROR: ${e.message}\n`);
      counter--;
    }
  }

  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8');
  console.log(`\n完了: ${characters.length} キャラ保存`);
}

main().catch(console.error);
