// 誤マッチを削除し、正しいキャラクターを追加するスクリプト
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTERS_PATH = path.join(__dirname, '../server/data/characters.json');
const IMAGES_DIR = path.join(__dirname, '../client/public/images');
const JIKAN_BASE = 'https://api.jikan.moe/v4';
const DELAY_MS = 450;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AnimeQuizGame/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 429) { reject(new Error('RATE_LIMIT')); return; }
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
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
        file.close(); fs.unlink(destPath, () => {});
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject); return;
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}`)); return;
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

async function main() {
  let characters = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf-8'));

  // === 1. 誤追加されたキャラを削除 ===
  const toRemove = ['char_04326']; // 降屋 栄絵 (コナンの誤マッチ)
  for (const id of toRemove) {
    const idx = characters.findIndex(c => c.id === id);
    if (idx >= 0) {
      console.log(`[DELETE] ${characters[idx].name} (${characters[idx].id})`);
      characters.splice(idx, 1);
      // 画像ファイルも削除
      const imgPath = path.join(IMAGES_DIR, `${id}.jpg`);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
  }

  const processedCharIds = new Set(
    characters.filter(c => c.malCharId).map(c => String(c.malCharId))
  );

  // カウンターを現在の最大IDから設定
  const maxId = Math.max(...characters.map(c => parseInt(c.id.replace('char_', ''))));
  let counter = maxId;

  // キャラ一覧キャッシュ
  const charListCache = {};
  async function getCharList(endpoint, malId) {
    const key = `${endpoint}/${malId}`;
    if (!charListCache[key]) {
      await sleep(DELAY_MS);
      try {
        const data = await fetchWithRetry(`${JIKAN_BASE}/${key}/characters`);
        charListCache[key] = data.data || [];
      } catch(e) {
        charListCache[key] = [];
      }
    }
    return charListCache[key];
  }

  async function addChar(animeTitle, endpoint, malId, searchTerms, nameJaFallback, difficulty = 1) {
    const list = await getCharList(endpoint, malId);
    const norm = s => s.toLowerCase().replace(/[\s,.\-']/g, '');

    let found = null;
    for (const term of searchTerms) {
      const t = norm(term);
      found = list.find(c => {
        const n = norm(c.character?.name || '');
        return n === t || n.includes(t) || t.includes(n);
      });
      if (found) break;
    }

    if (!found) { console.log(`[NOT FOUND] ${nameJaFallback} in ${animeTitle}`); return; }

    const charMalId = found.character?.mal_id;
    if (charMalId && processedCharIds.has(String(charMalId))) {
      console.log(`[SKIP] ${nameJaFallback} (already processed)`);
      return;
    }

    let nameJa = nameJaFallback;
    let imageUrl = found.character?.images?.jpg?.image_url || found.character?.images?.webp?.image_url || null;

    if (charMalId) {
      try {
        await sleep(DELAY_MS);
        const detail = await fetchWithRetry(`${JIKAN_BASE}/characters/${charMalId}`);
        if (detail.data?.name_kanji) nameJa = detail.data.name_kanji;
        const img = detail.data?.images?.jpg?.image_url || detail.data?.images?.webp?.image_url;
        if (img) imageUrl = img;
      } catch(e) { /* continue */ }
    }

    if (!imageUrl) { console.log(`[NO IMG] ${nameJa}`); return; }

    counter++;
    const id = `char_${String(counter).padStart(5, '0')}`;
    const destPath = path.join(IMAGES_DIR, `${id}.jpg`);

    process.stdout.write(`  [${id}] ${nameJa} (${animeTitle}) ... `);
    try {
      await downloadImage(imageUrl, destPath);
      const size = fs.statSync(destPath).size;
      if (size < 500) throw new Error('too small');
      process.stdout.write(`OK (${Math.round(size/1024)}KB)\n`);
      characters.push({
        id, name: nameJa,
        nameEn: formatEnglishName(found.character?.name || ''),
        anime: animeTitle,
        imageUrl: `/images/${id}.jpg`,
        difficulty: difficulty,
        tags: ['アニメ'],
        memo: '',
        malCharId: charMalId || null,
      });
      if (charMalId) processedCharIds.add(String(charMalId));
    } catch(e) {
      process.stdout.write(`DL ERROR: ${e.message}\n`);
      counter--;
    }
  }

  // === 2. 不足キャラを追加 ===

  // ウマ娘S2 - 東海帝王 (Jikanでは "Toukai Teiou")
  await addChar('ウマ娘 プリティーダービー Season 2', 'anime', 42941, ['Toukai Teiou', 'toukai', 'teiou'], '東海帝王');

  // ドラえもん - ジャイアン (Jikanでは "Gouda, Takeshi")
  await addChar('ドラえもん (2005)', 'anime', 8687, ['Gouda, Takeshi', 'gouda'], '剛田 武（ジャイアン）');

  // 名探偵コナン - 降谷零 (Furuya Rei / Bourbon)
  await addChar('名探偵コナン', 'anime', 235, ['Furuya, Rei', 'furuyarei', 'bourbon'], '降谷 零', 2);

  // Fate/Zero - ライダー (Rider = Iskandar)
  await addChar('Fate/Zero', 'manga', 3649, ['Rider', 'Iskandar'], 'イスカンダル（ライダー）');

  // Fate/Zero - セイバー (Saber = Artoria)
  await addChar('Fate/Zero', 'manga', 3649, ['Saber'], 'アルトリア・ペンドラゴン（セイバー）');

  // Fate/Zero - イリヤスフィール von Einzbern
  await addChar('Fate/Zero', 'manga', 3649, ['von Einzbern, Irisviel', 'irisviel'], 'イリヤスフィール・フォン・アインツベルン');

  // キングダム - 信 (もし未追加なら)
  await addChar('キングダム', 'manga', 16765, ['Xin', 'Shin'], '信（シン）');

  // 逃げ上手 - ユキ・チカアキ
  await addChar('逃げ上手の若君', 'anime', 54724, ['Yuki, Chikaaki', 'chikaaki', 'yukichikaaki'], '雪 千秋');

  // 保存
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8');
  console.log(`\n完了: ${characters.length} キャラ保存`);
}

main().catch(console.error);
