const KEY = 'anime_quiz_session';

export interface SessionData {
  roomId: string;
  role: 'quizmaster' | 'player';
  quizmasterId?: string;
  playerId?: string;
  playerName?: string;
}

export function saveSession(data: SessionData): void {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function getSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
