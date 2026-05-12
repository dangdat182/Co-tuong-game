import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  Board, Color, GameMove,
  createInitialBoard, getLegalMoves, applyMove, isInCheck, hasLegalMoves,
} from '../game/rules';
import db from '../db/database';

interface Player { socketId: string; userId: number; username: string; }
interface ChatMsg  { username: string; message: string; time: number; }

interface Room {
  id: string;
  board: Board;
  turn: Color;
  players: { red?: Player; black?: Player };
  status: 'waiting' | 'playing' | 'finished';
  winner?: Color | null;
  moveHistory: GameMove[];
  // timer
  timeControl: number;
  timeLeft: { red: number; black: number };
  lastMoveAt: number;
  startedAt: number;
  // draw
  drawOffer: Color | null;
  drawOfferAt: number;
  // rematch
  rematchOffer: Color | null;
  // spectators
  spectators: string[];
  // chat
  chat: ChatMsg[];
}

interface QueueEntry {
  socketId: string;
  userId: number;
  username: string;
  timeControl: number;
}

const rooms = new Map<string, Room>();
const matchQueue: QueueEntry[] = [];

function pub(room: Room) {
  return {
    id: room.id, board: room.board, turn: room.turn,
    players: room.players, status: room.status, winner: room.winner,
    timeControl: room.timeControl, timeLeft: room.timeLeft,
  };
}

