/**
 * generate-from-excel.mjs の進捗をリアルタイム表示するダッシュボード
 * 実行: node scripts/monitor.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, "progress.json");
const CHARACTERS_PATH = path.join(__dirname, "../server/data/characters.json");
const IMAGES_DIR = path.join(__dirname, "../client/public/images");

const REFRESH_MS = 1000;
const BAR_WIDTH = 36;

// レート計算用
const history = []; // { time, charCount }
const MAX_HISTORY = 20;
const monitorStart = Date.now();

function readProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function countImages() {
  try {
    return fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith(".jpg")).length;
  } catch {
    return 0;
  }
}

function bar(current, total) {
  const pct = Math.min(total > 0 ? current / total : 0, 1);
  const filled = Math.round(BAR_WIDTH * pct);
  const empty = BAR_WIDTH - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function fmtDuration(ms) {
  if (ms < 0) return "--:--";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function pad(str, len, right = false) {
  const s = String(str);
  const spaces = " ".repeat(Math.max(0, len - s.length));
  return right ? spaces + s : s + spaces;
}

function line(content, width = 52) {
  const visible = content.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, width - visible.length);
  return `║ ${content}${" ".repeat(pad)} ║`;
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  red: "\x1b[31m",
};

function draw() {
  const p = readProgress();
  const now = Date.now();

  // 履歴を追加してレートを計算
  const charCount = p ? p.charCount : 0;
  const imageCount = countImages();
  history.push({ time: now, charCount, imageCount });
  if (history.length > MAX_HISTORY) history.shift();

  let rate = 0; // キャラ/分
  if (history.length >= 2) {
    const oldest = history[0];
    const newest = history[history.length - 1];
    const dtMin = (newest.time - oldest.time) / 60000;
    const dChar = p
      ? newest.charCount - oldest.charCount
      : newest.imageCount - oldest.imageCount;
    if (dtMin > 0) rate = dChar / dtMin;
  }

  // 画面クリア（先頭に移動）
  process.stdout.write("\x1b[2J\x1b[H");

  const W = 54; // 内幅（║ と ║ の間）
  const border = "═".repeat(W + 2);

  console.log(`╔${border}╗`);
  console.log(`║${" ".repeat(W + 2)}║`);
  console.log(`║  ${C.bold}${C.cyan}🎮 アニメキャラ取得 リアルタイムモニター${C.reset}        ║`);
  console.log(`║${" ".repeat(W + 2)}║`);
  console.log(`╠${border}╣`);

  if (!p) {
    // progress.json がない場合は画像数だけで推定表示
    const estTotal = 498 * 3;
    const iBar = bar(imageCount, estTotal);
    const elapsed = now - monitorStart;
    const iRate = rate;
    const iEta = iRate > 0 ? ((estTotal - imageCount) / iRate) * 60 * 1000 : null;

    console.log(`║  ${C.yellow}⏳ バックグラウンド処理中 (旧スクリプト)${C.reset}            ║`);
    console.log(`║${" ".repeat(W + 2)}║`);
    console.log(`║  ${C.bold}画像数    ${C.reset}  ${C.gray}[${C.reset}${C.blue}${iBar}${C.reset}${C.gray}]${C.reset}  ║`);
    console.log(`║             ${C.cyan}${pad(imageCount, 4, true)}${C.reset} 枚 / 推定 ~${estTotal} 枚             ║`);
    console.log(`║${" ".repeat(W + 2)}║`);
    console.log(`║  取得レート  : ${C.yellow}${iRate > 0 ? iRate.toFixed(1) + " 枚/分" : "計測中..."}${C.reset}                  ║`);
    console.log(`║  経過時間    : ${C.white}${fmtDuration(elapsed)}${C.reset}                        ║`);
    console.log(`║  残り推定    : ${iEta !== null ? C.white + fmtDuration(iEta) + C.reset : C.gray + "計算中..." + C.reset}                        ║`);
    console.log(`║${" ".repeat(W + 2)}║`);
    console.log(`║  ${C.gray}※ 次回以降は progress.json が生成されます${C.reset}          ║`);
  } else {
    const workPct = p.totalWorks > 0
      ? ((p.workIndex / p.totalWorks) * 100).toFixed(1)
      : "0.0";

    const elapsed = now - p.startTime;
    const eta = rate > 0 && !p.finished
      ? ((p.totalWorks * 3 - p.charCount) / rate) * 60 * 1000
      : null;

    const status = p.finished
      ? `${C.green}✅ 完了！${C.reset}`
      : `${C.yellow}⏳ 処理中...${C.reset}`;

    console.log(`║  ステータス  : ${status}${" ".repeat(p.finished ? 30 : 28)}║`);
    console.log(`║${" ".repeat(W + 2)}║`);

    // 作品進捗バー
    const wBar = bar(p.workIndex, p.totalWorks);
    console.log(`║  ${C.bold}作品進捗${C.reset}  ${C.gray}[${C.reset}${C.green}${wBar}${C.reset}${C.gray}]${C.reset}  ║`);
    console.log(`║             ${C.cyan}${pad(p.workIndex, 4, true)}${C.reset} / ${p.totalWorks} 作品  (${workPct}%)         ║`);
    console.log(`║${" ".repeat(W + 2)}║`);

    // キャラ数
    const estTotal = p.totalWorks * 3;
    const cBar = bar(p.charCount, estTotal);
    console.log(`║  ${C.bold}キャラ数  ${C.reset}  ${C.gray}[${C.reset}${C.blue}${cBar}${C.reset}${C.gray}]${C.reset}  ║`);
    console.log(`║             ${C.cyan}${pad(p.charCount, 4, true)}${C.reset} キャラ保存済み             ║`);
    console.log(`║             ${C.gray}${pad(imageCount, 4, true)} 枚の画像ダウンロード済み${C.reset}       ║`);
    console.log(`║${" ".repeat(W + 2)}║`);

    // 速度・時間
    console.log(`║  取得レート  : ${C.yellow}${rate > 0 ? (rate).toFixed(1) + " キャラ/分" : "計測中..."}${C.reset}              ║`);
    console.log(`║  経過時間    : ${C.white}${fmtDuration(elapsed)}${C.reset}                        ║`);
    console.log(`║  残り推定    : ${eta !== null ? C.white + fmtDuration(eta) + C.reset : C.gray + "計算中..." + C.reset}                        ║`);
    console.log(`║${" ".repeat(W + 2)}║`);

    // 直近の作品・キャラ
    const titleDisp = p.currentTitle.length > 22
      ? p.currentTitle.slice(0, 21) + "…"
      : p.currentTitle;
    const charDisp = p.lastChar.length > 18
      ? p.lastChar.slice(0, 17) + "…"
      : p.lastChar;
    console.log(`║  処理中作品  : ${C.white}${pad(titleDisp, 26)}${C.reset}  ║`);
    console.log(`║  直近キャラ  : ${C.green}${pad(charDisp, 26)}${C.reset}  ║`);

    if (p.failedCount > 0) {
      console.log(`║  ${C.red}失敗件数    : ${p.failedCount} 件${C.reset}                          ║`);
    }
  }

  console.log(`║${" ".repeat(W + 2)}║`);
  console.log(`╠${border}╣`);
  console.log(`║  ${C.gray}${new Date().toLocaleTimeString("ja-JP")} 更新  /  Ctrl+C で終了${C.reset}               ║`);
  console.log(`╚${border}╝`);
}

draw();
const timer = setInterval(draw, REFRESH_MS);

process.on("SIGINT", () => {
  clearInterval(timer);
  process.stdout.write("\x1b[2J\x1b[H");
  console.log("モニター終了");
  process.exit(0);
});
