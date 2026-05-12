import { useEffect, useState, useCallback, useRef } from 'react';
import Board from './Board';
import Chat, { ChatMsg } from './Chat';
import MoveHistory, { MoveRecord, buildMoveRecord } from './MoveHistory';
import {
  Board as BoardType, Position, GameMove, Color,
  createInitialBoard, applyMove, isInCheck, getLegalMoves,
} from '../game/rules';
import socket from '../socket';
import { sounds, isMuted, toggleMute } from '../utils/sounds';
import './Game.css';

type Difficulty = 'easy' | 'normal' | 'hard';
interface User { id: number; username: string; }

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── AI Game ────────────────────────────────────────────────────────────────

interface AIGameProps {
  user: User;
  token: string;
  difficulty: Difficulty;
  timeControl: number; // seconds per side, 0 = unlimited
  onBack: () => void;
}

interface BoardSnapshot {
  board: BoardType;
  lastMove: GameMove | null;
  myTime: number;
  aiTime: number;
}

export function AIGame({ user, token, difficulty, timeControl, onBack }: AIGameProps) {
  const [board, setBoard]       = useState<BoardType>(createInitialBoard());
  const [turn, setTurn]         = useState<Color>('red');
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<GameMove | null>(null);
  const [status, setStatus]     = useState<'playing' | 'win' | 'loss'>('playing');
  const [aiThinking, setAiThinking] = useState(false);
  const [message, setMessage]   = useState('');
  const [myTime, setMyTime]     = useState(timeControl > 0 ? timeControl : 0);
  const [aiTime, setAiTime]     = useState(timeControl > 0 ? timeControl : 0);
  const [muted, setMuted]       = useState(isMuted());
  const [history, setHistory]       = useState<BoardSnapshot[]>([]);
  const [moveRecords, setMoveRecords] = useState<MoveRecord[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const myColor: Color = 'red';
  const aiColor: Color = 'black';

  const updateScore = useCallback(async (result: 'win' | 'loss' | 'draw') => {
    try {
      await fetch('/api/scores/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ result }),
      });
    } catch { /* ignore */ }
  }, [token]);

  const checkGameOver = useCallback((b: BoardType, nextTurn: Color): boolean => {
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 9; c++)
        if (b[r][c]?.color === nextTurn && getLegalMoves(b, [r, c]).length > 0) return false;
    return true;
  }, []);

  // Timer tick — switches when turn changes
  useEffect(() => {
    if (!timeControl || status !== 'playing') return;
    const interval = setInterval(() => {
      if (turn === myColor) setMyTime(t => Math.max(0, t - 1));
      else setAiTime(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, status, timeControl]); // eslint-disable-line

  // Timeout detection
  useEffect(() => {
    if (!timeControl || status !== 'playing') return;
    if (myTime <= 0 && turn === myColor) {
      setStatus('loss'); setMessage('Hết giờ! Bạn thua.');
      updateScore('loss'); sounds.lose();
    } else if (aiTime <= 0 && turn === aiColor) {
      setStatus('win'); setMessage('Hết giờ! Bạn thắng.');
      updateScore('win'); sounds.win();
    }
  }, [myTime, aiTime]); // eslint-disable-line

  // Tick sound when my time is low
  useEffect(() => {
    if (timeControl && myTime > 0 && myTime <= 10 && turn === myColor && status === 'playing') {
      sounds.tick();
    }
  }, [myTime]); // eslint-disable-line

  // AI move request
  useEffect(() => {
    if (turn !== aiColor || status !== 'playing') return;
    setAiThinking(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board, color: aiColor, difficulty }),
        });
        const data = await res.json();
        if (data.move) {
          const captured = board[data.move.to[0]][data.move.to[1]];
          const newBoard = applyMove(board, data.move);
          setMoveRecords(r => [...r, buildMoveRecord(board, newBoard, data.move, aiColor)]);
          setReviewIndex(null);
          setBoard(newBoard);
          setLastMove(data.move);
          setTurn('red');
          if (captured) sounds.capture(); else sounds.move();
          if (checkGameOver(newBoard, 'red')) {
            setStatus('loss'); setMessage('Máy thắng! Bạn bị chiếu hết.');
            updateScore('loss'); sounds.lose();
          } else if (isInCheck(newBoard, 'red')) {
            setMessage('Bạn đang bị chiếu!'); sounds.check();
          } else {
            setMessage('');
          }
        }
      } catch { setMessage('Lỗi kết nối AI'); }
      finally { setAiThinking(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [turn, board, difficulty, status, checkGameOver, updateScore]); // eslint-disable-line

  function handleUndo() {
    if (history.length === 0 || aiThinking || status !== 'playing') return;
    const snap = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    // Remove last 2 records (player move + AI move), or 1 if AI didn't respond yet
    setMoveRecords(r => r.length >= 2 ? r.slice(0, -2) : r.slice(0, -1));
    setReviewIndex(null);
    setBoard(snap.board);
    setLastMove(snap.lastMove);
    setMyTime(snap.myTime);
    setAiTime(snap.aiTime);
    setTurn(myColor);
    setMessage('');
    setSelected(null);
  }

  function handleMove(from: Position, to: Position) {
    if (turn !== myColor || status !== 'playing' || aiThinking) return;
    if (reviewIndex !== null) { setReviewIndex(null); return; } // exit review on move
    setHistory(h => [...h, { board, lastMove, myTime, aiTime }]);
    const captured = board[to[0]][to[1]];
    const newBoard = applyMove(board, { from, to });
    setMoveRecords(r => [...r, buildMoveRecord(board, newBoard, { from, to }, myColor)]);
    setBoard(newBoard);
    setLastMove({ from, to });
    setTurn('black');
    if (captured) sounds.capture(); else sounds.move();
    if (checkGameOver(newBoard, 'black')) {
      setStatus('win'); setMessage('Bạn thắng! Chiếu hết!');
      updateScore('win'); sounds.win();
    } else if (isInCheck(newBoard, 'black')) {
      setMessage('Máy đang bị chiếu!'); sounds.check();
    } else {
      setMessage('');
    }
  }

  function handleRestart() {
    setBoard(createInitialBoard()); setTurn('red'); setSelected(null);
    setLastMove(null); setStatus('playing'); setMessage('');
    setMyTime(timeControl > 0 ? timeControl : 0);
    setAiTime(timeControl > 0 ? timeControl : 0);
    setHistory([]); setMoveRecords([]); setReviewIndex(null);
  }

  const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Dễ', normal: 'Bình thường', hard: 'Khó' };

  return (
    <div className="game-bg">
      <div className="game-layout">
        {/* Left: AI */}
        <aside className="game-side left">
          <div className="side-panel">
            <div className="player-card ai">
              <div className="player-icon">🤖</div>
              <div>
                <div className="player-name">Máy AI</div>
                <div className="player-sub">{DIFF_LABEL[difficulty]}</div>
              </div>
              {turn === aiColor && status === 'playing' && (
                <div className="turn-indicator ai-turn">
                  {aiThinking ? 'Đang suy nghĩ...' : 'Lượt đi'}
                </div>
              )}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === aiColor && status === 'playing' ? 'active' : ''} ${aiTime <= 30 ? 'low' : ''}`}>
                {formatTime(aiTime)}
              </div>
            )}
          </div>
        </aside>

        {/* Center: board */}
        <div className="game-center">
          {status !== 'playing' && (
            <div className={`game-overlay ${status}`}>
              <div className="overlay-content">
                <div className="overlay-icon">{status === 'win' ? '🎉' : '😞'}</div>
                <h2>{status === 'win' ? 'Chiến thắng!' : 'Thất bại!'}</h2>
                <p>{message}</p>
                <div className="overlay-buttons">
                  <button className="btn-primary" onClick={handleRestart}>Chơi lại</button>
                  <button className="btn-secondary" onClick={onBack}>Về sảnh</button>
                </div>
              </div>
            </div>
          )}
          <Board
            board={reviewIndex !== null ? moveRecords[reviewIndex].board : board}
            selected={reviewIndex !== null ? null : selected}
            onSelect={reviewIndex !== null ? () => {} : setSelected}
            onMove={handleMove}
            myColor={myColor}
            disabled={turn !== myColor || status !== 'playing' || aiThinking || reviewIndex !== null}
            lastMove={reviewIndex !== null ? moveRecords[reviewIndex].move : lastMove}
            inCheck={reviewIndex === null && isInCheck(board, myColor) && turn === myColor}
          />
          {reviewIndex !== null && (
            <div className="game-msg" style={{ background: 'rgba(80,80,200,0.15)', color: '#aac0ff', borderColor: 'rgba(80,80,200,0.35)' }}>
              Xem lại nước {reviewIndex + 1}/{moveRecords.length} — <button className="mh-inline-back" onClick={() => setReviewIndex(null)}>↩ Hiện tại</button>
            </div>
          )}
          {message && status === 'playing' && reviewIndex === null && <div className="game-msg">{message}</div>}
        </div>

        {/* Right: me + controls */}
        <aside className="game-side right">
          <div className="side-panel">
            <div className="player-card me">
              <div className="player-icon">👤</div>
              <div>
                <div className="player-name">{user.username}</div>
                <div className="player-sub">Quân Đỏ</div>
              </div>
              {turn === myColor && status === 'playing' && (
                <div className="turn-indicator my-turn">Lượt của bạn</div>
              )}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === myColor && status === 'playing' ? 'active' : ''} ${myTime <= 30 ? 'low' : ''}`}>
                {formatTime(myTime)}
              </div>
            )}
            <button className="btn-mute" onClick={() => setMuted(toggleMute())}>
              {muted ? '🔇 Tắt tiếng' : '🔊 Âm thanh'}
            </button>
            {status === 'playing' && (
              <button
                className="btn-undo"
                onClick={handleUndo}
                disabled={history.length === 0 || aiThinking}
              >
                ↩ Hoàn tác
              </button>
            )}
            <button className="btn-resign" onClick={() => {
              setStatus('loss'); setMessage('Bạn đã đầu hàng.'); updateScore('loss'); sounds.lose();
            }}>
              🏳 Đầu hàng
            </button>
            <button className="btn-secondary" onClick={onBack}>← Về sảnh</button>
            <MoveHistory
              records={moveRecords}
              reviewIndex={reviewIndex}
              onReview={setReviewIndex}
              interactive={true}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Online Game ─────────────────────────────────────────────────────────────

