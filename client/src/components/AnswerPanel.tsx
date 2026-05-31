import { Character } from '../types';

interface Props {
  character: Character | null;
}

export default function AnswerPanel({ character }: Props) {
  if (!character) {
    return (
      <div className="card flex items-center justify-center min-h-[120px]">
        <p className="text-gray-500 text-sm">問題開始後に表示されます</p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-1.5 pb-1 border-b border-gray-700">
        <span className="text-green-400 text-xs">●</span>
        <p className="section-label">正解情報</p>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">キャラクター名</p>
          <p className="text-xl font-bold text-gray-100">{character.name}</p>
          {character.nameEn && character.nameEn !== character.name && (
            <p className="text-xs text-gray-500 mt-0.5">{character.nameEn}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">作品名</p>
          <p className="text-sm font-medium text-gray-300">{character.anime}</p>
        </div>
        {character.memo && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">メモ</p>
            <p className="text-sm text-gray-400">{character.memo}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          character.difficulty === 1
            ? 'bg-green-900/50 text-green-400'
            : 'bg-yellow-900/50 text-yellow-400'
        }`}>
          {character.difficulty === 1 ? '簡単' : '普通'}
        </span>
        {character.tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
