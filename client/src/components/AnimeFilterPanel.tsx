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

type SortMode = 'name' | 'count';

export default function AnimeFilterPanel({ excludedAnime, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');

  const excludedSet = useMemo(() => new Set(excludedAnime), [excludedAnime]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? ALL_ANIME.filter(a => a.toLowerCase().includes(q)) : [...ALL_ANIME];
    if (sort === 'count') {
      list = list.sort((a, b) => (ANIME_CHAR_COUNT[b] ?? 0) - (ANIME_CHAR_COUNT[a] ?? 0));
    }
    return list;
  }, [search, sort]);

  const toggle = (anime: string) => {
    const next = excludedSet.has(anime)
      ? excludedAnime.filter(a => a !== anime)
      : [...excludedAnime, anime];
    persist(next);
    onChange(next);
  };

  const enableAll = () => { persist([]); onChange([]); };
  const disableAll = () => { persist([...ALL_ANIME]); onChange([...ALL_ANIME]); };
  const invert = () => {
    const next = ALL_ANIME.filter(a => !excludedSet.has(a));
    persist(next);
    onChange(next);
  };

  const includedCount = ALL_ANIME.length - excludedAnime.length;
  const activeCharCount = characters.filter(c => !excludedSet.has(c.anime)).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card w-full flex items-center justify-between gap-3 hover:border-gray-500 transition-colors text-left"
      >
        <div>
          <p className="section-label">作品フィルター</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {includedCount} / {ALL_ANIME.length} 作品 · {activeCharCount.toLocaleString()} キャラ有効
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {excludedAnime.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
              {excludedAnime.length}作品除外中
            </span>
          )}
          <span className="text-gray-400 text-sm">編集 ›</span>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-700 flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-100 text-lg">作品フィルター</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="text-blue-400 font-medium">{includedCount}</span> / {ALL_ANIME.length} 作品 ·{' '}
                  <span className="text-blue-400 font-medium">{activeCharCount.toLocaleString()}</span> キャラ有効
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-200 text-2xl leading-none px-1 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Controls */}
            <div className="px-5 py-3 border-b border-gray-700 space-y-2.5 flex-shrink-0">
              <input
                type="text"
                placeholder="作品名で検索..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field py-2 text-sm w-full"
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded border border-gray-600 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setSort('name')}
                    className={`px-3 py-1.5 transition-colors ${sort === 'name' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    名前順
                  </button>
                  <button
                    type="button"
                    onClick={() => setSort('count')}
                    className={`px-3 py-1.5 border-l border-gray-600 transition-colors ${sort === 'count' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    キャラ数順
                  </button>
                </div>
                <div className="flex gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={enableAll}
                    className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-colors"
                  >
                    全て有効
                  </button>
                  <button
                    type="button"
                    onClick={disableAll}
                    className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    全て除外
                  </button>
                  <button
                    type="button"
                    onClick={invert}
                    className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:border-yellow-500 hover:text-yellow-400 transition-colors"
                  >
                    反転
                  </button>
                </div>
              </div>
              {search && (
                <p className="text-xs text-gray-500">{filtered.length} 件ヒット</p>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-700/30">
              {filtered.map(anime => {
                const excluded = excludedSet.has(anime);
                return (
                  <button
                    key={anime}
                    type="button"
                    onClick={() => toggle(anime)}
                    className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                      excluded ? 'hover:bg-gray-700/20' : 'hover:bg-blue-500/5'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      excluded
                        ? 'border-gray-600 bg-transparent'
                        : 'border-blue-500 bg-blue-500/20'
                    }`}>
                      {!excluded && <span className="text-blue-400 text-xs font-bold">✓</span>}
                    </span>
                    <span className={`flex-1 text-sm transition-colors ${
                      excluded ? 'text-gray-600 line-through' : 'text-gray-200'
                    }`}>
                      {anime}
                    </span>
                    <span className={`text-xs tabular-nums flex-shrink-0 ${
                      excluded ? 'text-gray-700' : 'text-gray-500'
                    }`}>
                      {ANIME_CHAR_COUNT[anime]}人
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-12">見つかりません</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
