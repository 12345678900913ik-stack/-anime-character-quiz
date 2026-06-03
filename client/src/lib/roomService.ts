import { db } from '../firebase';
import { ref, set, get, update, onValue, DataSnapshot } from 'firebase/database';
import { GameSettings } from '../types';
import charactersData from '../data/characters.json';

export interface Character {
  id: string;
  name: string;
  nameEn?: string;
  anime: string;
  imageUrl: string;
  difficulty: 1 | 2 | 3;
  tags: string[];
  memo?: string;
}

export interface FirebasePlayer {
  id: string;
  name: string;
}

export interface LastEvent {
  type: 'none' | 'correct' | 'wrong' | 'restarted';
  playerId?: string;
  timestamp: number;
}

export interface RoomData {
  status: 'waiting' | 'playing' | 'result';
  quizmasterId: string;
  settings: GameSettings;
  players: Record<string, FirebasePlayer> | null;
  scores: Record<string, number> | null;
  questions: Record<string, Character> | Character[] | null;
  currentIndex: number;
  currentImageUrl: string;
  questionStartTime: number;
  lastEvent: LastEvent;
  buzzes?: Record<string, number | null> | null;
  createdAt: number;
}

const characters = charactersData as Character[];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function toPlayerArray(players: RoomData['players']): FirebasePlayer[] {
  if (!players) return [];
  return Object.values(players);
}

export function toQuestionArray(questions: RoomData['questions']): Character[] {
  if (!questions) return [];
  if (Array.isArray(questions)) return questions;
  return Object.values(questions);
}

export async function createRoom(): Promise<{ roomId: string; quizmasterId: string }> {
  let roomId = generateRoomCode();
  while ((await get(ref(db, `rooms/${roomId}`))).exists()) {
    roomId = generateRoomCode();
  }
  const quizmasterId = `qm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  await set(ref(db, `rooms/${roomId}`), {
    status: 'waiting',
    quizmasterId,
    settings: { totalQuestions: 10, timeLimit: 30, difficulty: 'all', excludedAnime: [] },
    players: { _placeholder: null },
    scores: { _placeholder: null },
    questions: { _placeholder: null },
    currentIndex: -1,
    currentImageUrl: '',
    questionStartTime: 0,
    lastEvent: { type: 'none', timestamp: 0 },
    createdAt: Date.now(),
  });

  return { roomId, quizmasterId };
}

export async function joinRoom(
  roomId: string,
  playerName: string,
): Promise<{ playerId: string } | { error: string }> {
  const snapshot = await get(ref(db, `rooms/${roomId.toUpperCase()}`));
  if (!snapshot.exists()) return { error: 'ルームが見つかりません。コードを確認してください。' };
  const room = snapshot.val() as RoomData;
  if (room.status !== 'waiting') return { error: 'ゲームはすでに開始されています。' };

  const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  await update(ref(db, `rooms/${roomId.toUpperCase()}`), {
    [`players/${playerId}`]: { id: playerId, name: playerName },
    [`scores/${playerId}`]: 0,
  });

  return { playerId };
}

export async function startGame(
  roomId: string,
  quizmasterId: string,
  settings: GameSettings,
): Promise<boolean> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return false;
  const room = snapshot.val() as RoomData;
  if (room.quizmasterId !== quizmasterId) return false;

  const excluded = new Set(settings.excludedAnime ?? []);
  const filtered = characters.filter((c) => {
    if (excluded.has(c.anime)) return false;
    if (settings.difficulty === 'easy') return c.difficulty === 1;
    if (settings.difficulty === 'hard') return c.difficulty >= 2;
    return true;
  });
  const shuffled = shuffle(filtered).slice(0, Math.min(settings.totalQuestions, filtered.length));

  await update(ref(db, `rooms/${roomId}`), {
    status: 'playing',
    settings,
    questions: shuffled,
    currentIndex: 0,
    currentImageUrl: shuffled[0]?.imageUrl ?? '',
    questionStartTime: Date.now(),
    lastEvent: { type: 'none', timestamp: Date.now() },
    buzzes: { _placeholder: null },
  });

  return true;
}

export async function nextQuestion(roomId: string, quizmasterId: string): Promise<void> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomData;
  if (room.quizmasterId !== quizmasterId) return;

  const qs = toQuestionArray(room.questions);
  const nextIndex = room.currentIndex + 1;

  if (nextIndex >= qs.length) {
    await update(ref(db, `rooms/${roomId}`), {
      status: 'result',
      lastEvent: { type: 'none', timestamp: Date.now() },
    });
  } else {
    await update(ref(db, `rooms/${roomId}`), {
      currentIndex: nextIndex,
      currentImageUrl: qs[nextIndex].imageUrl,
      questionStartTime: Date.now(),
      lastEvent: { type: 'none', timestamp: Date.now() },
      buzzes: { _placeholder: null },
    });
  }
}

export async function judgeCorrect(
  roomId: string,
  quizmasterId: string,
  playerId: string,
): Promise<void> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomData;
  if (room.quizmasterId !== quizmasterId) return;

  const newScore = ((room.scores ?? {})[playerId] ?? 0) + 1;
  await update(ref(db, `rooms/${roomId}`), {
    [`scores/${playerId}`]: newScore,
    lastEvent: { type: 'correct', playerId, timestamp: Date.now() },
  });
}

export async function judgeWrong(roomId: string, quizmasterId: string): Promise<void> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomData;
  if (room.quizmasterId !== quizmasterId) return;

  await update(ref(db, `rooms/${roomId}`), {
    lastEvent: { type: 'wrong', timestamp: Date.now() },
  });
}

export async function restartGame(roomId: string, quizmasterId: string): Promise<void> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomData;
  if (room.quizmasterId !== quizmasterId) return;

  const resetScores: Record<string, number | null> = { _placeholder: null };
  for (const pid of Object.keys(room.scores ?? {})) {
    if (pid !== '_placeholder') resetScores[pid] = 0;
  }

  await update(ref(db, `rooms/${roomId}`), {
    status: 'waiting',
    questions: { _placeholder: null },
    currentIndex: -1,
    currentImageUrl: '',
    questionStartTime: 0,
    scores: resetScores,
    lastEvent: { type: 'restarted', timestamp: Date.now() },
  });
}

export async function buzz(roomId: string, playerId: string): Promise<void> {
  await set(ref(db, `rooms/${roomId}/buzzes/${playerId}`), Date.now());
}

export async function updateExcludedAnime(roomId: string, excludedAnime: string[]): Promise<void> {
  await update(ref(db, `rooms/${roomId}`), {
    'settings/excludedAnime': excludedAnime,
  });
}

export async function clearBuzzes(roomId: string, quizmasterId: string): Promise<void> {
  const snap = await get(ref(db, `rooms/${roomId}/quizmasterId`));
  if (!snap.exists() || snap.val() !== quizmasterId) return;
  await set(ref(db, `rooms/${roomId}/buzzes`), { _placeholder: null });
}

export function onRoomChange(
  roomId: string,
  callback: (data: RoomData | null) => void,
): () => void {
  const roomRef = ref(db, `rooms/${roomId}`);
  const unsub = onValue(roomRef, (snapshot: DataSnapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as RoomData) : null);
  });
  return unsub;
}
