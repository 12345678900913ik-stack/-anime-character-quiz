import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import socket from '../hooks/useSocket';
import { getSession, clearSession } from '../hooks/session';
import { Character, Player, GameSettings, GameEndData } from '../types';
import CharacterImage from '../components/CharacterImage';
import ScoreBoard from '../components/ScoreBoard';
import AnswerPanel from '../components/AnswerPanel';

type Status = 'waiting' | 'playing';
type MobileTab = 'answer' | 'score';

function JudgeModal({ players, onSelect, onCancel }: {
  players: Player[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-xs shadow-xl">
        <h3 className="font-semibold text-gray-200 mb-3">正解者を選択</h3>
        <div className="space-y-2">
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="btn btn-secondary w-full justify-start text-left"
            >
              {p.name}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="btn btn-secondary w-full mt-3 text-gray-400">
          キャンセル
        </button>
      </div>
    </div>
  );
}

export default function QuizmasterPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialPlayers = (location.state as { initialPlayers?: Player[] } | null)?.initialPlayers ?? [];

  const [status, setStatus] = useState<Status>('waiting');
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const playersRef = useRef<Player[]>(initialPlayers);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [currentChar, setCurrentChar] = useState<Character | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [flashPlayerId, setFlashPlayerId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('answer');
  const [settings, setSettings] = useState<GameSettings>({
    totalQuestions: 10,
    timeLimit: 30,
    difficulty: 'all',
  });

  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => {
    if (!roomId) return;

    // Session recovery: called on mount (if already connected) and on every reconnect
    const doReconnect = () => {
      if ((socket as any).recovered) return; // socket.io already replayed missed events
      const session = getSession();
      if (session?.roomId === roomId && session.role === 'quizmaster') {
        socket.emit('reconnect_session', session);
      }
    };
    socket.on('connect', doReconnect);
    if (socket.connected) doReconnect();

    const onPlayers = ({ players: ps }: { players: Player[] }) => setPlayers(ps);
    const onStarted = ({ totalQuestions: total }: any) => { setTotalQuestions(total); setStatus('playing'); };
    const onAnswer = ({ character }: { character: Character }) => {
      setCurrentChar(character);
      setMobileTab('answer');
    };
    const onChanged = ({ index }: { index: number }) => setCurrentIndex(index);
    const onCorrect = ({ playerId, scores: s }: { playerId: string; scores: Record<string, number> }) => {
      setScores(s);
      setFlashPlayerId(playerId);
      setMobileTab('score');
      setTimeout(() => setFlashPlayerId(null), 2000);
    };
    const onEnd = (data: GameEndData) =>
      navigate('/result', { state: { ...data, isQuizmaster: true } });

    const onRestored = (payload: any) => {
      if (payload.role !== 'quizmaster') return;
      if (payload.status === 'result') {
        clearSession();
        navigate('/');
        return;
      }
      setPlayers(payload.players ?? []);
      setScores(payload.scores ?? {});
      if (payload.status === 'playing') {
        setStatus('playing');
        setCurrentIndex(payload.currentIndex ?? 0);
        setTotalQuestions(payload.totalQuestions ?? 0);
        if (payload.settings) setSettings(payload.settings);
        if (payload.currentQuestion) setCurrentChar(payload.currentQuestion);
      }
    };

    const onExpired = () => {
      clearSession();
      navigate('/');
    };

    socket.on('players_updated', onPlayers);
    socket.on('game_started', onStarted);
    socket.on('question_answer', onAnswer);
    socket.on('question_changed', onChanged);
    socket.on('correct_answer', onCorrect);
    socket.on('game_end', onEnd);
    socket.on('session_restored', onRestored);
    socket.on('session_expired', onExpired);

    return () => {
      socket.off('connect', doReconnect);
      socket.off('players_updated', onPlayers);
      socket.off('game_started', onStarted);
      socket.off('question_answer', onAnswer);
      socket.off('question_changed', onChanged);
      socket.off('correct_answer', onCorrect);
      socket.off('game_end', onEnd);
      socket.off('session_restored', onRestored);
      socket.off('session_expired', onExpired);
    };
  }, [roomId, navigate]);

  const startGame = () => socket.emit('start_game', { roomId, settings });
  const nextQuestion = () => socket.emit('next_question', { roomId });
  const judgeWrong = () => socket.emit('judge_wrong', { roomId });
  const judgeCorrect = (playerId: string) => {
    socket.emit('judge_correct', { roomId, playerId });
    setShowJudgeModal(false);
  };

  /* ── LOBBY ── */
  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">

          <div className="card text-center py-6">
            <p className="section-label mb-2">ルームコード</p>
            <span className="font-mono text-5xl font-bold tracking-widest text-blue-400">
              {roomId}
            </span>
            <p className="text-gray-500 text-xs mt-2">このコードを回答者に伝えてください</p>
          </div>

          <div className="card">
            <p className="section-label mb-2">参加者 {players.length > 0 && `(${players.length}人)`}</p>
            {players.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">参加者を待っています...</p>
            ) : (
              <ul className="space-y-1">
                {players.map(p => (
                  <li key={p.id} className="text-sm text-gray-200 py-1 border-b border-gray-700 last:border-0">
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card space-y-3">
            <p className="section-label">ゲーム設定</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">問題数</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={settings.totalQuestions}
                  onChange={e => setSettings(s => ({ ...s, totalQuestions: Math.max(1, Math.min(600, +e.target.value || 1)) }))}
                  className="input-field py-2 w-full"
                />
                <div className="flex gap-1 flex-wrap">
                  {[5, 10, 20, 50].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, totalQuestions: n }))}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        settings.totalQuestions === n
                          ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                          : 'border-gray-600 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">制限時間</label>
                <select
                  value={settings.timeLimit}
                  onChange={e => setSettings(s => ({ ...s, timeLimit: +e.target.value }))}
                  className="input-field py-2"
                >
                  <option value={0} className="bg-gray-800">なし</option>
                  <option value={15} className="bg-gray-800">15秒</option>
                  <option value={30} className="bg-gray-800">30秒</option>
                  <option value={60} className="bg-gray-800">60秒</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">難易度</label>
                <select
                  value={settings.difficulty}
                  onChange={e => setSettings(s => ({ ...s, difficulty: e.target.value as GameSettings['difficulty'] }))}
                  className="input-field py-2"
                >
                  <option value="all" className="bg-gray-800">すべて</option>
                  <option value="easy" className="bg-gray-800">簡単</option>
                  <option value="hard" className="bg-gray-800">難しい</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            disabled={players.length === 0}
            className="btn btn-primary btn-lg w-full"
          >
            ゲームを開始する
          </button>
          {players.length === 0 && (
            <p className="text-gray-500 text-xs text-center">
              回答者が1人以上参加するとスタートできます
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── PLAYING ── */
  const judgeButtons = (size: 'sm' | 'lg') => (
    <>
      <button
        onClick={() => setShowJudgeModal(true)}
        className={`btn btn-success flex-col gap-0.5 ${size === 'lg' ? 'h-14 flex-1' : 'py-4 h-auto gap-1'}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-lg'}>○</span>
        <span className="text-xs">正解</span>
      </button>
      <button
        onClick={judgeWrong}
        className={`btn btn-danger flex-col gap-0.5 ${size === 'lg' ? 'h-14 flex-1' : 'py-4 h-auto gap-1'}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-lg'}>✕</span>
        <span className="text-xs">不正解</span>
      </button>
      <button
        onClick={nextQuestion}
        className={`btn btn-secondary flex-col gap-0.5 ${size === 'lg' ? 'h-14 flex-1' : 'py-4 h-auto gap-1'}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-lg'}>→</span>
        <span className="text-xs">次の問題</span>
      </button>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <span className="font-mono text-blue-400 font-semibold text-sm">{roomId}</span>
        <span className="text-gray-400 text-sm">
          問題 {currentIndex + 1} / {totalQuestions}
        </span>
      </header>

      {/* ── MOBILE LAYOUT (< lg) ── */}
      <div className="flex-1 flex flex-col lg:hidden overflow-y-auto">
        {/* Image */}
        <div className="h-[42vh] flex-shrink-0 bg-gray-950">
          <CharacterImage
            imageUrl={currentChar?.imageUrl ?? ''}
            characterName={currentChar?.name ?? '?'}
            className="w-full h-full"
          />
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-800 border-b border-gray-700 flex-shrink-0">
          {(['answer', 'score'] as MobileTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'answer' ? '正解情報' : 'スコア'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 p-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          {mobileTab === 'answer'
            ? <AnswerPanel character={currentChar} />
            : <ScoreBoard players={players} scores={scores} highlightPlayerId={flashPlayerId ?? undefined} />
          }
        </div>
      </div>

      {/* Mobile fixed bottom judge buttons */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex gap-2 px-3 pt-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
      >
        {judgeButtons('lg')}
      </div>

      {/* ── DESKTOP LAYOUT (>= lg) ── */}
      <div className="hidden lg:flex flex-1 gap-4 p-4 min-h-0">
        {/* Image */}
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-gray-950">
          <CharacterImage
            imageUrl={currentChar?.imageUrl ?? ''}
            characterName={currentChar?.name ?? '?'}
            className="w-full h-full"
          />
        </div>

        {/* Right panel */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          <AnswerPanel character={currentChar} />
          <div className="card space-y-2">
            <p className="section-label">判定</p>
            <div className="grid grid-cols-3 gap-2">
              {judgeButtons('sm')}
            </div>
          </div>
          <ScoreBoard players={players} scores={scores} highlightPlayerId={flashPlayerId ?? undefined} />
        </div>
      </div>

      {showJudgeModal && (
        <JudgeModal
          players={players}
          onSelect={judgeCorrect}
          onCancel={() => setShowJudgeModal(false)}
        />
      )}
    </div>
  );
}
