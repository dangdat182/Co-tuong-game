import { useMemo } from 'react';
import { Board as BoardType, Position, Piece, getLegalMoves, getPieceChar } from '../game/rules';
import './Board.css';

export type BoardTheme = 'classic' | 'dark' | 'jade' | 'blue';

const THEME_COLORS: Record<BoardTheme, { bg: string; lines: string; river: string }> = {
  classic: { bg: '#f0c060', lines: '#8B4513', river: '#8B4513' },
  dark:    { bg: '#2d1f0e', lines: '#c8a060', river: '#c8a060' },
  jade:    { bg: '#c2ddb0', lines: '#2d5a27', river: '#2d5a27' },
  blue:    { bg: '#c8dff0', lines: '#1a4a7a', river: '#1a4a7a' },
};

const CELL = 60;
const PAD  = 40;
const W = (9 - 1) * CELL + PAD * 2;
const H = (10 - 1) * CELL + PAD * 2;

function pos(col: number, row: number) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}

interface Props {
  board: BoardType;
  flipped?: boolean;
  selected: Position | null;
  onSelect: (p: Position | null) => void;
  onMove: (from: Position, to: Position) => void;
  myColor: 'red' | 'black' | null;
  disabled?: boolean;
  lastMove?: { from: Position; to: Position } | null;
  inCheck?: boolean;
  theme?: BoardTheme;
}

export default function Board({ board, flipped, selected, onSelect, onMove, myColor, disabled, lastMove, inCheck, theme }: Props) {
  const themeKey: BoardTheme = theme ?? ((localStorage.getItem('board_theme') as BoardTheme) || 'classic');
  const colors = THEME_COLORS[themeKey] ?? THEME_COLORS.classic;

  const legalMoves = useMemo(
    () => (selected ? getLegalMoves(board, selected) : []),
    [board, selected],
  );

  function fromDisplay(dRow: number, dCol: number): [number, number] {
    return flipped ? [9 - dRow, 8 - dCol] : [dRow, dCol];
  }

  function handleCellClick(dRow: number, dCol: number) {
    if (disabled) return;
    const [row, col] = fromDisplay(dRow, dCol);

    if (selected) {
      const isLegal = legalMoves.some(([r, c]) => r === row && c === col);
      if (isLegal) { onMove(selected, [row, col]); onSelect(null); return; }
    }

    const piece = board[row][col];
    if (piece && piece.color === myColor) { onSelect([row, col]); }
    else { onSelect(null); }
  }

  const isSelected = (r: number, c: number) => selected ? selected[0] === r && selected[1] === c : false;
  const isLegal    = (r: number, c: number) => legalMoves.some(([lr, lc]) => lr === r && lc === c);
  const isLastMove = (r: number, c: number) =>
    lastMove ? (lastMove.from[0] === r && lastMove.from[1] === c) ||
               (lastMove.to[0]   === r && lastMove.to[1]   === c) : false;

  function generalPos(color: 'red' | 'black'): [number, number] | null {
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 9; c++)
        if (board[r][c]?.type === 'general' && board[r][c]?.color === color) return [r, c];
    return null;
  }

  const checkKingPos = inCheck ? generalPos(myColor === 'red' ? 'red' : 'black') : null;

  const boardRows: JSX.Element[] = [];
  for (let dRow = 0; dRow < 10; dRow++) {
    const cells: JSX.Element[] = [];
    for (let dCol = 0; dCol < 9; dCol++) {
      const [row, col] = fromDisplay(dRow, dCol);
      const piece = board[row][col];
      const { x, y } = pos(dCol, dRow);
      const sel   = isSelected(row, col);
      const legal = isLegal(row, col);
      const last  = isLastMove(row, col);
      const check = checkKingPos ? checkKingPos[0] === row && checkKingPos[1] === col : false;

      cells.push(
        <g key={`${dRow}-${dCol}`} onClick={() => handleCellClick(dRow, dCol)} style={{ cursor: disabled ? 'default' : 'pointer' }}>
          {(sel || last || check) && (
            <rect
              x={x - CELL/2} y={y - CELL/2} width={CELL} height={CELL}
              fill={check ? 'rgba(255,0,0,0.25)' : sel ? 'rgba(255,215,0,0.35)' : 'rgba(255,215,0,0.18)'}
              rx={4}
            />
          )}
          {legal && !piece && (
            <circle cx={x} cy={y} r={10} fill="rgba(0,180,0,0.5)" />
          )}
          {legal && piece && (
            <circle cx={x} cy={y} r={CELL/2 - 2} fill="none" stroke="rgba(0,180,0,0.8)" strokeWidth={3} />
          )}
          {piece && <PieceSVG piece={piece} cx={x} cy={y} selected={sel} />}
        </g>,
      );
    }
    boardRows.push(<g key={dRow}>{cells}</g>);
  }

  return (
    <div className="board-wrapper">
      <svg width={W} height={H} className="board-svg">
        {/* Board background */}
        <rect width={W} height={H} fill={colors.bg} rx={8} />

        {/* Horizontal grid lines */}
        {Array.from({ length: 10 }, (_, r) => (
          <line key={`h${r}`}
            x1={PAD} y1={PAD + r*CELL} x2={PAD + 8*CELL} y2={PAD + r*CELL}
            stroke={colors.lines} strokeWidth={1} />
        ))}
        {/* Vertical grid lines (split at river) */}
        {Array.from({ length: 9 }, (_, c) => {
          const x = PAD + c * CELL;
          return c === 0 || c === 8
            ? <line key={`v${c}`} x1={x} y1={PAD} x2={x} y2={PAD + 9*CELL} stroke={colors.lines} strokeWidth={1.5} />
            : [
                <line key={`vt${c}`} x1={x} y1={PAD} x2={x} y2={PAD + 4*CELL} stroke={colors.lines} strokeWidth={1} />,
                <line key={`vb${c}`} x1={x} y1={PAD + 5*CELL} x2={x} y2={PAD + 9*CELL} stroke={colors.lines} strokeWidth={1} />,
              ];
        })}

        {/* Palace diagonals */}
        <line x1={PAD+3*CELL} y1={PAD}        x2={PAD+5*CELL} y2={PAD+2*CELL} stroke={colors.lines} strokeWidth={1} />
        <line x1={PAD+5*CELL} y1={PAD}        x2={PAD+3*CELL} y2={PAD+2*CELL} stroke={colors.lines} strokeWidth={1} />
        <line x1={PAD+3*CELL} y1={PAD+7*CELL} x2={PAD+5*CELL} y2={PAD+9*CELL} stroke={colors.lines} strokeWidth={1} />
        <line x1={PAD+5*CELL} y1={PAD+7*CELL} x2={PAD+3*CELL} y2={PAD+9*CELL} stroke={colors.lines} strokeWidth={1} />

        {/* River text */}
        <text x={PAD + 0.8*CELL} y={PAD + 4.5*CELL + 8} fill={colors.river} fontSize={22} fontFamily="serif" opacity={0.8}>楚  河</text>
        <text x={PAD + 4.9*CELL} y={PAD + 4.5*CELL + 8} fill={colors.river} fontSize={22} fontFamily="serif" opacity={0.8}>漢  界</text>

        {/* Corner marks */}
        {[[2,1],[2,7],[7,1],[7,7],[3,0],[3,2],[3,4],[3,6],[3,8],[6,0],[6,2],[6,4],[6,6],[6,8]].map(([r,c]) => {
          const { x, y } = pos(c, r);
          return <CornerMark key={`m${r}${c}`} cx={x} cy={y} hasLeft={c > 0} hasRight={c < 8} hasTop={r > 0} hasBottom={r < 9} color={colors.lines} />;
        })}

        {/* Pieces & interactions */}
        {boardRows}
      </svg>
    </div>
  );
}

