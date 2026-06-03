// excel_data.json を更新するスクリプト
// 新規アニメの追加 + 既存アニメのキャラ増加

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_JSON = path.join(__dirname, 'excel_data.json');
const PROCESSED_TITLES = path.join(__dirname, 'processed_titles.json');

const data = JSON.parse(fs.readFileSync(EXCEL_JSON, 'utf-8'));
let processed = JSON.parse(fs.readFileSync(PROCESSED_TITLES, 'utf-8'));

// =============================
// 既存エントリのキャラ数を増やす
// =============================

// Fate/Zero (MAL 3649): 3 → 10
const fateZero = data.find(d => d.mal_id === 3649);
if (fateZero) {
  fateZero.characters = [
    "Emiya, Kiritsugu",
    "Gilgamesh",
    "Kotomine, Kirei",
    "Artoria Pendragon",
    "Iskandar",
    "Matou, Kariya",
    "Tohsaka, Tokiomi",
    "von Einzbern, Irisviel",
    "Velvet, Waver",
    "Diarmuid Ua Duibhne"
  ];
  processed = processed.filter(id => id !== 3649);
  console.log('[UPDATE] Fate/Zero: chars updated, removed from processed');
}

// ヱヴァンゲリヲン新劇場版:序 (MAL 2759): 5 → 10
const eva1 = data.find(d => d.mal_id === 2759);
if (eva1) {
  eva1.characters = [
    "Ayanami, Rei",
    "Ikari, Shinji",
    "Katsuragi, Misato",
    "Aida, Kensuke",
    "Akagi, Ritsuko",
    "Souryu, Asuka Langley",
    "Nagisa, Kaworu",
    "Ikari, Gendo",
    "Fuyutsuki, Kouzou",
    "Suzuhara, Touji"
  ];
  processed = processed.filter(id => id !== 2759);
  console.log('[UPDATE] ヱヴァ序: chars updated, removed from processed');
}

// シン・エヴァンゲリオン劇場版𝄇 (MAL 3786): 5 → 10
const eva4 = data.find(d => d.mal_id === 3786);
if (eva4) {
  eva4.characters = [
    "Ayanami (tentative), Rei",
    "Ikari, Shinji",
    "Nagisa, Kaworu",
    "Souryuu, Asuka Langley",
    "Aida, Kensuke",
    "Katsuragi, Misato",
    "Mari Illustrious Makinami",
    "Ikari, Gendo",
    "Fuyutsuki, Kouzou",
    "Suzuhara, Touji"
  ];
  processed = processed.filter(id => id !== 3786);
  console.log('[UPDATE] シン・エヴァ: chars updated, removed from processed');
}

// 宇宙兄弟 (MAL 14483): 3 → 8
const spaceB = data.find(d => d.mal_id === 14483);
if (spaceB) {
  spaceB.characters = [
    "Nanba, Mutta",
    "Nanba, Hibito",
    "Aotake, Fumi",
    "Hoshika, Serika",
    "Nitta, Kenji",
    "Dobrovsky, Ivan",
    "Makabe, Kenji",
    "Azuma, Daisuke"
  ];
  processed = processed.filter(id => id !== 14483);
  console.log('[UPDATE] 宇宙兄弟: chars updated, removed from processed');
}

// 銀の匙 Silver Spoon (MAL 25096): 3 → 8
const silverS = data.find(d => d.mal_id === 25096);
if (silverS) {
  silverS.characters = [
    "Hachiken, Yuugo",
    "Mikage, Aki",
    "Aikawa, Shinnosuke",
    "Komaba, Ichiro",
    "Yoshino, Keiji",
    "Nishikawa, Ichirou",
    "Inada, Tamako",
    "Tokiwa, Yuuki"
  ];
  processed = processed.filter(id => id !== 25096);
  console.log('[UPDATE] 銀の匙: chars updated, removed from processed');
}

// キングダム (MAL 16765): 5 → 10
const kingdom = data.find(d => d.mal_id === 16765);
if (kingdom) {
  kingdom.characters = [
    "He Liao, Diao",
    "Xin",
    "Ying, Zheng",
    "Wang Qi",
    "Li Mu",
    "Ten",
    "Kyoukai",
    "Piao",
    "Bi",
    "Meng Yi"
  ];
  processed = processed.filter(id => id !== 16765);
  console.log('[UPDATE] キングダム: chars updated, removed from processed');
}

