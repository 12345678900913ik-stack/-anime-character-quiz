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
}

export interface GameSettings {
  totalQuestions: number;
  timeLimit: number;
  difficulty: 'all' | 'easy' | 'hard';
}

export interface ResultPageState {
  scores: Record<string, number>;
  players: Player[];
  roomId: string;
  isQuizmaster: boolean;
  quizmasterId?: string;
  myPlayerId?: string;
  myPlayerName?: string;
}
