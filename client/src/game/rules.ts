export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';
export type Color = 'red' | 'black';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];
export type Position = [number, number];

export interface GameMove {
  from: Position;
  to: Position;
}

const ROWS = 10;
const COLS = 9;

function inBounds(r: number, c: number) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function inPalace(r: number, c: number, color: Color) {
  return color === 'red'
    ? r >= 7 && r <= 9 && c >= 3 && c <= 5
    : r >= 0 && r <= 2 && c >= 3 && c <= 5;
}

function crossedRiver(r: number, color: Color) {
  return color === 'red' ? r <= 4 : r >= 5;
}

function getPseudo(board: Board, from: Position): Position[] {
  const [row, col] = from;
  const piece = board[row][col];
  if (!piece) return [];
  const moves: Position[] = [];

  const add = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return;
    const t = board[nr][nc];
    if (!t || t.color !== piece.color) moves.push([nr, nc]);
  };

  switch (piece.type) {
    case 'general':
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, piece.color)) add(nr, nc);
      }
      break;
    case 'advisor':
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, piece.color)) add(nr, nc);
      }
      break;
    case 'elephant':
      for (const [dr, dc, br, bc] of [[2,2,1,1],[2,-2,1,-1],[-2,2,-1,1],[-2,-2,-1,-1]] as [number,number,number,number][]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && !crossedRiver(nr, piece.color) && !board[row+br][col+bc]) add(nr, nc);
      }
      break;
    case 'horse':
      for (const [dr, dc, lr, lc] of [[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]] as [number,number,number,number][]) {
        const nr = row+dr, nc = col+dc;
        if (inBounds(nr, nc) && !board[row+lr][col+lc]) add(nr, nc);
      }
      break;
    case 'chariot':
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
    case 'cannon':
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        let nr = row+dr, nc = col+dc;
        let screen = false;
        while (inBounds(nr, nc)) {
          const t = board[nr][nc];
          if (!screen) { if (!t) moves.push([nr, nc]); else screen = true; }
          else { if (t) { if (t.color !== piece.color) moves.push([nr, nc]); break; } }
          nr += dr; nc += dc;
        }
      }
      break;
    case 'soldier': {
      const fwd = piece.color === 'red' ? -1 : 1;
      add(row+fwd, col);
      if (crossedRiver(row, piece.color)) { add(row, col-1); add(row, col+1); }
      break;
    }
  }
  return moves;
}

function findGeneral(board: Board, color: Color): Position | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.type === 'general' && board[r][c]?.color === color) return [r, c];
  return null;
}

function flyingGeneral(board: Board): boolean {
  const rg = findGeneral(board, 'red');
  const bg = findGeneral(board, 'black');
  if (!rg || !bg || rg[1] !== bg[1]) return false;
  const [lo, hi] = [Math.min(rg[0], bg[0]), Math.max(rg[0], bg[0])];
  for (let r = lo+1; r < hi; r++) if (board[r][rg[1]]) return false;
  return true;
}

export function isInCheck(board: Board, color: Color): boolean {
  const gp = findGeneral(board, color);
  if (!gp) return true;
  if (flyingGeneral(board)) return true;
  const opp = color === 'red' ? 'black' : 'red';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.color === opp)
        if (getPseudo(board, [r, c]).some(([mr, mc]) => mr === gp[0] && mc === gp[1])) return true;
  return false;
}

export function applyMove(board: Board, move: GameMove): Board {
  const nb = board.map(r => [...r]);
  nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  return nb;
}

export function getLegalMoves(board: Board, from: Position): Position[] {
  const piece = board[from[0]][from[1]];
  if (!piece) return [];
  return getPseudo(board, from).filter(to => !isInCheck(applyMove(board, { from, to }), piece.color));
}

export function createInitialBoard(): Board {
  const b: Board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  const back: PieceType[] = ['chariot','horse','elephant','advisor','general','advisor','elephant','horse','chariot'];
  back.forEach((type, col) => { b[0][col] = { type, color: 'black' }; });
  b[2][1] = { type: 'cannon', color: 'black' };
  b[2][7] = { type: 'cannon', color: 'black' };
  for (let c = 0; c < 9; c += 2) b[3][c] = { type: 'soldier', color: 'black' };
  back.forEach((type, col) => { b[9][col] = { type, color: 'red' }; });
  b[7][1] = { type: 'cannon', color: 'red' };
  b[7][7] = { type: 'cannon', color: 'red' };
  for (let c = 0; c < 9; c += 2) b[6][c] = { type: 'soldier', color: 'red' };
  return b;
}

export const PIECE_CHARS: Record<PieceType, [string, string]> = {
  general:  ['帥', '將'],
  advisor:  ['仕', '士'],
  elephant: ['相', '象'],
  horse:    ['傌', '馬'],
  chariot:  ['俥', '車'],
  cannon:   ['炮', '砲'],
  soldier:  ['兵', '卒'],
};

export function getPieceChar(piece: Piece): string {
  return piece.color === 'red' ? PIECE_CHARS[piece.type][0] : PIECE_CHARS[piece.type][1];
}