// メダリスト (MAL 129621): 3 → 7
const medal = data.find(d => d.mal_id === 129621);
if (medal) {
  medal.characters = [
    "Akeuraji, Tsukasa",
    "Yuitsuka, Inori",
    "Ahiru, Miku",
    "Inoue, Tsukasa",
    "Hiragino, Moe",
    "Kishimoto, Koutarou",
    "Muto, Kaito"
  ];
  processed = processed.filter(id => id !== 129621);
  console.log('[UPDATE] メダリスト: chars updated, removed from processed');
}

// Fate/stay night UBW (MAL 22297): 7 → 12
const fateUBW = data.find(d => d.mal_id === 22297);
if (fateUBW) {
  fateUBW.characters = [
    "Archer",
    "Emiya, Shirou",
    "Saber",
    "Toosaka, Rin",
    "Assassin",
    "Berserker",
    "Caster",
    "Gilgamesh",
    "Kotomine, Kirei",
    "von Einzbern, Illyasviel",
    "Lancer",
    "Matou, Shinji"
  ];
  processed = processed.filter(id => id !== 22297);
  console.log('[UPDATE] Fate/UBW: chars updated, removed from processed');
}

// Fate/Apocrypha (MAL 34662): 5 → 10
const fateApoc = data.find(d => d.mal_id === 34662);
if (fateApoc) {
  fateApoc.characters = [
    "Astolfo",
    "d'Arc, Jeanne",
    "Sieg",
    "Karna",
    "Atalante",
    "Mordred",
    "Amakusa, Shirou Tokisada",
    "Fiore Forvedge Yggdmillennia",
    "Semiramis",
    "Shiro, Kotomine"
  ];
  processed = processed.filter(id => id !== 34662);
  console.log('[UPDATE] Fate/Apocrypha: chars updated, removed from processed');
}

// Heaven's Feel I (MAL 25537): 5 → 9
const hf1 = data.find(d => d.mal_id === 25537);
if (hf1) {
  hf1.characters = [
    "Emiya, Shirou",
    "Matou, Sakura",
    "Saber",
    "Toosaka, Rin",
    "Archer",
    "Matou, Zouken",
    "Berserker",
    "Gilgamesh",
    "von Einzbern, Illyasviel"
  ];
  processed = processed.filter(id => id !== 25537);
  console.log('[UPDATE] Heaven\'s Feel I: chars updated, removed from processed');
}

// Heaven's Feel II (MAL 33049): 5 → 7
const hf2 = data.find(d => d.mal_id === 33049);
if (hf2) {
  hf2.characters = [
    "Emiya, Shirou",
    "Matou, Sakura",
    "Toosaka, Rin",
    "Archer",
    "Berserker",
    "Kotomine, Kirei",
    "Zouken"
  ];
  processed = processed.filter(id => id !== 33049);
  console.log('[UPDATE] Heaven\'s Feel II: chars updated, removed from processed');
}

// ================
// 新規エントリを追加
// ================