function saveGame(room: Room, reason: string) {
  if (!room.players.red || !room.players.black) return;
  try {
    db.insertGame({
      redUserId:     room.players.red.userId,
      blackUserId:   room.players.black.userId,
      redUsername:   room.players.red.username,
      blackUsername: room.players.black.username,
      winner:        room.winner ?? null,
      reason,
      moveCount:     room.moveHistory.length,
      timeControl:   room.timeControl,
      startedAt:     new Date(room.startedAt).toISOString(),
      endedAt:       new Date().toISOString(),
    });
  } catch { /* ignore */ }
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {

    // ── Create room ────────────────────────────────────────────────────────
    socket.on('create_room', (data: { userId: number; username: string; timeControl?: number }) => {
      const roomId = uuidv4().substring(0, 6).toUpperCase();
      const tc = data.timeControl ?? 0;
      const room: Room = {
        id: roomId, board: createInitialBoard(), turn: 'red',
        players: { red: { socketId: socket.id, userId: data.userId, username: data.username } },
        status: 'waiting', moveHistory: [],
        timeControl: tc, timeLeft: { red: tc, black: tc }, lastMoveAt: 0, startedAt: 0,
        drawOffer: null, drawOfferAt: 0,
        rematchOffer: null,
        spectators: [],
        chat: [],
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_created', { roomId, color: 'red', room: pub(room) });
    });

    // ── Join room ──────────────────────────────────────────────────────────
    socket.on('join_room', (data: { roomId: string; userId: number; username: string }) => {
      const room = rooms.get(data.roomId.toUpperCase());
      if (!room)                               { socket.emit('error', { message: 'Phòng không tồn tại' }); return; }
      if (room.status !== 'waiting')           { socket.emit('error', { message: 'Phòng đã đầy' }); return; }
      if (room.players.red?.userId === data.userId) { socket.emit('error', { message: 'Không thể tự đấu với chính mình' }); return; }

      room.players.black = { socketId: socket.id, userId: data.userId, username: data.username };
      room.status  = 'playing';
      room.lastMoveAt = Date.now();
      room.startedAt  = Date.now();
      socket.join(data.roomId.toUpperCase());
      socket.emit('room_joined', { roomId: room.id, color: 'black', room: pub(room) });
      io.to(room.id).emit('game_start', pub(room));
    });

    // ── Make move ──────────────────────────────────────────────────────────
    socket.on('make_move', (data: { roomId: string; move: GameMove }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;

      const playerColor: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!playerColor || playerColor !== room.turn) {
        socket.emit('invalid_move', { message: 'Không phải lượt của bạn' }); return;
      }

      const legal = getLegalMoves(room.board, data.move.from);
      const [tr, tc2] = data.move.to;
      if (!legal.some(([r, c]) => r === tr && c === tc2)) {
        socket.emit('invalid_move', { message: 'Nước đi không hợp lệ' }); return;
      }

      // deduct time
      if (room.timeControl > 0) {
        const elapsed = (Date.now() - room.lastMoveAt) / 1000;
        room.timeLeft[playerColor] = Math.max(0, room.timeLeft[playerColor] - elapsed);
        if (room.timeLeft[playerColor] <= 0) {
          room.status = 'finished';
          room.winner = playerColor === 'red' ? 'black' : 'red';
          saveGame(room, 'timeout');
          io.to(room.id).emit('game_over', { ...pub(room), reason: 'timeout' });
          return;
        }
      }

      room.board = applyMove(room.board, data.move);
      room.moveHistory.push(data.move);
      room.drawOffer = null;
      room.turn = room.turn === 'red' ? 'black' : 'red';
      room.lastMoveAt = Date.now();

      const nextColor = room.turn;
      const inCheck   = isInCheck(room.board, nextColor);
      const noMoves   = !hasLegalMoves(room.board, nextColor);

      if (noMoves) {
        room.status = 'finished';
        room.winner = playerColor;
        const reason = inCheck ? 'checkmate' : 'stalemate';
        saveGame(room, reason);
        io.to(room.id).emit('game_over', { ...pub(room), move: data.move, reason });
      } else {
        io.to(room.id).emit('move_made', { board: room.board, move: data.move, turn: room.turn, inCheck, timeLeft: room.timeLeft });
      }
    });

    // ── Timeout (client reports) ───────────────────────────────────────────
    socket.on('timeout', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing' || room.timeControl === 0) return;
      const loser: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!loser || loser !== room.turn) return;
      room.status = 'finished';
      room.winner = loser === 'red' ? 'black' : 'red';
      saveGame(room, 'timeout');
      io.to(room.id).emit('game_over', { ...pub(room), reason: 'timeout' });
    });

    // ── Resign ─────────────────────────────────────────────────────────────
    socket.on('resign', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const loser: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!loser) return;
      room.status = 'finished';
      room.winner = loser === 'red' ? 'black' : 'red';
      saveGame(room, 'resign');
      io.to(room.id).emit('game_over', { ...pub(room), reason: 'resign' });
    });

    // ── Draw offer ─────────────────────────────────────────────────────────
    socket.on('offer_draw', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const color: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!color) return;
      if (room.drawOffer === color) return;
      const cooldown = (Date.now() - room.drawOfferAt) / 1000;
      if (room.drawOffer !== color && cooldown < 30) return;
      room.drawOffer   = color;
      room.drawOfferAt = Date.now();
      const opp = color === 'red' ? room.players.black : room.players.red;
      if (opp) io.to(opp.socketId).emit('draw_offered', { by: color });
      socket.emit('draw_offer_sent');
    });

    socket.on('respond_draw', (data: { roomId: string; accept: boolean }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      const color: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!color || room.drawOffer === color || room.drawOffer === null) return;
      if (data.accept) {
        room.status = 'finished';
        room.winner = null;
        saveGame(room, 'draw_agreed');
        io.to(room.id).emit('game_over', { ...pub(room), reason: 'draw_agreed' });
      } else {
        room.drawOffer = null;
        const offerer = color === 'red' ? room.players.black : room.players.red;
        if (offerer) io.to(offerer.socketId).emit('draw_declined');
      }
    });

    // ── Chat ───────────────────────────────────────────────────────────────
    socket.on('chat_message', (data: { roomId: string; message: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      const player =
        room.players.red?.socketId   === socket.id ? room.players.red :
        room.players.black?.socketId === socket.id ? room.players.black : null;
      if (!player) return;
      const msg = String(data.message).trim().substring(0, 120);
      if (!msg) return;
      const chatMsg: ChatMsg = { username: player.username, message: msg, time: Date.now() };
      room.chat.push(chatMsg);
      io.to(room.id).emit('chat_message', chatMsg);
    });

    // ── Rematch ────────────────────────────────────────────────────────────
    socket.on('offer_rematch', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'finished') return;
      const color: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!color || room.rematchOffer === color) return;

      const opp = color === 'red' ? room.players.black : room.players.red;
      if (!opp || !io.sockets.sockets.get(opp.socketId)) {
        socket.emit('error', { message: 'Đối thủ đã ngắt kết nối' }); return;
      }
      room.rematchOffer = color;
      io.to(opp.socketId).emit('rematch_offered', { by: color });
      socket.emit('rematch_offer_sent');
    });

    socket.on('respond_rematch', (data: { roomId: string; accept: boolean }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'finished') return;
      const color: Color | null =
        room.players.red?.socketId   === socket.id ? 'red' :
        room.players.black?.socketId === socket.id ? 'black' : null;
      if (!color || room.rematchOffer === color || room.rematchOffer === null) return;

      if (data.accept) {
        const redOk  = room.players.red  && io.sockets.sockets.get(room.players.red.socketId);
        const blkOk  = room.players.black && io.sockets.sockets.get(room.players.black.socketId);
        if (!redOk || !blkOk) {
          socket.emit('error', { message: 'Đối thủ đã ngắt kết nối, không thể đấu lại' }); return;
        }
        room.board        = createInitialBoard();
        room.turn         = 'red';
        room.status       = 'playing';
        room.winner       = null;
        room.moveHistory  = [];
        room.timeLeft     = { red: room.timeControl, black: room.timeControl };
        room.lastMoveAt   = Date.now();
        room.startedAt    = Date.now();
        room.drawOffer    = null;
        room.drawOfferAt  = 0;
        room.rematchOffer = null;
        io.to(room.id).emit('rematch_start', pub(room));
      } else {
        room.rematchOffer = null;
        const offerer = color === 'red' ? room.players.black : room.players.red;
        if (offerer) io.to(offerer.socketId).emit('rematch_declined');
      }
    });

    // ── Spectator ──────────────────────────────────────────────────────────
    socket.on('watch_room', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId.toUpperCase());
      if (!room) { socket.emit('error', { message: 'Phòng không tồn tại' }); return; }
      if (room.status === 'waiting') { socket.emit('error', { message: 'Ván đấu chưa bắt đầu' }); return; }
      room.spectators.push(socket.id);
      socket.join(room.id);
      socket.emit('joined_as_spectator', {
        roomId: room.id,
        room: pub(room),
        moveHistory: room.moveHistory,
      });
    });

    // ── Matchmaking ────────────────────────────────────────────────────────
    socket.on('join_queue', (data: { userId: number; username: string; timeControl: number }) => {
      const existingIdx = matchQueue.findIndex(e => e.userId === data.userId);
      if (existingIdx !== -1) matchQueue.splice(existingIdx, 1);

      matchQueue.push({
        socketId: socket.id,
        userId: data.userId,
        username: data.username,
        timeControl: data.timeControl ?? 0,
      });
      socket.emit('queue_joined', { position: matchQueue.length });

      if (matchQueue.length >= 2) {
        const p1 = matchQueue.shift()!;
        const p2 = matchQueue.shift()!;

        const p1Socket = io.sockets.sockets.get(p1.socketId);
        const p2Socket = io.sockets.sockets.get(p2.socketId);
        if (!p1Socket || !p2Socket) {
          if (p1Socket) matchQueue.unshift(p1);
          if (p2Socket) matchQueue.unshift(p2);
          return;
        }

        const roomId   = uuidv4().substring(0, 6).toUpperCase();
        const tc       = p1.timeControl || p2.timeControl;
        const isP1Red  = Math.random() < 0.5;
        const red      = isP1Red ? p1 : p2;
        const black    = isP1Red ? p2 : p1;

        const room: Room = {
          id: roomId, board: createInitialBoard(), turn: 'red',
          players: {
            red:   { socketId: red.socketId,   userId: red.userId,   username: red.username },
            black: { socketId: black.socketId, userId: black.userId, username: black.username },
          },
          status: 'playing', moveHistory: [],
          timeControl: tc, timeLeft: { red: tc, black: tc },
          lastMoveAt: Date.now(), startedAt: Date.now(),
          drawOffer: null, drawOfferAt: 0,
          rematchOffer: null,
          spectators: [],
          chat: [],
        };
        rooms.set(roomId, room);

        p1Socket.join(roomId);
        p2Socket.join(roomId);

        const p1Color: Color = isP1Red ? 'red' : 'black';
        const p2Color: Color = isP1Red ? 'black' : 'red';
        p1Socket.emit('matched', { roomId, color: p1Color });
        p2Socket.emit('matched', { roomId, color: p2Color });
        io.to(roomId).emit('game_start', pub(room));
      }
    });

    socket.on('leave_queue', () => {
      const idx = matchQueue.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) matchQueue.splice(idx, 1);
    });

    // ── Leave / Disconnect ─────────────────────────────────────────────────
    socket.on('leave_room', (data: { roomId: string }) => { socket.leave(data.roomId); });

    socket.on('disconnect', () => {
      const qi = matchQueue.findIndex(e => e.socketId === socket.id);
      if (qi !== -1) matchQueue.splice(qi, 1);

      for (const [, room] of rooms) {
        const si = room.spectators.indexOf(socket.id);
        if (si !== -1) { room.spectators.splice(si, 1); continue; }

        if (room.status !== 'playing') continue;
        const isRed   = room.players.red?.socketId   === socket.id;
        const isBlack = room.players.black?.socketId === socket.id;
        if (!isRed && !isBlack) continue;
        room.status = 'finished';
        room.winner = isRed ? 'black' : 'red';
        saveGame(room, 'disconnect');
        io.to(room.id).emit('game_over', { ...pub(room), reason: 'disconnect' });
      }
    });
  });
}
