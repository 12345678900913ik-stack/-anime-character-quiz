import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  // Try WebSocket first, fall back to polling (important for some corporate networks/iOS)
  transports: ['websocket', 'polling'],
});

// Re-connect when tab regains focus (iOS Safari kills WS in background)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !socket.connected) {
    socket.connect();
  }
});

// Re-connect on bfcache restore (iOS Safari back/forward navigation)
window.addEventListener('pageshow', (e) => {
  if (e.persisted && !socket.connected) {
    socket.connect();
  }
});

export default socket;
