import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  Board, Color, GameMove,
  createInitialBoard, getLegalMoves, applyMove, isInCheck, hasLegalMoves,
} from '../game/rules';

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
  timeControl: number;          // 0 = no limit, else seconds per player
  timeLeft: { red: number; black: number };
  lastMoveAt: number;           // Date.now() when current turn started
  // draw
  drawOffer: Color | null;      // who has an outstanding offer
  drawOfferAt: number;
  // chat
  chat: ChatMsg[];
}

const rooms = new Map<string, Room>();

function pub(room: Room) {
  return {
    id: room.id, board: room.board, turn: room.turn,
    players: room.players, status: room.status, winner: room.winner,
    timeControl: room.timeControl, timeLeft: room.timeLeft,
  };
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
        timeControl: tc, timeLeft: { red: tc, black: tc }, lastMoveAt: 0,
        drawOffer: null, drawOfferAt: 0,
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
          io.to(room.id).emit('game_over', { ...pub(room), reason: 'timeout' });
          return;
        }
      }

      room.board = applyMove(room.board, data.move);
      room.moveHistory.push(data.move);
      room.drawOffer = null; // any pending offer is cancelled on move
      room.turn = room.turn === 'red' ? 'black' : 'red';
      room.lastMoveAt = Date.now();

      const nextColor = room.turn;
      const inCheck   = isInCheck(room.board, nextColor);
      const noMoves   = !hasLegalMoves(room.board, nextColor);

      if (noMoves) {
        room.status = 'finished';
        room.winner = playerColor;
        io.to(room.id).emit('game_over', { ...pub(room), move: data.move, reason: inCheck ? 'checkmate' : 'stalemate' });
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
      if (!loser || loser !== room.turn) return; // only active player can time out
      room.status = 'finished';
      room.winner = loser === 'red' ? 'black' : 'red';
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
      if (room.drawOffer === color) return; // already offered
      const cooldown = (Date.now() - room.drawOfferAt) / 1000;
      if (room.drawOffer !== color && cooldown < 30) return; // cooldown
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

    // ── Leave / Disconnect ─────────────────────────────────────────────────
    socket.on('leave_room', (data: { roomId: string }) => { socket.leave(data.roomId); });

    socket.on('disconnect', () => {
      for (const [, room] of rooms) {
        if (room.status !== 'playing') continue;
        const isRed   = room.players.red?.socketId   === socket.id;
        const isBlack = room.players.black?.socketId === socket.id;
        if (!isRed && !isBlack) continue;
        room.status = 'finished';
        room.winner = isRed ? 'black' : 'red';
        io.to(room.id).emit('game_over', { ...pub(room), reason: 'disconnect' });
      }
    });
  });
}
