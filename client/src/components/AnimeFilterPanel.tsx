import { useState, useMemo } from 'react';
import charactersData from '../data/characters.json';
import { Character } from '../types';

const characters = charactersData as Character[];

const ALL_ANIME = [...new Set(characters.map(c => c.anime))].sort((a, b) =>
  a.localeCompare(b, 'ja')
);

const ANIME_CHAR_COUNT: Record<string, number> = {};
for (const c of characters) {
  ANIME_CHAR_COUNT[c.anime] = (ANIME_CHAR_COUNT[c.anime] || 0) + 1;
}

const LS_KEY = 'anime_quiz_excluded_anime';

export function loadExcludedAnime(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

interface Props {
  excludedAnime: string[];
  onChange: (excluded: string[]) => void;
}

export default function AnimeFilterPanel({ excludedAnime, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ALL_ANIME.filter(a => a.toLowerCase().includes(q)) : ALL_ANIME;
  }, [search]);

  const excludedSet = useMemo(() => new Set(excludedAnime), [excludedAnime]);

  const toggle = (anime: string) => {
    const next = excludedSet.has(anime)
      ? excludedAnime.filter(a => a !== anime)
      : [...excludedAnime, anime];
    persist(next);
    onChange(next);
  };

  const clearAll = () => { persist([]); onChange([]); };

  const activeCharCount = useMemo(
    () => characters.filter(c => !excludedSet.has(c.anime)).length,
    [excludedSet]
  );

  return (
    <div className="card space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2"
      >
        <p className="section-label">作品フィルター</p>
        <div className="flex items-center gap-2">
          {excludedAnime.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
              {excludedAnime.length}作品除外中
            </span>
          )}
          <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            有効キャラ数:{' '}
            <span className="text-gray-300 font-medium">{activeCharCount}</span>
            {' '}/ {characters.length}
          </p>

          <input
            type="text"
            placeholder="作品名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field py-1.5 text-sm"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{filtered.length}作品</span>
            {excludedAnime.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                すべて有効に戻す
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto rounded border border-gray-700 divide-y divide-gray-700/40">
            {filtered.map(anime => {
              const excluded = excludedSet.has(anime);
              return (
                <button
                  key={anime}
                  type="button"
                  onClick={() => toggle(anime)}
                  className={`w-full text-left text-sm px-3 py-1.5 flex items-center gap-2 transition-colors ${
                    excluded ? 'hover:bg-gray-900/60' : 'hover:bg-gray-700/40'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                      excluded
                        ? 'border-gray-600 text-gray-600'
                        : 'border-blue-500 bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {excluded ? '' : '✓'}
                  </span>
                  <span className={`flex-1 truncate transition-colors ${excluded ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                    {anime}
                  </span>
                  <span className="text-xs text-gray-600 flex-shrink-0 tabular-nums">
                    {ANIME_CHAR_COUNT[anime]}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">見つかりません</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