type OnlineStatus = 'waiting' | 'playing' | 'finished';

interface OnlineGameProps {
  user: User;
  token: string;
  roomId: string;
  myColor: Color;
  initialData: {
    board: BoardType;
    turn: Color;
    players: any;
    timeControl: number;
    timeLeft: { red: number; black: number };
  };
  onBack: () => void;
}

export function OnlineGame({ user, token, roomId, myColor, initialData, onBack }: OnlineGameProps) {
  const [board, setBoard]       = useState<BoardType>(initialData.board);
  const [turn, setTurn]         = useState<Color>(initialData.turn);
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<GameMove | null>(null);
  const [gameStatus, setGameStatus] = useState<OnlineStatus>('playing');
  const [winner, setWinner]     = useState<Color | null>(null);
  const [endReason, setEndReason] = useState('');
  const [opponent]              = useState<string>(() => {
    const p = initialData.players;
    return myColor === 'red' ? p?.black?.username ?? 'Đối thủ' : p?.red?.username ?? 'Đối thủ';
  });
  const [inCheck, setInCheck]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState({
    red:   initialData.timeLeft?.red   ?? 0,
    black: initialData.timeLeft?.black ?? 0,
  });
  const [chatMsgs, setChatMsgs]           = useState<ChatMsg[]>([]);
  const [drawOffered, setDrawOffered]     = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [drawDeclined, setDrawDeclined]   = useState(false);
  const [rematchOffered, setRematchOffered]   = useState(false);
  const [rematchSent, setRematchSent]         = useState(false);
  const [rematchDeclined, setRematchDeclined] = useState(false);
  const [muted, setMuted]               = useState(isMuted());
  const [moveRecords, setMoveRecords]   = useState<MoveRecord[]>([]);
  const [reviewIndex, setReviewIndex]   = useState<number | null>(null);

  const timeControl = initialData.timeControl ?? 0;
  const boardRef    = useRef<BoardType>(initialData.board);
  const scoreUpdated = useRef(false);
  const leavingRef  = useRef(false);
  const oppColor    = myColor === 'red' ? 'black' : 'red';

  const updateScore = useCallback(async (result: 'win' | 'loss' | 'draw') => {
    if (scoreUpdated.current) return;
    scoreUpdated.current = true;
    try {
      await fetch('/api/scores/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ result }),
      });
    } catch { /* ignore */ }
  }, [token]);

  // Main socket listeners
  useEffect(() => {
    socket.connect();

    socket.on('move_made', (data: any) => {
      const prevBoard = boardRef.current;
      const wasCaptured = !!prevBoard[data.move.to[0]]?.[data.move.to[1]];
      const mover: Color = data.turn === 'red' ? 'black' : 'red'; // who just moved
      setMoveRecords(r => [...r, buildMoveRecord(prevBoard, data.board, data.move, mover)]);
      setReviewIndex(null);
      boardRef.current = data.board;
      setBoard(data.board);
      setTurn(data.turn);
      setLastMove(data.move);
      const inCheckNow = data.inCheck && data.turn === myColor;
      setInCheck(inCheckNow);
      if (data.timeLeft) setTimeLeft(data.timeLeft);
      if (wasCaptured) sounds.capture(); else sounds.move();
      if (inCheckNow) sounds.check();
    });

    socket.on('game_over', (data: any) => {
      const finalBoard = data.board ?? boardRef.current;
      boardRef.current = finalBoard;
      setBoard(finalBoard);
      setGameStatus('finished');
      setWinner(data.winner ?? null);
      const won    = data.winner === myColor;
      const isDraw = !data.winner;
      const reasonMap: Record<string, string> = {
        checkmate:   won ? 'Bạn đã chiếu hết đối thủ!' : 'Bạn bị chiếu hết!',
        stalemate:   'Bế tắc! Ván hòa.',
        resign:      won ? 'Đối thủ đầu hàng!'         : 'Bạn đã đầu hàng.',
        disconnect:  won ? 'Đối thủ ngắt kết nối!'     : 'Bạn đã ngắt kết nối.',
        timeout:     won ? 'Đối thủ hết giờ!'          : 'Bạn hết giờ!',
        draw_agreed: 'Hai bên đồng ý hòa.',
      };
      setEndReason(reasonMap[data.reason] ?? '');
      if (isDraw)     { updateScore('draw'); sounds.draw(); }
      else if (won)   { updateScore('win');  sounds.win();  }
      else            { updateScore('loss'); sounds.lose(); }
    });

    socket.on('invalid_move', (data: any) => {
      setErrorMsg(data.message ?? 'Nước đi không hợp lệ');
      setTimeout(() => setErrorMsg(''), 2000);
    });

    socket.on('draw_offered', () => {
      setDrawOffered(true);
      sounds.drawOffer();
    });

    socket.on('draw_offer_sent', () => setDrawOfferSent(true));

    socket.on('draw_declined', () => {
      setDrawOfferSent(false);
      setDrawDeclined(true);
      setTimeout(() => setDrawDeclined(false), 3000);
    });

    socket.on('chat_message', (msg: ChatMsg) => {
      setChatMsgs(prev => [...prev, msg]);
      if (msg.username !== user.username) sounds.chat();
    });

    socket.on('error', (data: any) => setErrorMsg(data.message ?? 'Lỗi'));

    socket.on('rematch_offered', () => setRematchOffered(true));
    socket.on('rematch_offer_sent', () => setRematchSent(true));
    socket.on('rematch_declined', () => {
      setRematchSent(false);
      setRematchDeclined(true);
      setTimeout(() => setRematchDeclined(false), 3000);
    });
    socket.on('rematch_start', (data: any) => {
      boardRef.current = data.board;
      setBoard(data.board);
      setTurn(data.turn);
      setGameStatus('playing');
      setWinner(null);
      setEndReason('');
      setSelected(null);
      setLastMove(null);
      setInCheck(false);
      setErrorMsg('');
      setTimeLeft({ red: data.timeLeft?.red ?? 0, black: data.timeLeft?.black ?? 0 });
      setRematchOffered(false);
      setRematchSent(false);
      setRematchDeclined(false);
      setDrawOffered(false);
      setDrawOfferSent(false);
      setMoveRecords([]);
      setReviewIndex(null);
      scoreUpdated.current = false;
    });

    return () => {
      socket.off('move_made');
      socket.off('game_over');
      socket.off('invalid_move');
      socket.off('draw_offered');
      socket.off('draw_offer_sent');
      socket.off('draw_declined');
      socket.off('chat_message');
      socket.off('error');
      socket.off('rematch_offered');
      socket.off('rematch_offer_sent');
      socket.off('rematch_declined');
      socket.off('rematch_start');
      if (leavingRef.current) {
        socket.emit('leave_room', { roomId });
        socket.disconnect();
      }
    };
  }, []); // eslint-disable-line

  // Client-side timer tick
  useEffect(() => {
    if (!timeControl || gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => ({
        red:   turn === 'red'   ? Math.max(0, prev.red   - 1) : prev.red,
        black: turn === 'black' ? Math.max(0, prev.black - 1) : prev.black,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, gameStatus, timeControl]); // eslint-disable-line

  // Send timeout to server when my time hits 0
  useEffect(() => {
    if (!timeControl || gameStatus !== 'playing') return;
    if (timeLeft[myColor] <= 0 && turn === myColor) {
      socket.emit('timeout', { roomId });
    }
  }, [timeLeft.red, timeLeft.black]); // eslint-disable-line

  // Tick sound when my time is low
  useEffect(() => {
    if (timeControl && timeLeft[myColor] > 0 && timeLeft[myColor] <= 10 && turn === myColor && gameStatus === 'playing') {
      sounds.tick();
    }
  }, [timeLeft.red, timeLeft.black]); // eslint-disable-line

  function leaveGame() { leavingRef.current = true; onBack(); }

  function handleMove(from: Position, to: Position) {
    if (turn !== myColor || gameStatus !== 'playing') return;
    socket.emit('make_move', { roomId, move: { from, to } });
  }

  function handleOfferDraw() { socket.emit('offer_draw', { roomId }); }

  function handleRespondDraw(accept: boolean) {
    setDrawOffered(false);
    socket.emit('respond_draw', { roomId, accept });
  }

  function handleOfferRematch() { socket.emit('offer_rematch', { roomId }); }

  function handleRespondRematch(accept: boolean) {
    setRematchOffered(false);
    socket.emit('respond_rematch', { roomId, accept });
  }

  const colorLabel = myColor === 'red' ? 'Quân Đỏ' : 'Quân Đen';

  return (
    <div className="game-bg">
      <div className="game-layout">
        {/* Left: opponent + chat */}
        <aside className="game-side left">
          <div className="side-panel">
            <div className="player-card opp">
              <div className="player-icon">👤</div>
              <div>
                <div className="player-name">{opponent}</div>
                <div className="player-sub">{oppColor === 'red' ? 'Quân Đỏ' : 'Quân Đen'}</div>
              </div>
              {turn === oppColor && gameStatus === 'playing' && (
                <div className="turn-indicator opp-turn">Đang đi...</div>
              )}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === oppColor && gameStatus === 'playing' ? 'active' : ''} ${timeLeft[oppColor] <= 30 ? 'low' : ''}`}>
                {formatTime(timeLeft[oppColor])}
              </div>
            )}
            <Chat
              messages={chatMsgs}
              onSend={(msg) => socket.emit('chat_message', { roomId, message: msg })}
              myUsername={user.username}
            />
          </div>
        </aside>

        {/* Center: board */}
        <div className="game-center">
          {/* Draw offer overlay */}
          {drawOffered && gameStatus === 'playing' && (
            <div className="game-overlay draw-offer-overlay">
              <div className="overlay-content">
                <div className="overlay-icon">🤝</div>
                <h2>Đề nghị hòa</h2>
                <p>Đối thủ muốn hòa ván này</p>
                <div className="overlay-buttons">
                  <button className="btn-primary"   onClick={() => handleRespondDraw(true)}>Đồng ý</button>
                  <button className="btn-secondary" onClick={() => handleRespondDraw(false)}>Từ chối</button>
                </div>
              </div>
            </div>
          )}
          {gameStatus === 'finished' && (
            rematchOffered ? (
              <div className="game-overlay rematch-offer-overlay">
                <div className="overlay-content">
                  <div className="overlay-icon">🔄</div>
                  <h2>Đề nghị đấu lại</h2>
                  <p>Đối thủ muốn chơi ván khác</p>
                  <div className="overlay-buttons">
                    <button className="btn-primary"   onClick={() => handleRespondRematch(true)}>Đồng ý</button>
                    <button className="btn-secondary" onClick={() => handleRespondRematch(false)}>Từ chối</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`game-overlay ${winner === myColor ? 'win' : winner ? 'loss' : 'draw'}`}>
                <div className="overlay-content">
                  <div className="overlay-icon">{winner === myColor ? '🎉' : winner ? '😞' : '🤝'}</div>
                  <h2>{winner === myColor ? 'Chiến thắng!' : winner ? 'Thất bại!' : 'Hòa!'}</h2>
                  <p>{endReason}</p>
                  <div className="overlay-buttons">
                    {!rematchSent ? (
                      <button className="btn-rematch" onClick={handleOfferRematch}>🔄 Đấu lại</button>
                    ) : (
                      <span className="draw-status-msg">Đang chờ đối thủ...</span>
                    )}
                    <button className="btn-secondary" onClick={leaveGame}>Về sảnh</button>
                  </div>
                  {rematchDeclined && (
                    <div className="draw-status-msg declined">Đối thủ từ chối đấu lại</div>
                  )}
                </div>
              </div>
            )
          )}
          <Board
            board={reviewIndex !== null ? moveRecords[reviewIndex].board : board}
            flipped={myColor === 'black'}
            selected={reviewIndex !== null ? null : selected}
            onSelect={reviewIndex !== null ? () => {} : setSelected}
            onMove={handleMove}
            myColor={myColor}
            disabled={turn !== myColor || gameStatus !== 'playing' || reviewIndex !== null}
            lastMove={reviewIndex !== null ? moveRecords[reviewIndex].move : lastMove}
            inCheck={reviewIndex === null && inCheck}
          />
          {reviewIndex !== null && (
            <div className="game-msg" style={{ background: 'rgba(80,80,200,0.15)', color: '#aac0ff', borderColor: 'rgba(80,80,200,0.35)' }}>
              Xem lại nước {reviewIndex + 1}/{moveRecords.length} — <button className="mh-inline-back" onClick={() => setReviewIndex(null)}>↩ Hiện tại</button>
            </div>
          )}
          {!reviewIndex && errorMsg && <div className="game-msg error">{errorMsg}</div>}
          {!reviewIndex && !errorMsg && inCheck && gameStatus === 'playing' && (
            <div className="game-msg check">⚠ Tướng của bạn đang bị chiếu!</div>
          )}
        </div>

        {/* Right: me + controls */}
        <aside className="game-side right">
          <div className="side-panel">
            <div className="player-card me">
              <div className="player-icon">👤</div>
              <div>
                <div className="player-name">{user.username}</div>
                <div className="player-sub">{colorLabel}</div>
              </div>
              {turn === myColor && gameStatus === 'playing' && (
                <div className="turn-indicator my-turn">Lượt của bạn</div>
              )}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === myColor && gameStatus === 'playing' ? 'active' : ''} ${timeLeft[myColor] <= 30 ? 'low' : ''}`}>
                {formatTime(timeLeft[myColor])}
              </div>
            )}
            <button className="btn-mute" onClick={() => setMuted(toggleMute())}>
              {muted ? '🔇 Tắt tiếng' : '🔊 Âm thanh'}
            </button>
            {gameStatus === 'playing' && !drawOfferSent && (
              <button className="btn-draw" onClick={handleOfferDraw}>🤝 Đề nghị hòa</button>
            )}
            {drawOfferSent && (
              <div className="draw-status-msg">Đang chờ đối thủ...</div>
            )}
            {drawDeclined && (
              <div className="draw-status-msg declined">Đối thủ từ chối hòa</div>
            )}
            {gameStatus === 'playing' && (
              <button className="btn-resign" onClick={() => socket.emit('resign', { roomId })}>
                🏳 Đầu hàng
              </button>
            )}
            <button className="btn-secondary" onClick={leaveGame}>← Về sảnh</button>
            <MoveHistory
              records={moveRecords}
              reviewIndex={reviewIndex}
              onReview={setReviewIndex}
              interactive={gameStatus === 'finished'}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Spectator Game ───────────────────────────────────────────────────────────

