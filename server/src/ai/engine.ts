import {
  Board, Color, GameMove, PieceType,
  applyMove, getAllLegalMoves, isInCheck, hasLegalMoves,
} from '../game/rules';

export type Difficulty = 'easy' | 'normal' | 'hard';

const PIECE_VALUES: Record<PieceType, number> = {
  general:  10000,
  chariot:   1000,
  cannon:     450,
  horse:      400,
  elephant:   200,
  advisor:    200,
  soldier:    100,
};

// Position bonus tables (Red's perspective, row 9 = Red's back)
const CHARIOT_TABLE = [
  [14,14,12,18,16,18,12,14,14],
  [16,20,18,24,26,24,18,20,16],
  [12,12,12,18,18,18,12,12,12],
  [12,18,16,22,22,22,16,18,12],
  [12,14,12,18,18,18,12,14,12],
  [12,16,14,20,20,20,14,16,12],
  [14,14,12,18,18,18,12,14,14],
  [16,16,14,22,22,22,14,16,16],
  [20,22,24,26,28,26,24,22,20],
  [20,18,14,22,20,22,14,18,20],
];

const CANNON_TABLE = [
  [ 6, 4, 0, -10, -12, -10, 0, 4, 6],
  [ 2, 2, 0, -4,  -14,  -4, 0, 2, 2],
  [ 2, 6, 4,  0,  -10,   0, 4, 6, 2],
  [ 0, 0, 0,  2,    8,   2, 0, 0, 0],
  [ 0, 0, 0,  2,    8,   2, 0, 0, 0],
  [-2, 0, 4,  2,    6,   2, 4, 0,-2],
  [ 0, 0, 0,  2,    6,   2, 0, 0, 0],
  [ 4, 0, 8,  6,   10,   6, 8, 0, 4],
  [ 0, 2, 4,  6,    6,   6, 4, 2, 0],
  [ 0, 0, 2,  6,    6,   6, 2, 0, 0],
];

const HORSE_TABLE = [
  [ 4, 8, 16, 12, 4, 12, 16, 8, 4],
  [ 4,10, 28, 16, 8, 16, 28,10, 4],
  [12,14, 16, 20,18, 20, 16,14,12],
  [ 8,24, 18, 24,20, 24, 18,24, 8],
  [ 6,16, 14, 18,16, 18, 14,16, 6],
  [ 4,12, 16, 14,12, 14, 16,12, 4],
  [ 4,12, 14, 12,10, 12, 14,12, 4],
  [ 6, 4, 14, 12, 6, 12, 14, 4, 6],
  [ 2, 0, 10,  0, 2,  0, 10, 0, 2],
  [ 0, 0,  0,  0, 0,  0,  0, 0, 0],
];

const SOLDIER_TABLE = [
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [18,36,36,36,45,36,36,36,18],
  [14,36,36,36,45,36,36,36,14],
  [ 4, 0,20,34,40,34,20, 0, 4],
  [ 0, 3, 6, 9, 9, 9, 6, 3, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function getPosBonus(type: PieceType, row: number, col: number, color: Color): number {
  const r = color === 'red' ? row : 9 - row;
  const c = color === 'red' ? col : 8 - col;
  switch (type) {
    case 'chariot': return CHARIOT_TABLE[r][c];
    case 'cannon':  return CANNON_TABLE[r][c];
    case 'horse':   return HORSE_TABLE[r][c];
    case 'soldier': return SOLDIER_TABLE[r][c];
    default: return 0;
  }
}

function evaluate(board: Board, color: Color): number {
  let score = 0;
  const opp = color === 'red' ? 'black' : 'red';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type] + getPosBonus(p.type, r, c, p.color);
      score += p.color === color ? val : -val;
    }
  }
  return score;
}

function shuffleMoves(moves: GameMove[]): GameMove[] {
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  return moves;
}

function orderMoves(board: Board, moves: GameMove[]): GameMove[] {
  return moves.sort((a, b) => {
    const capA = board[a.to[0]][a.to[1]];
    const capB = board[b.to[0]][b.to[1]];
    const valA = capA ? PIECE_VALUES[capA.type] : 0;
    const valB = capB ? PIECE_VALUES[capB.type] : 0;
    return valB - valA;
  });
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: Color,
): number {
  const curColor = maximizing ? aiColor : (aiColor === 'red' ? 'black' : 'red');

  if (depth === 0) return evaluate(board, aiColor);

  const moves = getAllLegalMoves(board, curColor);
  if (moves.length === 0) {
    return isInCheck(board, curColor)
      ? (maximizing ? -50000 : 50000)
      : 0;
  }

  const ordered = orderMoves(board, moves);

  if (maximizing) {
    let best = -Infinity;
    for (const m of ordered) {
      const v = minimax(applyMove(board, m), depth - 1, alpha, beta, false, aiColor);
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of ordered) {
      const v = minimax(applyMove(board, m), depth - 1, alpha, beta, true, aiColor);
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

const DEPTH_MAP: Record<Difficulty, number> = { easy: 1, normal: 3, hard: 5 };

export function getBestMove(board: Board, color: Color, difficulty: Difficulty): GameMove | null {
  const depth = DEPTH_MAP[difficulty];
  const moves = getAllLegalMoves(board, color);
  if (moves.length === 0) return null;

  // Easy mode: some randomness
  if (difficulty === 'easy') {
    const shuffled = shuffleMoves([...moves]);
    const sample = shuffled.slice(0, Math.min(8, shuffled.length));
    let best = sample[0];
    let bestVal = -Infinity;
    for (const m of sample) {
      const v = minimax(applyMove(board, m), 0, -Infinity, Infinity, false, color);
      if (v > bestVal) { bestVal = v; best = m; }
    }
    return best;
  }

  let best = moves[0];
  let bestVal = -Infinity;
  const ordered = orderMoves(board, moves);
  for (const m of ordered) {
    const v = minimax(applyMove(board, m), depth - 1, -Infinity, Infinity, false, color);
    if (v > bestVal) { bestVal = v; best = m; }
  }
  return best;
}
