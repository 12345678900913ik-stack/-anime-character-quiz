import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../lib/roomService';
import { saveSession, clearSession } from '../hooks/session';

type View = 'home' | 'player';

export default function TopPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    clearSession();
    try {
      const { roomId, quizmasterId } = await createRoom();
      saveSession({ roomId, role: 'quizmaster', quizmasterId });
      navigate(`/quizmaster/${roomId}`);
    } catch {
      setError('ルームの作成に失敗しました。');
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name) { setError('名前を入力してください'); return; }
    if (code.length !== 4) { setError('4桁のルームコードを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(code, name);
      if ('error' in result) {
        setError(result.error);
        setLoading(false);
        return;
      }
      saveSession({ roomId: code, role: 'player', playerId: result.playerId, playerName: name });
      navigate(`/player/${code}`, {
        state: { playerName: name, playerId: result.playerId },
      });
    } catch {
      setError('参加に失敗しました。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-6">

        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-gray-100">アニメキャラクイズ</h1>
          <p className="text-gray-400 text-sm mt-1">キャラクターの名前を当てよう</p>
        </div>

        {view === 'home' && (
          <div className="space-y-3">
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="btn btn-primary btn-lg w-full"
            >
              {loading ? '作成中...' : '出題者として始める'}
            </button>
            <button
              onClick={() => setView('player')}
              className="btn btn-secondary btn-lg w-full"
            >
              回答者として参加する
            </button>
          </div>
        )}

        {view === 'player' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-200">回答者として参加</h2>

            <div className="space-y-1">
              <label className="section-label">名前</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                placeholder="田中たろう"
                className="input-field"
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="section-label">ルームコード</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                placeholder="ABCD"
                className="input-field font-mono text-center text-xl tracking-widest"
                maxLength={4}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setView('home'); setError(''); setLoading(false); }}
                className="btn btn-secondary flex-1"
              >
                戻る
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? '接続中...' : '参加する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