interface SpectatorGameProps {
  roomId: string;
  initialData: { board: BoardType; turn: Color; players: any; timeControl: number; timeLeft: { red: number; black: number } };
  initialMoves: GameMove[];
  onBack: () => void;
}

export function SpectatorGame({ roomId, initialData, initialMoves, onBack }: SpectatorGameProps) {
  const [board, setBoard]       = useState<BoardType>(initialData.board);
  const [turn, setTurn]         = useState<Color>(initialData.turn);
  const [lastMove, setLastMove] = useState<GameMove | null>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'finished'>('playing');
  const [winner, setWinner]     = useState<Color | null>(null);
  const [endReason, setEndReason] = useState('');
  const [timeLeft, setTimeLeft] = useState(initialData.timeLeft ?? { red: 0, black: 0 });
  const [moveRecords, setMoveRecords] = useState<MoveRecord[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const boardRef = useRef<BoardType>(initialData.board);
  const timeControl = initialData.timeControl ?? 0;

  const redName   = initialData.players?.red?.username   ?? 'Đỏ';
  const blackName = initialData.players?.black?.username ?? 'Đen';

  // Replay initial move history
  useEffect(() => {
    let b = createInitialBoard();
    const recs: MoveRecord[] = [];
    for (const mv of initialMoves) {
      const color: Color = b[mv.from[0]][mv.from[1]]?.color ?? 'red';
      const after = applyMove(b, mv);
      recs.push(buildMoveRecord(b, after, mv, color));
      b = after;
    }
    setMoveRecords(recs);
  }, []); // eslint-disable-line

  useEffect(() => {
    socket.connect();
    socket.on('move_made', (data: any) => {
      const prev = boardRef.current;
      const mover: Color = data.turn === 'red' ? 'black' : 'red';
      setMoveRecords(r => [...r, buildMoveRecord(prev, data.board, data.move, mover)]);
      setReviewIndex(null);
      boardRef.current = data.board;
      setBoard(data.board);
      setTurn(data.turn);
      setLastMove(data.move);
      if (data.timeLeft) setTimeLeft(data.timeLeft);
    });
    socket.on('game_over', (data: any) => {
      boardRef.current = data.board ?? boardRef.current;
      setBoard(data.board ?? boardRef.current);
      setGameStatus('finished');
      setWinner(data.winner ?? null);
      const reasonMap: Record<string, string> = {
        checkmate: 'Chiếu hết', stalemate: 'Bế tắc — Hòa', resign: 'Đầu hàng',
        disconnect: 'Ngắt kết nối', timeout: 'Hết giờ', draw_agreed: 'Đồng ý hòa',
      };
      setEndReason(reasonMap[data.reason] ?? '');
    });
    return () => {
      socket.off('move_made'); socket.off('game_over');
      socket.emit('leave_room', { roomId });
    };
  }, []); // eslint-disable-line

  // Client-side timer for spectator
  useEffect(() => {
    if (!timeControl || gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => ({
        red:   turn === 'red'   ? Math.max(0, prev.red   - 1) : prev.red,
        black: turn === 'black' ? Math.max(0, prev.black - 1) : prev.black,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, gameStatus, timeControl]); // eslint-disable-line

  return (
    <div className="game-bg">
      <div className="game-layout">
        {/* Left: black player */}
        <aside className="game-side left">
          <div className="side-panel">
            <div className="player-card opp">
              <div className="player-icon">👤</div>
              <div><div className="player-name">{blackName}</div><div className="player-sub">Quân Đen</div></div>
              {turn === 'black' && gameStatus === 'playing' && <div className="turn-indicator opp-turn">Đang đi...</div>}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === 'black' && gameStatus === 'playing' ? 'active' : ''} ${timeLeft.black <= 30 ? 'low' : ''}`}>
                {formatTime(timeLeft.black)}
              </div>
            )}
            <div className="spectator-badge">👁 Đang xem</div>
          </div>
        </aside>

        {/* Center: board */}
        <div className="game-center">
          {gameStatus === 'finished' && (
            <div className={`game-overlay ${winner === 'red' ? 'win' : winner === 'black' ? 'loss' : 'draw'}`}>
              <div className="overlay-content">
                <div className="overlay-icon">{winner ? '🏆' : '🤝'}</div>
                <h2>{winner ? `${winner === 'red' ? redName : blackName} thắng!` : 'Hòa!'}</h2>
                <p>{endReason}</p>
                <button className="btn-secondary" onClick={onBack}>← Về sảnh</button>
              </div>
            </div>
          )}
          <Board
            board={reviewIndex !== null ? moveRecords[reviewIndex].board : board}
            selected={null}
            onSelect={() => {}}
            onMove={() => {}}
            myColor="red"
            disabled={true}
            lastMove={reviewIndex !== null ? moveRecords[reviewIndex].move : lastMove}
            inCheck={false}
          />
        </div>

        {/* Right: red player + history */}
        <aside className="game-side right">
          <div className="side-panel">
            <div className="player-card me">
              <div className="player-icon">👤</div>
              <div><div className="player-name">{redName}</div><div className="player-sub">Quân Đỏ</div></div>
              {turn === 'red' && gameStatus === 'playing' && <div className="turn-indicator my-turn">Đang đi...</div>}
            </div>
            {timeControl > 0 && (
              <div className={`timer ${turn === 'red' && gameStatus === 'playing' ? 'active' : ''} ${timeLeft.red <= 30 ? 'low' : ''}`}>
                {formatTime(timeLeft.red)}
              </div>
            )}
            <button className="btn-secondary" onClick={onBack}>← Về sảnh</button>
            <MoveHistory records={moveRecords} reviewIndex={reviewIndex} onReview={setReviewIndex} interactive={true} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Matchmaking Room ─────────────────────────────────────────────────────────

interface MatchmakingRoomProps {
  user: User;
  timeControl: number;
  onGameStart: (roomId: string, myColor: Color, data: any) => void;
  onBack: () => void;
}

export function MatchmakingRoom({ user, timeControl, onGameStart, onBack }: MatchmakingRoomProps) {
  const [status, setStatus] = useState<'connecting' | 'searching' | 'found'>('connecting');
  const capturedRef = useRef<{ roomId: string; color: Color } | null>(null);

  useEffect(() => {
    const doJoin = () => {
      setStatus('searching');
      socket.emit('join_queue', { userId: user.id, username: user.username, timeControl });
    };

    socket.on('matched', (data: { roomId: string; color: Color }) => {
      capturedRef.current = { roomId: data.roomId, color: data.color };
      setStatus('found');
    });
    socket.on('game_start', (data: any) => {
      if (capturedRef.current) {
        onGameStart(capturedRef.current.roomId, capturedRef.current.color, data);
      }
    });
    socket.on('error', (data: any) => {
      alert(data.message ?? 'Lỗi kết nối');
      onBack();
    });

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      socket.connect();
    }

    return () => {
      socket.off('matched');
      socket.off('game_start');
      socket.off('error');
      socket.emit('leave_queue');
    };
  }, []); // eslint-disable-line

  return (
    <div className="game-bg">
      <div className="waiting-container">
        <div className="waiting-card">
          {status === 'connecting' && (
            <><div className="spinner" /><p>Đang kết nối...</p></>
          )}
          {status === 'found' && (
            <><div className="spinner" /><p>Đã tìm được đối thủ! Đang vào phòng...</p></>
          )}
          {status === 'searching' && (
            <>
              <div className="spinner" />
              <h2>🔍 Đang tìm đối thủ...</h2>
              <p>Chờ người chơi khác vào hàng</p>
              {timeControl > 0 && <p style={{ color: '#c8a060', fontSize: 14 }}>⏱ {Math.floor(timeControl / 60)} phút mỗi bên</p>}
            </>
          )}
          <button className="btn-secondary" onClick={() => { socket.emit('leave_queue'); onBack(); }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

// ─── Waiting Room ─────────────────────────────────────────────────────────────

interface WaitingRoomProps {
  user: User;
  token: string;
  timeControl: number;
  onGameStart: (roomId: string, myColor: Color, data: any) => void;
  onBack: () => void;
}

export function WaitingRoom({ user, timeControl, onGameStart, onBack }: WaitingRoomProps) {
  const [roomId, setRoomId]       = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const roomIdRef  = useRef<string | null>(null);
  const myColorRef = useRef<Color>('red');

  useEffect(() => {
    const doCreate = () => {
      setConnecting(false);
      socket.emit('create_room', { userId: user.id, username: user.username, timeControl });
    };

    socket.on('room_created', (data: { roomId: string; color: Color }) => {
      roomIdRef.current  = data.roomId;
      myColorRef.current = data.color;
      setRoomId(data.roomId);
    });
    socket.on('game_start', (data: any) => {
      if (roomIdRef.current) onGameStart(roomIdRef.current, myColorRef.current, data);
    });
    socket.on('error', (data: any) => console.error(data.message));

    if (socket.connected) {
      doCreate();
    } else {
      socket.once('connect', doCreate);
      socket.connect();
    }

    return () => {
      socket.off('connect'); socket.off('room_created');
      socket.off('game_start'); socket.off('error');
    };
  }, []); // eslint-disable-line

  return (
    <div className="game-bg">
      <div className="waiting-container">
        <div className="waiting-card">
          {connecting ? (
            <><div className="spinner" /><p>Đang kết nối...</p></>
          ) : roomId ? (
            <>
              <div className="spinner" />
              <h2>Đang chờ đối thủ...</h2>
              <div className="room-display">
                <div className="room-label">Mã phòng của bạn:</div>
                <div className="room-code-big">{roomId}</div>
                <div className="room-copy-buttons">
                  <button className="btn-copy" onClick={() => navigator.clipboard.writeText(roomId)}>
                    📋 Sao chép mã
                  </button>
                  <button className="btn-copy" onClick={() => navigator.clipboard.writeText(`${window.location.origin}?join=${roomId}`)}>
                    🔗 Copy link
                  </button>
                </div>
              </div>
              <p className="room-hint">Gửi mã hoặc link cho bạn bè để họ tham gia</p>
            </>
          ) : (
            <><div className="spinner" /><p>Đang tạo phòng...</p></>
          )}
          <button className="btn-secondary" onClick={() => { socket.disconnect(); onBack(); }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}
