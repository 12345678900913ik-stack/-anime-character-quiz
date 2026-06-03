// MAL IDを検索するスクリプト
import https from "https";

const JIKAN_BASE = "https://api.jikan.moe/v4";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "AnimeQuizGame/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

const searches = [
  { title: "俺だけレベルアップな件", query: "Solo Leveling" },
  { title: "ワンピース", query: "One Piece" },
  { title: "名探偵コナン", query: "Detective Conan" },
  { title: "逃げ上手の若君", query: "Nigejozu no Wakagimi" },
  { title: "ドラえもん (2005)", query: "Doraemon 2005" },
  { title: "ウマ娘 プリティーダービー", query: "Uma Musume Pretty Derby" },
  { title: "ARIA The ANIMATION", query: "ARIA The ANIMATION" },
  { title: "ARIA The NATURAL", query: "ARIA The NATURAL" },
  { title: "ARIA The ORIGINATION", query: "ARIA The ORIGINATION" },
  { title: "機動戦士ガンダム", query: "Mobile Suit Gundam 1979" },
  { title: "機動戦士ガンダムSEED", query: "Mobile Suit Gundam SEED" },
  { title: "機動戦士ガンダム00", query: "Mobile Suit Gundam 00" },
  { title: "新機動戦記ガンダムW", query: "Gundam Wing" },
  { title: "ハッピーシュガーライフ", query: "Happy Sugar Life" },
  { title: "Fate/Grand Order First Order", query: "Fate Grand Order First Order" },
  { title: "Fate/strange fake", query: "Fate strange fake Whispers of Dawn" },
  { title: "新世紀エヴァンゲリオン", query: "Neon Genesis Evangelion" },
  { title: "ポケットモンスター", query: "Pocket Monsters 2019" },
];

for (const s of searches) {
  try {
    await sleep(500);
    const url = `${JIKAN_BASE}/anime?q=${encodeURIComponent(s.query)}&limit=3`;
    const data = await fetchJson(url);
    const results = data.data || [];
    console.log(`\n[${s.title}]`);
    results.forEach(r => {
      console.log(`  MAL:${r.mal_id} | "${r.title}" (${r.title_japanese || ''}) ${r.aired?.prop?.from?.year || ''}`);
    });
  } catch (e) {
    console.log(`[ERROR] ${s.title}: ${e.message}`);
  }
}
