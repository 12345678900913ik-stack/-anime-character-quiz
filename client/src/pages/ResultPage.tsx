import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResultPageState } from '../types';
import { onRoomChange, restartGame } from '../lib/roomService';
import { clearSession } from '../hooks/session';

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as ResultPageState | null;
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!data) navigate('/');
  }, [data, navigate]);

  // Listen for restart (quizmaster set status back to 'waiting')
  useEffect(() => {
    if (!data?.roomId) return;
    const unsub = onRoomChange(data.roomId, (room) => {
      if (!room) return;
      if (room.status === 'waiting') {
        if (data.isQuizmaster) {
          navigate(`/quizmaster/${data.roomId}`);
        } else {
          navigate(`/player/${data.roomId}`, {
            state: { playerName: data.myPlayerName ?? '', playerId: data.myPlayerId ?? '' },
          });
        }
      }
    });
    return unsub;
  }, [data, navigate]);

  if (!data) return null;

  const { scores, players, isQuizmaster, myPlayerId, myPlayerName, roomId, quizmasterId } = data;
  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  const handleRestart = async () => {
    if (!roomId) { navigate('/'); return; }
    if (isQuizmaster && quizmasterId) {
      setRestarting(true);
      await restartGame(roomId, quizmasterId);
      // Navigation handled by the onRoomChange listener above
    } else {
      // Player waits — the listener will navigate when quizmaster restarts
      navigate(`/player/${roomId}`, {
        state: { playerName: myPlayerName ?? '', playerId: myPlayerId ?? '' },
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">ゲーム終了</h1>
          <p className="text-gray-400 text-sm mt-1">最終結果</p>
        </div>

        <div className="card divide-y divide-gray-700 p-0 overflow-hidden">
          {sorted.map((player, i) => {
            const score = scores[player.id] || 0;
            const medals = ['🥇', '🥈', '🥉'];
            const isMe = !isQuizmaster && player.id === myPlayerId;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i === 0 ? 'bg-yellow-900/20' : ''
                } ${isMe ? 'ring-1 ring-inset ring-blue-500/40 bg-blue-900/10' : ''}`}
              >
                <span className="w-8 text-center text-base">
                  {medals[i] ?? <span className="text-gray-500 text-sm">{i + 1}</span>}
                </span>
                <span className={`flex-1 font-medium truncate ${isMe ? 'text-blue-300' : 'text-gray-200'}`}>
                  {player.name}{isMe ? ' (自分)' : ''}
                </span>
                <span className="font-semibold text-gray-100 tabular-nums">
                  {score} <span className="text-gray-500 font-normal text-xs">点</span>
                </span>
              </div>
            );
          })}
          {players.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              参加者がいませんでした
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => { clearSession(); navigate('/'); }} className="btn btn-secondary flex-1">
            ホームに戻る
          </button>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="btn btn-primary flex-1"
          >
            {restarting ? '再開中...' : 'もう一度'}
          </button>
        </div>

        <p className="text-gray-500 text-xs text-center">
          {isQuizmaster
            ? '「もう一度」を押すと全員が同じルームで再開します'
            : '出題者が「もう一度」を押すと自動で再開します'}
        </p>
      </div>
    </div>
  );
}
