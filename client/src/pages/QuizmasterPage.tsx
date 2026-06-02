import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  onRoomChange,
  startGame,
  nextQuestion,
  judgeCorrect,
  judgeWrong,
  toPlayerArray,
  toQuestionArray,
  RoomData,
  Character,
  FirebasePlayer,
} from '../lib/roomService';
import { getSession } from '../hooks/session';
import { GameSettings, ResultPageState } from '../types';
import CharacterImage from '../components/CharacterImage';
import ScoreBoard from '../components/ScoreBoard';
import AnswerPanel from '../components/AnswerPanel';
import AnimeFilterPanel, { loadExcludedAnime } from '../components/AnimeFilterPanel';

type Status = 'waiting' | 'playing';
type MobileTab = 'answer' | 'score';

function JudgeModal({ players, onSelect, onCancel }: {
  players: FirebasePlayer[];
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

  const session = getSession();
  const quizmasterId = session?.quizmasterId ?? '';

  const [status, setStatus] = useState<Status>('waiting');
  const [players, setPlayers] = useState<FirebasePlayer[]>([]);
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
    excludedAnime: loadExcludedAnime(),
  });

  const prevStatusRef = useRef<string>('waiting');
  const questionsRef = useRef<Character[]>([]);
  const prevIndexRef = useRef<number>(-1);
  const lastEventTsRef = useRef<number>(0);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onRoomChange(roomId, (room: RoomData | null) => {
      if (!room) { navigate('/'); return; }

      const ps = toPlayerArray(room.players);
      const qs = toQuestionArray(room.questions);
      questionsRef.current = qs;

      setPlayers(ps);
      setScores(room.scores ?? {});

      if (room.status === 'result') {
        const state: ResultPageState = {
          scores: room.scores ?? {},
          players: ps,
          roomId: roomId!,
          isQuizmaster: true,
          quizmasterId,
        };
        navigate('/result', { state });
        return;
      }

      if (room.status === 'playing') {
        if (prevStatusRef.current !== 'playing') setStatus('playing');
        setCurrentIndex(room.currentIndex);
        setTotalQuestions(qs.length);
        setCurrentChar(qs[room.currentIndex] ?? null);
        // Reset to the answer tab only when a new question actually starts,
        // so we don't override the quizmaster's manual tab choice on every update.
        if (room.currentIndex !== prevIndexRef.current) {
          prevIndexRef.current = room.currentIndex;
          setMobileTab('answer');
        }
      }

      if (room.status === 'waiting') {
        setStatus('waiting');
        prevIndexRef.current = -1;
      }

      // Flash correct player — only react to genuinely new events.
      const ev = room.lastEvent;
      if (ev && ev.timestamp > lastEventTsRef.current) {
        lastEventTsRef.current = ev.timestamp;
        if (ev.type === 'correct' && ev.playerId) {
          setFlashPlayerId(ev.playerId);
          setMobileTab('score');
          setTimeout(() => setFlashPlayerId(null), 2000);
        }
      }

      prevStatusRef.current = room.status;
    });
    return unsub;
  }, [roomId, navigate, quizmasterId]);

  const handleStartGame = async () => {
    const ok = await startGame(roomId!, quizmasterId, settings);
    if (!ok) alert('ゲームを開始できませんでした。ページを更新して再試行してください。');
  };
  const handleNextQuestion = () => nextQuestion(roomId!, quizmasterId);
  const handleJudgeWrong = () => judgeWrong(roomId!, quizmasterId);
  const handleReset = () => {
    if (window.confirm('ゲームをリセットしてロビーに戻りますか？\nスコアがリセットされます。')) {
      import('../lib/roomService').then(m => m.restartGame(roomId!, quizmasterId));
    }
  };
  const handleJudgeCorrect = (playerId: string) => {
    judgeCorrect(roomId!, quizmasterId, playerId);
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

          <AnimeFilterPanel
            excludedAnime={settings.excludedAnime}
            onChange={excluded => setSettings(s => ({ ...s, excludedAnime: excluded }))}
          />

          <button
            onClick={handleStartGame}
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
        onClick={handleJudgeWrong}
        className={`btn btn-danger flex-col gap-0.5 ${size === 'lg' ? 'h-14 flex-1' : 'py-4 h-auto gap-1'}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-lg'}>✕</span>
        <span className="text-xs">不正解</span>
      </button>
      <button
        onClick={handleNextQuestion}
        className={`btn btn-secondary flex-col gap-0.5 ${size === 'lg' ? 'h-14 flex-1' : 'py-4 h-auto gap-1'}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-lg'}>→</span>
        <span className="text-xs">次の問題</span>
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-gray-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <span className="font-mono text-blue-400 font-semibold text-sm">{roomId}</span>
        <span className="text-gray-400 text-sm">
          問題 {currentIndex + 1} / {totalQuestions}
        </span>
        <button
          onClick={handleReset}
          className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-2 py-1 rounded transition-colors"
        >
          リセット
        </button>
      </header>

      {/* MOBILE */}
      <div className="flex-1 flex flex-col lg:hidden overflow-y-auto">
        <div className="h-[42vh] flex-shrink-0 bg-gray-950">
          <CharacterImage
            imageUrl={currentChar?.imageUrl ?? ''}
            characterName={currentChar?.name ?? '?'}
            className="w-full h-full"
          />
        </div>
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
        <div className="flex-1 p-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          {mobileTab === 'answer'
            ? <AnswerPanel character={currentChar} />
            : <ScoreBoard players={players} scores={scores} highlightPlayerId={flashPlayerId ?? undefined} />
          }
        </div>
      </div>

      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex gap-2 px-3 pt-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
      >
        {judgeButtons('lg')}
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:flex flex-1 gap-4 p-4 min-h-0">
        <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-gray-950">
          <CharacterImage
            imageUrl={currentChar?.imageUrl ?? ''}
            characterName={currentChar?.name ?? '?'}
            className="absolute inset-0 w-full h-full"
          />
        </div>
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
          onSelect={handleJudgeCorrect}
          onCancel={() => setShowJudgeModal(false)}
        />
      )}
    </div>
  );
}
