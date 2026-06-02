import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { onRoomChange, toPlayerArray, toQuestionArray, RoomData } from '../lib/roomService';
import { getSession } from '../hooks/session';
import { ResultPageState } from '../types';
import CharacterImage from '../components/CharacterImage';
import ResultOverlay from '../components/ResultOverlay';

type GameStatus = 'waiting' | 'playing';
type JudgeResult = 'correct' | 'wrong' | null;

export default function PlayerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { playerName: string; playerId: string } | null;

  const session = getSession();
  const playerName = locState?.playerName ?? session?.playerName ?? '回答者';
  const myPlayerId = locState?.playerId ?? session?.playerId ?? '';

  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [imageUrl, setImageUrl] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [judgeResult, setJudgeResult] = useState<JudgeResult>(null);
  const [correctPlayerName, setCorrectPlayerName] = useState('');

  const gameStatusRef = useRef<GameStatus>('waiting');
  const timeLimitRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTimestampRef = useRef(0);
  const prevIndexRef = useRef(-1);

  const startTimer = useCallback((limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (limit <= 0) return;
    setTimeLeft(limit);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onRoomChange(roomId, (room: RoomData | null) => {
      if (!room) { navigate('/'); return; }

      if (room.status === 'result') {
        if (timerRef.current) clearInterval(timerRef.current);
        const ps = toPlayerArray(room.players);
        const qs = toQuestionArray(room.questions);
        const state: ResultPageState = {
          scores: room.scores ?? {},
          players: ps,
          roomId: roomId!,
          isQuizmaster: false,
          myPlayerId,
          myPlayerName: playerName,
        };
        navigate('/result', { state });
        return;
      }

      if (room.status === 'waiting') {
        if (timerRef.current) clearInterval(timerRef.current);
        prevIndexRef.current = -1;
        lastEventTimestampRef.current = 0;
        gameStatusRef.current = 'waiting';
        setJudgeResult(null);
        setGameStatus('waiting');
      }

      if (room.status === 'playing') {
        if (gameStatusRef.current !== 'playing') {
          gameStatusRef.current = 'playing';
          setGameStatus('playing');
          const lim = room.settings?.timeLimit ?? 0;
          setTimeLimit(lim);
          timeLimitRef.current = lim;
        }

        setTotalQuestions(toQuestionArray(room.questions).length);
        setImageUrl(room.currentImageUrl ?? '');
        setMyScore((room.scores ?? {})[myPlayerId] ?? 0);

        // New question
        if (room.currentIndex !== prevIndexRef.current) {
          prevIndexRef.current = room.currentIndex;
          setCurrentIndex(room.currentIndex);
          setJudgeResult(null);
          startTimer(timeLimitRef.current);
        }

        // Judge events
        const ev = room.lastEvent;
        if (ev && ev.timestamp > lastEventTimestampRef.current) {
          lastEventTimestampRef.current = ev.timestamp;
          if (ev.type === 'correct') {
            const ps = toPlayerArray(room.players);
            const winner = ps.find(p => p.id === ev.playerId);
            setCorrectPlayerName(winner?.name ?? '');
            setJudgeResult('correct');
            if (timerRef.current) clearInterval(timerRef.current);
            setMyScore((room.scores ?? {})[myPlayerId] ?? 0);
          } else if (ev.type === 'wrong') {
            setJudgeResult('wrong');
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId, navigate, myPlayerId, playerName, startTimer]);

  const handleDismiss = useCallback(() => setJudgeResult(null), []);

  /* ── WAITING ── */
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-xs w-full py-10 space-y-5">
          <div>
            <p className="text-gray-400 text-sm">参加者</p>
            <p className="text-xl font-semibold text-gray-100 mt-0.5">{playerName}</p>
          </div>
          <div>
            <p className="section-label mb-1">ルームコード</p>
            <span className="font-mono text-4xl font-bold tracking-widest text-blue-400">
              {roomId}
            </span>
          </div>
          <p className="text-gray-500 text-sm">出題者がゲームを開始するまでお待ちください</p>
        </div>
      </div>
    );
  }

  /* ── PLAYING ── */
  const timePct = timeLimit > 0 ? timeLeft / timeLimit : 1;
  const timerColor =
    timeLeft <= 5 ? 'text-red-400' :
    timeLeft <= 10 ? 'text-yellow-400' : 'text-gray-200';

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-gray-950 select-none">
      <header
        className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 z-10 flex-shrink-0"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 10px))' }}
      >
        <span className="text-gray-400 text-sm tabular-nums">
          問題 {currentIndex + 1} / {totalQuestions}
        </span>
        {timeLimit > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timePct > 0.5 ? 'bg-green-500' :
                  timePct > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${timePct * 100}%` }}
              />
            </div>
            <span className={`font-mono text-sm font-semibold tabular-nums ${timerColor}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 relative overflow-hidden bg-gray-950">
        <CharacterImage imageUrl={imageUrl} className="absolute inset-0 w-full h-full" />
      </div>

      <footer
        className="flex items-center justify-between px-4 py-3 bg-gray-900 border-t border-gray-800 z-10 flex-shrink-0"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <span className="text-gray-300 text-sm font-medium truncate max-w-[55%]">{playerName}</span>
        <span className="text-gray-100 font-bold text-lg tabular-nums">
          {myScore} <span className="text-gray-500 font-normal text-xs">点</span>
        </span>
      </footer>

      <ResultOverlay type={judgeResult} correctPlayerName={correctPlayerName} onDismiss={handleDismiss} />
    </div>
  );
}
