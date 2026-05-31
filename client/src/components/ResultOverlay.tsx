import { useEffect, useState, useRef } from 'react';

interface Props {
  type: 'correct' | 'wrong' | null;
  correctPlayerName?: string;
  onDismiss: () => void;
}

const CONFETTI_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#a78bfa'];

function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i / 30) * 100 + (Math.random() - 0.5) * 8}%`,
    delay: `${Math.random() * 0.5}s`,
    duration: `${0.9 + Math.random() * 0.7}s`,
    size: `${6 + Math.random() * 6}px`,
  }));
  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: '-5%',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </>
  );
}

export default function ResultOverlay({ type, correctPlayerName, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!type) return;
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => dismissRef.current(), 300);
    }, 2200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [type]);

  if (!type || !visible) return null;

  const isCorrect = type === 'correct';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50
        transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}
        ${isCorrect ? 'bg-green-950/90' : 'bg-red-950/90'}`}
    >
      {isCorrect && <Confetti />}
      <div className={`text-center z-10 ${isCorrect ? 'animate-correct-pop' : 'animate-wrong-shake'}`}>
        <div
          className="font-bold leading-none mb-3"
          style={{ fontSize: 'clamp(5rem, 22vmin, 10rem)' }}
        >
          {isCorrect ? '○' : '✕'}
        </div>
        {isCorrect && (
          <p className="text-white font-semibold" style={{ fontSize: 'clamp(1rem, 4vmin, 1.8rem)' }}>
            {correctPlayerName ? (
              <><span className="text-yellow-300">{correctPlayerName}</span> の正解！</>
            ) : '正解！'}
          </p>
        )}
        {!isCorrect && (
          <p className="text-white/70 text-xl font-medium">不正解</p>
        )}
      </div>
    </div>
  );
}
