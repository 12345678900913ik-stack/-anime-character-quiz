import charactersData from './data/characters.json';

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

export interface Player {
  id: string;
  name: string;
  socketId: string;
}

export interface GameSettings {
  totalQuestions: number;
  timeLimit: number;
  difficulty: 'all' | 'easy' | 'hard';
}

export interface Room {
  id: string;
  quizmaster: string;
  players: Player[];
  questions: Character[];
  currentIndex: number;
  scores: Record<string, number>;
  status: 'waiting' | 'playing' | 'result';
  settings: GameSettings;
  questionStartTime?: number;
}

const rooms = new Map<string, Room>();
const characters = charactersData as Character[];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createRoom(quizmasterSocketId: string): Room {
  const id = generateRoomCode();
  const room: Room = {
    id,
    quizmaster: quizmasterSocketId,
    players: [],
    questions: [],
    currentIndex: -1,
    scores: {},
    status: 'waiting',
    settings: { totalQuestions: 10, timeLimit: 30, difficulty: 'all' },
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function addPlayer(roomId: string, socketId: string, name: string): Player | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room || room.status !== 'waiting') return null;
  const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const player: Player = { id: playerId, name, socketId };
  room.players.push(player);
  room.scores[playerId] = 0;
  return player;
}

export function removePlayer(socketId: string): void {
  for (const room of rooms.values()) {
    room.players = room.players.filter(p => p.socketId !== socketId);
  }
}

export function startGame(roomId: string, settings: GameSettings): Room | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;
  room.settings = settings;
  const filtered = characters.filter(c => {
    if (settings.difficulty === 'easy') return c.difficulty === 1;
    if (settings.difficulty === 'hard') return c.difficulty >= 2;
    return true;
  });
  const shuffled = shuffle(filtered);
  room.questions = shuffled.slice(0, Math.min(settings.totalQuestions, shuffled.length));
  room.currentIndex = 0;
  room.status = 'playing';
  room.questionStartTime = Date.now();
  return room;
}

export function nextQuestion(roomId: string): { gameOver: boolean; index: number; question?: Character } {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return { gameOver: true, index: -1 };
  room.currentIndex++;
  if (room.currentIndex >= room.questions.length) {
    room.status = 'result';
    return { gameOver: true, index: room.currentIndex };
  }
  room.questionStartTime = Date.now();
  return { gameOver: false, index: room.currentIndex, question: room.questions[room.currentIndex] };
}

export function getCurrentQuestion(roomId: string): Character | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room || room.currentIndex < 0 || room.currentIndex >= room.questions.length) return null;
  return room.questions[room.currentIndex];
}

export function addScore(roomId: string, playerId: string): void {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return;
  room.scores[playerId] = (room.scores[playerId] || 0) + 1;
}

export function findPlayerById(roomId: string, playerId: string): Player | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;
  return room.players.find(p => p.id === playerId) ?? null;
}

export function restartRoom(roomId: string): Room | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;
  for (const playerId of Object.keys(room.scores)) {
    room.scores[playerId] = 0;
  }
  room.questions = [];
  room.currentIndex = -1;
  room.status = 'waiting';
  return room;
}

export function getPublicState(room: Room) {
  return {
    id: room.id,
    players: room.players,
    status: room.status,
    settings: room.settings,
    currentIndex: room.currentIndex,
    scores: room.scores,
    totalQuestions: room.questions.length,
  };
}
