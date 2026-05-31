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

export interface RoomState {
  id: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'result';
  settings: GameSettings;
  currentIndex: number;
  scores: Record<string, number>;
  totalQuestions: number;
}

export interface GameEndData {
  scores: Record<string, number>;
  players: Player[];
  questions: Character[];
  roomId: string;
}

export interface ResultPageState extends GameEndData {
  isQuizmaster: boolean;
  myPlayerId?: string;
  myPlayerName?: string;
}
