"""
missing_popular_jump_focused_no_vjump_with_characters_final.xlsx を
scripts/new_excel_data.json に変換するスクリプト。

カラム構成 (0-indexed):
 0: No.
 1: 作品名
 2: 英語名・別名
 3: 分類 (アニメ/漫画)
 4: 主要キャラクター
 5: 取得キャラクター名 (数値)
 6: キャラクター一覧 (数値)
 7: 開始年 (日付)
 8: MALメイン名
 9: MALスコア
10: メンバー数
11: 長さ
12: ジャンル
13: URL
14: ジャンプ系統
15: 対象誌・補完理由
16: 処理分類
17: キャラクター補完状態
"""
import pandas as pd
import json
import sys
import re

INPUT = "c:/アニメキャラあてゲーム/missing_popular_jump_focused_no_vjump_with_characters_final.xlsx"
df = pd.read_excel(INPUT)
print(f"行数: {len(df)}, カラム数: {len(df.columns)}")

def extract_mal_id(url):
    if not isinstance(url, str):
        return None
    m = re.search(r"myanimelist\.net/(anime|manga)/(\d+)", url)
    return int(m.group(2)) if m else None

def extract_endpoint(url):
    if not isinstance(url, str):
        return "anime"
    m = re.search(r"myanimelist\.net/(anime|manga)/", url)
    return m.group(1) if m else "anime"

def parse_characters(chars_str):
    if not isinstance(chars_str, str) or not chars_str.strip():
        return []
    return [c.strip() for c in chars_str.split("、") if c.strip()]

def extract_year(val):
    if pd.isna(val):
        return None
    s = str(val)
    m = re.match(r"(\d{4})", s)
    return int(m.group(1)) if m else None

records = []
for _, row in df.iterrows():
    url_val = str(row.iloc[13]) if pd.notna(row.iloc[13]) else ""
    mal_id = extract_mal_id(url_val)
    endpoint = extract_endpoint(url_val)

    if not mal_id:
        continue

    chars = parse_characters(str(row.iloc[4]) if pd.notna(row.iloc[4]) else "")
    if not chars:
        print(f"  SKIP (no chars): {row.iloc[1]}")
        continue

    type_raw = str(row.iloc[3]) if pd.notna(row.iloc[3]) else "アニメ"
    type_val = "漫画" if "漫" in type_raw else "アニメ"

    records.append({
        "title": str(row.iloc[1]) if pd.notna(row.iloc[1]) else "",
        "type": type_val,
        "start_year": extract_year(row.iloc[7]),
        "mal_id": mal_id,
        "endpoint": endpoint,
        "characters": chars,
    })

out_path = "c:/アニメキャラあてゲーム/scripts/new_excel_data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

total_chars = sum(len(r["characters"]) for r in records)
sys.stdout.buffer.write(f"変換完了: {len(records)} 作品, キャラ合計 {total_chars}\n".encode("utf-8"))
sys.stdout.buffer.write(f"先頭3件:\n".encode("utf-8"))
for r in records[:3]:
    sys.stdout.buffer.write(f"  {r['title']} ({r['type']}, {r['start_year']}, {r['endpoint']}/{r['mal_id']}): {r['characters'][:3]}\n".encode("utf-8"))
