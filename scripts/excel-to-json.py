"""
Excel (anime_manga_list_with_characters_final.xlsx) を
scripts/excel_data.json に変換するスクリプト。
"""
import pandas as pd
import json
import sys
import re

df = pd.read_excel("c:/アニメキャラあてゲーム/anime_manga_list_with_characters_final.xlsx")
df.columns = ["title", "type", "start_year", "url", "characters"]

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

records = []
for _, row in df.iterrows():
    mal_id = extract_mal_id(row["url"])
    endpoint = extract_endpoint(row["url"])
    chars = parse_characters(row["characters"])
    if not mal_id or not chars:
        continue
    records.append({
        "title": row["title"],
        "type": row["type"],
        "start_year": int(row["start_year"]) if pd.notna(row["start_year"]) else None,
        "mal_id": mal_id,
        "endpoint": endpoint,
        "characters": chars,
    })

out_path = "c:/アニメキャラあてゲーム/scripts/excel_data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

sys.stdout.buffer.write(f"変換完了: {len(records)} 作品、合計キャラ数 {sum(len(r['characters']) for r in records)}\n".encode("utf-8"))