const newEntries = [
  // 俺だけレベルアップな件 Season 1
  {
    title: "俺だけレベルアップな件",
    type: "アニメ",
    start_year: 2024,
    mal_id: 52299,
    endpoint: "anime",
    characters: [
      "Sung, Jinwoo",
      "Cha, Hae-In",
      "Yoo, Jinho",
      "Go, Gunhee",
      "Baek, Yoonho",
      "Goto, Ryuji",
      "Beru",
      "Iron",
      "Igris",
      "Park, Jongsoo"
    ]
  },
  // ONE PIECE
  {
    title: "ONE PIECE",
    type: "アニメ",
    start_year: 1999,
    mal_id: 21,
    endpoint: "anime",
    characters: [
      "Monkey D., Luffy",
      "Roronoa, Zoro",
      "Nami",
      "Usopp",
      "Sanji",
      "Tony Tony, Chopper",
      "Nico, Robin",
      "Franky",
      "Brook",
      "Jinbe",
      "Portgas D., Ace",
      "Shanks",
      "Trafalgar D. Water, Law",
      "Boa, Hancock"
    ]
  },
  // 名探偵コナン
  {
    title: "名探偵コナン",
    type: "アニメ",
    start_year: 1996,
    mal_id: 235,
    endpoint: "anime",
    characters: [
      "Edogawa, Conan",
      "Mouri, Ran",
      "Hattori, Heiji",
      "Kudo, Shinichi",
      "Kuroba, Kaito",
      "Akai, Shuuichi",
      "Haibara, Ai",
      "Furuya, Rei",
      "Mouri, Kogoro",
      "Suzuki, Sonoko"
    ]
  },
  // 逃げ上手の若君
  {
    title: "逃げ上手の若君",
    type: "アニメ",
    start_year: 2024,
    mal_id: 54724,
    endpoint: "anime",
    characters: [
      "Hojo, Tokiyuki",
      "Suwa, Yorishige",
      "Fubuki",
      "Yuki, Chikaaki",
      "Ogasawara, Sadamune",
      "Ashikaga, Takauji",
      "Kotaro"
    ]
  },
  // ドラえもん (2005)
  {
    title: "ドラえもん (2005)",
    type: "アニメ",
    start_year: 2005,
    mal_id: 8687,
    endpoint: "anime",
    characters: [
      "Doraemon",
      "Nobi, Nobita",
      "Minamoto, Shizuka",
      "Honekawa, Suneo",
      "Goda, Takeshi",
      "Nobi, Tamako",
      "Sewashi"
    ]
  },
  // ウマ娘 Season 1
  {
    title: "ウマ娘 プリティーダービー",
    type: "アニメ",
    start_year: 2018,
    mal_id: 35249,
    endpoint: "anime",
    characters: [
      "Special Week",
      "Silence Suzuka",
      "El Condor Pasa",
      "Grass Wonder",
      "Gold Ship",
      "Symboli Rudolf",
      "Biwa Hayahide",
      "Trainer"
    ]
  },
  // ウマ娘 Season 2
  {
    title: "ウマ娘 プリティーダービー Season 2",
    type: "アニメ",
    start_year: 2021,
    mal_id: 42941,
    endpoint: "anime",
    characters: [
      "Tokai Teio",
      "Mejiro McQueen",
      "Gold Ship",
      "Vodka",
      "Daiwa Scarlet",
      "Oguri Cap",
      "Mihono Bourbon",
      "Rice Shower"
    ]
  },
  // ARIA The ANIMATION
  {
    title: "ARIA The ANIMATION",
    type: "アニメ",
    start_year: 2005,
    mal_id: 477,
    endpoint: "anime",
    characters: [
      "Mizunashi, Akari",
      "Carroll, Alice",
      "Granzchesta, Aika S.",
      "Florence, Alicia",
      "Glory, Athena",
      "Ferrari, Akira E.",
      "Woody",
      "Al"
    ]
  },
  // ARIA The NATURAL
  {
    title: "ARIA The NATURAL",
    type: "アニメ",
    start_year: 2006,
    mal_id: 962,
    endpoint: "anime",
    characters: [
      "Mizunashi, Akari",
      "Carroll, Alice",
      "Granzchesta, Aika S.",
      "Florence, Alicia",
      "Glory, Athena",
      "Ferrari, Akira E.",
      "Akino",
      "Maa"
    ]
  },
  // ARIA The ORIGINATION
  {
    title: "ARIA The ORIGINATION",
    type: "アニメ",
    start_year: 2008,
    mal_id: 3297,
    endpoint: "anime",
    characters: [
      "Mizunashi, Akari",
      "Carroll, Alice",
      "Granzchesta, Aika S.",
      "Florence, Alicia",
      "Glory, Athena",
      "Ferrari, Akira E.",
      "Woody",
      "Akino"
    ]
  },
  // 機動戦士ガンダム (original 1979)
  {
    title: "機動戦士ガンダム",
    type: "アニメ",
    start_year: 1979,
    mal_id: 80,
    endpoint: "anime",
    characters: [
      "Ray, Amuro",
      "Aznable, Char",
      "Mass, Sayla",
      "Noa, Bright",
      "Sune, Lalah",
      "Ral, Ramba",
      "Zabi, Garma",
      "Zabi, Dozle",
      "Yashima, Mirai"
    ]
  },
  // 機動戦士ガンダムSEED
  {
    title: "機動戦士ガンダムSEED",
    type: "アニメ",
    start_year: 2002,
    mal_id: 93,
    endpoint: "anime",
    characters: [
      "Yamato, Kira",
      "Clyne, Lacus",
      "Zala, Athrun",
      "Yula Athha, Cagalli",
      "Allster, Flay",
      "La Flaga, Mu",
      "Waltfeld, Andrew",
      "Joule, Yzak",
      "Elsman, Dearka"
    ]
  },
  // 機動戦士ガンダム00
  {
    title: "機動戦士ガンダム00",
    type: "アニメ",
    start_year: 2007,
    mal_id: 2581,
    endpoint: "anime",
    characters: [
      "Setsuna F. Seiei",
      "Stratos, Lockon",
      "Haptism, Allelujah",
      "Erde, Tieria",
      "Grace, Feldt",
      "Aker, Graham",
      "Wang Liu Mei",
      "Nena Trinity"
    ]
  },
  // 新機動戦記ガンダムW
  {
    title: "新機動戦記ガンダムW",
    type: "アニメ",
    start_year: 1995,
    mal_id: 90,
    endpoint: "anime",
    characters: [
      "Yuy, Heero",
      "Maxwell, Duo",
      "Barton, Trowa",
      "Winner, Quatre Raberba",
      "Wufei, Chang",
      "Peacecraft, Relena",
      "Merquise, Zechs",
      "Noin, Lucrezia",
      "Treize Khushrenada"
    ]
  },
  // ハッピーシュガーライフ
  {
    title: "ハッピーシュガーライフ",
    type: "アニメ",
    start_year: 2018,
    mal_id: 37517,
    endpoint: "anime",
    characters: [
      "Matsuzaka, Satou",
      "Shio",
      "Asahi",
      "Kitaumekawa, Taiyou",
      "Yuuna",
      "Shouko"
    ]
  },
  // Fate/Grand Order -First Order-
  {
    title: "Fate/Grand Order -First Order-",
    type: "アニメ",
    start_year: 2016,
    mal_id: 34321,
    endpoint: "anime",
    characters: [
      "Fujimaru, Ritsuka",
      "Kyrielight, Mash",
      "Romani, Archaman",
      "Olga Marie Animusphere",
      "Lev Lainur"
    ]
  },
  // Fate/strange Fake -Whispers of Dawn-
  {
    title: "Fate/strange Fake -Whispers of Dawn-",
    type: "アニメ",
    start_year: 2023,
    mal_id: 53127,
    endpoint: "anime",
    characters: [
      "Flat, Escardos",
      "Sajyou, Ayaka",
      "Dumas, Alexandre",
      "Saber",
      "True Archer",
      "Jester Karture"
    ]
  },
  // 新世紀エヴァンゲリオン (original TV series)
  {
    title: "新世紀エヴァンゲリオン",
    type: "アニメ",
    start_year: 1995,
    mal_id: 30,
    endpoint: "anime",
    characters: [
      "Ikari, Shinji",
      "Ayanami, Rei",
      "Souryu, Asuka Langley",
      "Katsuragi, Misato",
      "Ikari, Gendo",
      "Nagisa, Kaworu",
      "Akagi, Ritsuko",
      "Fuyutsuki, Kouzou",
      "Suzuhara, Touji",
      "Aida, Kensuke"
    ]
  },
  // ポケットモンスター (original 1997) - human characters only
  {
    title: "ポケットモンスター",
    type: "アニメ",
    start_year: 1997,
    mal_id: 527,
    endpoint: "anime",
    characters: [
      "Satoshi",
      "Kasumi",
      "Takeshi",
      "Musashi",
      "Kojirou",
      "Shigeru",
      "Sakaki"
    ]
  },
  // ポケットモンスター (2019) - human characters
  {
    title: "ポケットモンスター (2019)",
    type: "アニメ",
    start_year: 2019,
    mal_id: 40351,
    endpoint: "anime",
    characters: [
      "Satoshi",
      "Go",
      "Koharu",
      "Dande",
      "Musashi",
      "Kojirou"
    ]
  }
];

// 既存MAL IDとの重複チェックして追加
const existingIds = new Set(data.map(d => d.mal_id));
let addedCount = 0;
for (const entry of newEntries) {
  if (!existingIds.has(entry.mal_id)) {
    data.push(entry);
    existingIds.add(entry.mal_id);
    addedCount++;
    console.log(`[ADD] ${entry.title} (MAL:${entry.mal_id}) - ${entry.characters.length} chars`);
  } else {
    console.log(`[SKIP] Already exists: ${entry.title} (MAL:${entry.mal_id})`);
  }
}

// 保存
fs.writeFileSync(EXCEL_JSON, JSON.stringify(data, null, 2), 'utf-8');
fs.writeFileSync(PROCESSED_TITLES, JSON.stringify(processed), 'utf-8');

console.log(`\n===== 完了 =====`);
console.log(`新規追加: ${addedCount} 作品`);
console.log(`Total entries: ${data.length}`);
console.log(`Processed titles remaining: ${processed.length}`);
