import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as rm from './roomManager';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  connectionStateRecovery: {
    // Brief disconnects (network hiccup, iOS background): replay missed events automatically
    maxDisconnectionDuration: 60 * 1000,
    skipMiddlewares: true,
  },
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Grace period before removing a disconnected player/quizmaster
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelDisconnectTimer(socketId: string) {
  const t = disconnectTimers.get(socketId);
  if (t) { clearTimeout(t); disconnectTimers.delete(socketId); }
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} (recovered=${socket.recovered})`);

  socket.on('create_room', () => {
    const room = rm.createRoom(socket.id);
    socket.join(room.id);
    socket.emit('room_created', { roomId: room.id });
    console.log(`Room ${room.id} created`);
  });

  socket.on('join_room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const player = rm.addPlayer(roomCode, socket.id, playerName);
    const room = rm.getRoom(roomCode);
    if (!player || !room) {
      socket.emit('join_error', { message: 'ルームが見つかりません。コードを確認してください。' });
      return;
    }
    socket.join(room.id);
    socket.emit('joined_room', { room: rm.getPublicState(room), playerId: player.id });
    io.to(room.id).emit('players_updated', { players: room.players });
    console.log(`${playerName} joined ${room.id}`);
  });

  socket.on('start_game', ({ roomId, settings }: { roomId: string; settings: rm.GameSettings }) => {
    const room = rm.getRoom(roomId);
    if (!room || room.quizmaster !== socket.id) return;
    const started = rm.startGame(roomId, settings);
    if (!started) return;
    const q = rm.getCurrentQuestion(roomId);
    io.to(roomId).emit('game_started', { settings, totalQuestions: started.questions.length });
    io.to(roomId).emit('question_changed', {
      index: 0,
      imageUrl: q?.imageUrl ?? '',
      totalQuestions: started.questions.length,
    });
    socket.emit('question_answer', { character: q });
  });

  socket.on('next_question', ({ roomId }: { roomId: string }) => {
    const room = rm.getRoom(roomId);
    if (!room || room.quizmaster !== socket.id) return;
    const result = rm.nextQuestion(roomId);
    if (result.gameOver) {
      io.to(roomId).emit('game_end', {
        scores: room.scores,
        players: room.players,
        questions: room.questions,
        roomId,
      });
    } else {
      io.to(roomId).emit('question_changed', {
        index: result.index,
        imageUrl: result.question?.imageUrl ?? '',
        totalQuestions: room.questions.length,
      });
      socket.emit('question_answer', { character: result.question });
    }
  });

  socket.on('judge_correct', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rm.getRoom(roomId);
    if (!room || room.quizmaster !== socket.id) return;
    rm.addScore(roomId, playerId);
    io.to(roomId).emit('correct_answer', { playerId, scores: room.scores });
  });

  socket.on('judge_wrong', ({ roomId }: { roomId: string }) => {
    const room = rm.getRoom(roomId);
    if (!room || room.quizmaster !== socket.id) return;
    io.to(roomId).emit('wrong_answer', {});
  });

  socket.on('restart_game', ({ roomId }: { roomId: string }) => {
    const room = rm.getRoom(roomId);
    if (!room || room.quizmaster !== socket.id) return;
    const restarted = rm.restartRoom(roomId);
    if (!restarted) return;
    io.to(roomId).emit('game_restarted', { roomId, players: restarted.players });
    console.log(`Room ${roomId} restarted`);
  });

  // Session recovery: called by client after page refresh or long reconnect
  socket.on('reconnect_session', ({
    roomId,
    role,
    playerId,
    playerName,
  }: {
    roomId: string;
    role: 'quizmaster' | 'player';
    playerId?: string;
    playerName?: string;
  }) => {
    const room = rm.getRoom(roomId);
    if (!room) {
      socket.emit('session_expired');
      return;
    }

    socket.join(room.id);

    const timeLeft = (room.settings.timeLimit > 0 && room.questionStartTime)
      ? Math.max(0, room.settings.timeLimit - Math.floor((Date.now() - room.questionStartTime) / 1000))
      : 0;

    if (role === 'quizmaster') {
      // Cancel any pending removal of old quizmaster socket
      cancelDisconnectTimer(room.quizmaster);
      room.quizmaster = socket.id;

      const q = rm.getCurrentQuestion(roomId);
      socket.emit('session_restored', {
        role: 'quizmaster',
        status: room.status,
        roomId: room.id,
        players: room.players,
        scores: room.scores,
        currentIndex: room.currentIndex,
        totalQuestions: room.questions.length,
        settings: room.settings,
        currentQuestion: q ?? undefined,
        timeLeft,
      });
      console.log(`Quizmaster reconnected to ${roomId}`);
    } else if (role === 'player' && playerId) {
      const player = rm.findPlayerById(roomId, playerId);
      if (!player) {
        socket.emit('session_expired');
        return;
      }
      cancelDisconnectTimer(player.socketId);
      player.socketId = socket.id;

      const q = room.status === 'playing' ? rm.getCurrentQuestion(roomId) : null;
      socket.emit('session_restored', {
        role: 'player',
        status: room.status,
        roomId: room.id,
        players: room.players,
        scores: room.scores,
        currentIndex: room.currentIndex,
        totalQuestions: room.questions.length,
        settings: room.settings,
        imageUrl: q?.imageUrl ?? '',
        playerId,
        timeLeft,
      });
      console.log(`Player ${playerName ?? playerId} reconnected to ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    // Delay removal to allow mobile/iOS reconnections within 60 seconds
    const timer = setTimeout(() => {
      rm.removePlayer(socket.id);
      disconnectTimers.delete(socket.id);
    }, 60_000);
    disconnectTimers.set(socket.id, timer);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\u{1F3AE} Server: http://localhost:${PORT}`);
});
