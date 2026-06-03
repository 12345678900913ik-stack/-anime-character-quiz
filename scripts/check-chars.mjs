// キャラ一覧を確認するデバッグスクリプト
import https from 'https';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AnimeQuizGame/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

const checks = [
  { name: 'ウマ娘S2 (42941)', url: `${JIKAN_BASE}/anime/42941/characters` },
  { name: 'ドラえもん2005 (8687)', url: `${JIKAN_BASE}/anime/8687/characters` },
  { name: 'コナン (235)', url: `${JIKAN_BASE}/anime/235/characters` },
  { name: 'Fate/Zero (manga/3649)', url: `${JIKAN_BASE}/manga/3649/characters` },
];

for (const c of checks) {
  await sleep(500);
  const data = await fetchJson(c.url);
  const chars = (data.data || []).slice(0, 30);
  console.log(`\n=== ${c.name} (${chars.length} chars shown) ===`);
  chars.forEach(ch => console.log(`  [${ch.role}] ${ch.character?.name}`));
}
