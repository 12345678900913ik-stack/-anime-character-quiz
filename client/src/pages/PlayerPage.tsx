import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import socket from '../hooks/useSocket';
import { getSession, clearSession } from '../hooks/session';
import { Player, GameEndData } from '../types';
import CharacterImage from '../components/CharacterImage';
import ResultOverlay from '../components/ResultOverlay';

type GameStatus = 'waiting' | 'playing';
type JudgeResult = 'correct' | 'wrong' | null;

export default function PlayerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { playerName: string; playerId: string; initialPlayers?: Player[] } | null;

  // Fall back to session storage for page refresh recovery
  const storedSession = getSession();
  const playerName = state?.playerName ?? storedSession?.playerName ?? '回答者';
  const myPlayerId = state?.playerId ?? storedSession?.playerId ?? '';

  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [imageUrl, setImageUrl] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [judgeResult, setJudgeResult] = useState<JudgeResult>(null);
  const [correctPlayerName, setCorrectPlayerName] = useState('');
  const [players, setPlayers] = useState<Player[]>(state?.initialPlayers ?? []);

  const playersRef = useRef<Player[]>(players);
  const timeLimitRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myPlayerIdRef = useRef(myPlayerId);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { timeLimitRef.current = timeLimit; }, [timeLimit]);

  const startTimer = useCallback((limit: number, startFrom?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const initial = startFrom ?? limit;
    if (limit === 0 || initial <= 0) return;
    setTimeLeft(initial);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    // Session recovery: called on mount (if already connected) and on every reconnect
    const doReconnect = () => {
      if ((socket as any).recovered) return; // socket.io already replayed missed events
      const session = getSession();
      if (session?.roomId === roomId && session.role === 'player') {
        socket.emit('reconnect_session', session);
      }
    };
    socket.on('connect', doReconnect);
    if (socket.connected) doReconnect();

    const onPlayers = ({ players: ps }: { players: Player[] }) => setPlayers(ps);
    const onStarted = ({ settings, totalQuestions: total }: any) => {
      setTimeLimit(settings.timeLimit);
      timeLimitRef.current = settings.timeLimit;
      setTotalQuestions(total);
      setMyScore(0);
      setGameStatus('playing');
    };
    const onChanged = ({ index, imageUrl: url, totalQuestions: total }: any) => {
      setImageUrl(url ?? '');
      setCurrentIndex(index);
      setTotalQuestions(total);
      setJudgeResult(null);
      startTimer(timeLimitRef.current);
    };
    const onCorrect = ({ playerId, scores }: { playerId: string; scores: Record<string, number> }) => {
      const winner = playersRef.current.find(p => p.id === playerId);
      setCorrectPlayerName(winner?.name ?? '');
      setJudgeResult('correct');
      if (timerRef.current) clearInterval(timerRef.current);
      if (scores[myPlayerIdRef.current] !== undefined) setMyScore(scores[myPlayerIdRef.current]);
    };
    const onWrong = () => {
      setJudgeResult('wrong');
      if (timerRef.current) clearInterval(timerRef.current);
    };
    const onEnd = (data: GameEndData) => {
      if (timerRef.current) clearInterval(timerRef.current);
      navigate('/result', {
        state: {
          ...data,
          isQuizmaster: false,
          myPlayerId: myPlayerIdRef.current,
          myPlayerName: playerName,
        },
      });
    };

    const onRestored = (payload: any) => {
      if (payload.role !== 'player') return;
      if (payload.status === 'result') {
        clearSession();
        navigate('/');
        return;
      }
      setPlayers(payload.players ?? []);
      if (payload.scores?.[myPlayerIdRef.current] !== undefined) {
        setMyScore(payload.scores[myPlayerIdRef.current]);
      }
      if (payload.status === 'playing') {
        setGameStatus('playing');
        setCurrentIndex(payload.currentIndex ?? 0);
        setTotalQuestions(payload.totalQuestions ?? 0);
        setImageUrl(payload.imageUrl ?? '');
        setJudgeResult(null);
        if (payload.settings) {
          const lim = payload.settings.timeLimit;
          setTimeLimit(lim);
          timeLimitRef.current = lim;
          if (lim > 0 && payload.timeLeft > 0) {
            startTimer(lim, payload.timeLeft);
          }
        }
      }
    };

    const onExpired = () => {
      clearSession();
      navigate('/');
    };

    socket.on('players_updated', onPlayers);
    socket.on('game_started', onStarted);
    socket.on('question_changed', onChanged);
    socket.on('correct_answer', onCorrect);
    socket.on('wrong_answer', onWrong);
    socket.on('game_end', onEnd);
    socket.on('session_restored', onRestored);
    socket.on('session_expired', onExpired);

    return () => {
      socket.off('connect', doReconnect);
      socket.off('players_updated', onPlayers);
      socket.off('game_started', onStarted);
      socket.off('question_changed', onChanged);
      socket.off('correct_answer', onCorrect);
      socket.off('wrong_answer', onWrong);
      socket.off('game_end', onEnd);
      socket.off('session_restored', onRestored);
      socket.off('session_expired', onExpired);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId, navigate, playerName, startTimer]);

  const handleDismiss = useCallback(() => setJudgeResult(null), []);

  /* ── WAITING ── */
  if (gameStatus === 'waiting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          paddingTop: 'env(safe-area-inset-top, 16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
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
    <div className="min-h-screen flex flex-col bg-gray-950 select-none">
      {/* Header */}
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

      {/* Character image */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-gray-950">
        <div className="relative w-full h-full">
          <CharacterImage
            imageUrl={imageUrl}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>

      {/* Footer */}
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
