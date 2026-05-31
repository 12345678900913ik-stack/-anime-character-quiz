import { Player } from '../types';

interface Props {
  players: Player[];
  scores: Record<string, number>;
  highlightPlayerId?: string;
}

export default function ScoreBoard({ players, scores, highlightPlayerId }: Props) {
  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-700">
        <p className="section-label">スコア</p>
      </div>
      <div className="divide-y divide-gray-700">
        {sorted.map((player, i) => (
          <div
            key={player.id}
            className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
              player.id === highlightPlayerId ? 'bg-green-900/30' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-gray-500 text-xs w-4 text-center tabular-nums">{i + 1}</span>
              <span className="text-gray-200 text-sm font-medium truncate max-w-[120px]">
                {player.name}
              </span>
            </div>
            <span className="text-gray-100 font-semibold text-sm tabular-nums">
              {scores[player.id] || 0}
              <span className="text-gray-500 font-normal text-xs ml-0.5">点</span>
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="px-4 py-3 text-gray-500 text-sm">参加者なし</p>
        )}
      </div>
    </div>
  );
}