function CornerMark({ cx, cy, hasLeft, hasRight, hasTop, hasBottom, color }: {
  cx: number; cy: number;
  hasLeft: boolean; hasRight: boolean; hasTop: boolean; hasBottom: boolean;
  color: string;
}) {
  const L = 6; const G = 3;
  const lines = [];
  if (hasLeft)   lines.push(`M${cx-G},${cy-L} L${cx-G},${cy-G} L${cx-L},${cy-G}`);
  if (hasLeft)   lines.push(`M${cx-G},${cy+L} L${cx-G},${cy+G} L${cx-L},${cy+G}`);
  if (hasRight)  lines.push(`M${cx+G},${cy-L} L${cx+G},${cy-G} L${cx+L},${cy-G}`);
  if (hasRight)  lines.push(`M${cx+G},${cy+L} L${cx+G},${cy+G} L${cx+L},${cy+G}`);
  if (!hasLeft && hasTop)    lines.push(`M${cx},${cy-G} L${cx},${cy-L}`);
  if (!hasLeft && hasBottom) lines.push(`M${cx},${cy+G} L${cx},${cy+L}`);
  return <path d={lines.join(' ')} fill="none" stroke={color} strokeWidth={1.5} />;
}

function PieceSVG({ piece, cx, cy, selected }: { piece: Piece; cx: number; cy: number; selected: boolean }) {
  const R = 24;
  const isRed = piece.color === 'red';
  const bg   = selected ? (isRed ? '#ff4400' : '#2244cc') : (isRed ? '#cc2200' : '#1a1a1a');
  const fg   = '#f5e6c8';
  const ring = isRed ? '#ff8866' : '#6688cc';

  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 2} fill={ring} opacity={selected ? 1 : 0.6} />
      <circle cx={cx} cy={cy} r={R}     fill={bg} />
      <circle cx={cx} cy={cy} r={R - 3} fill="none" stroke={ring} strokeWidth={1.5} />
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        fill={fg}
        fontSize={20}
        fontFamily="'KaiTi', 'STKaiti', 'SimSun', serif"
        fontWeight="bold"
      >
        {getPieceChar(piece)}
      </text>
    </g>
  );
}
