export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';
export type Color = 'red' | 'black';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];
export type Position = [number, number]; // [row, col]

export interface GameMove {
  from: Position;
  to: Position;
}

const ROWS = 10;
const COLS = 9;

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function inPalace(r: number, c: number, color: Color): boolean {
  if (color === 'red') return r >= 7 && r <= 9 && c >= 3 && c <= 5;
  return r >= 0 && r <= 2 && c >= 3 && c <= 5;
}

function crossedRiver(r: number, color: Color): boolean {
  return color === 'red' ? r <= 4 : r >= 5;
}

function getPseudoLegalMoves(board: Board, from: Position): Position[] {
  const [row, col] = from;
  const piece = board[row][col];
  if (!piece) return [];

  const moves: Position[] = [];

  const addIfValid = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return;
    const t = board[nr][nc];
    if (!t || t.color !== piece.color) moves.push([nr, nc]);
  };

  switch (piece.type) {
    case 'general': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, piece.color)) addIfValid(nr, nc);
      }
      break;
    }
    case 'advisor': {
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, piece.color)) addIfValid(nr, nc);
      }
      break;
    }
    case 'elephant': {
      const steps: [number, number, number, number][] = [
        [2,2,1,1],[2,-2,1,-1],[-2,2,-1,1],[-2,-2,-1,-1],
      ];
      for (const [dr, dc, br, bc] of steps) {
        const nr = row+dr, nc = col+dc;
        const legR = row+br, legC = col+bc;
        if (inBounds(nr, nc) && !crossedRiver(nr, piece.color) && !board[legR][legC]) {
          addIfValid(nr, nc);
        }
      }
      break;
    }
    case 'horse': {
      const steps: [number, number, number, number][] = [
        [-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],
        [-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1],
      ];
      for (const [dr, dc, lr, lc] of steps) {
        const nr = row+dr, nc = col+dc;
        const legR = row+lr, legC = col+lc;
        if (inBounds(nr, nc) && !board[legR][legC]) addIfValid(nr, nc);
      }
      break;
    }
    case 'chariot': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        let nr = row+dr, nc = col+dc;
        while (inBounds(nr, nc)) {
          const t = board[nr][nc];
          if (!t) { moves.push([nr, nc]); }
          else { if (t.color !== piece.color) moves.push([nr, nc]); break; }
          nr += dr; nc += dc;
        }
      }
      break;
    }
    case 'cannon': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        let nr = row+dr, nc = col+dc;
        let screen = false;
        while (inBounds(nr, nc)) {
          const t = board[nr][nc];
          if (!screen) {
            if (!t) moves.push([nr, nc]);
            else screen = true;
          } else {
            if (t) { if (t.color !== piece.color) moves.push([nr, nc]); break; }
          }
          nr += dr; nc += dc;
        }
      }
      break;
    }
    case 'soldier': {
      const fwd = piece.color === 'red' ? -1 : 1;
      addIfValid(row + fwd, col);
      if (crossedRiver(row, piece.color)) {
        addIfValid(row, col - 1);
        addIfValid(row, col + 1);
      }
      break;
    }
  }
  return moves;
}

function findGeneral(board: Board, color: Color): Position | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.type === 'general' && board[r][c]?.color === color)
        return [r, c];
  return null;
}

function flyingGeneral(board: Board): boolean {
  const rg = findGeneral(board, 'red');
  const bg = findGeneral(board, 'black');
  if (!rg || !bg || rg[1] !== bg[1]) return false;
  const [minR, maxR] = [Math.min(rg[0], bg[0]), Math.max(rg[0], bg[0])];
  for (let r = minR + 1; r < maxR; r++) if (board[r][rg[1]]) return false;
  return true;
}

export function isInCheck(board: Board, color: Color): boolean {
  const gp = findGeneral(board, color);
  if (!gp) return true;
  if (flyingGeneral(board)) return true;
  const opp = color === 'red' ? 'black' : 'red';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.color === opp) {
        const ms = getPseudoLegalMoves(board, [r, c]);
        if (ms.some(([mr, mc]) => mr === gp[0] && mc === gp[1])) return true;
      }
  return false;
}

export function applyMove(board: Board, move: GameMove): Board {
  const nb = board.map(row => [...row]);
  nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  return nb;
}

export function getLegalMoves(board: Board, from: Position): Position[] {
  const piece = board[from[0]][from[1]];
  if (!piece) return [];
  return getPseudoLegalMoves(board, from).filter(to => {
    const nb = applyMove(board, { from, to });
    return !isInCheck(nb, piece.color);
  });
}

export function getAllLegalMoves(board: Board, color: Color): GameMove[] {
  const moves: GameMove[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.color === color)
        for (const to of getLegalMoves(board, [r, c]))
          moves.push({ from: [r, c], to });
  return moves;
}

export function hasLegalMoves(board: Board, color: Color): boolean {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.color === color && getLegalMoves(board, [r, c]).length > 0)
        return true;
  return false;
}

export function createInitialBoard(): Board {
  const b: Board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  const backRow: PieceType[] = ['chariot','horse','elephant','advisor','general','advisor','elephant','horse','chariot'];

  backRow.forEach((type, col) => { b[0][col] = { type, color: 'black' }; });
  b[2][1] = { type: 'cannon', color: 'black' };
  b[2][7] = { type: 'cannon', color: 'black' };
  for (let c = 0; c < 9; c += 2) b[3][c] = { type: 'soldier', color: 'black' };

  backRow.forEach((type, col) => { b[9][col] = { type, color: 'red' }; });
  b[7][1] = { type: 'cannon', color: 'red' };
  b[7][7] = { type: 'cannon', color: 'red' };
  for (let c = 0; c < 9; c += 2) b[6][c] = { type: 'soldier', color: 'red' };

  return b;
}
