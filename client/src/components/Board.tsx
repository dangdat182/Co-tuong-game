import { useMemo } from 'react';
import { Board as BoardType, Position, Piece, getLegalMoves, getPieceChar } from '../game/rules';
import './Board.css';

export type BoardTheme = 'classic' | 'dark' | 'jade' | 'blue';

interface ThemeColors {
  bg: string; bgDark: string; lines: string; river: string; palace: string;
}

const THEME_COLORS: Record<BoardTheme, ThemeColors> = {
  classic: { bg: '#c89448', bgDark: '#a07030', lines: '#5a2e0a', river: '#5a2e0a', palace: '#5a2e0a' },
  dark:    { bg: '#0b1828', bgDark: '#060e18', lines: '#2a5080', river: '#3a70b0', palace: '#3a70b0' },
  jade:    { bg: '#8aaa70', bgDark: '#607850', lines: '#1a3a18', river: '#1a3a18', palace: '#1a3a18' },
  blue:    { bg: '#9ab8d8', bgDark: '#7090b8', lines: '#1a3a6a', river: '#1a3a6a', palace: '#1a3a6a' },
};

const CELL = 60;
const PAD  = 44;
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
  const themeKey: BoardTheme = theme ?? ((localStorage.getItem('board_theme') as BoardTheme) || 'dark');
  const colors = THEME_COLORS[themeKey] ?? THEME_COLORS.dark;

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
  const isDark = themeKey === 'dark';

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
          {last && (
            <rect x={x - CELL/2} y={y - CELL/2} width={CELL} height={CELL}
              fill={isDark ? 'rgba(60,130,255,0.12)' : 'rgba(255,215,0,0.15)'} rx={3} />
          )}
          {sel && (
            <rect x={x - CELL/2} y={y - CELL/2} width={CELL} height={CELL}
              fill={isDark ? 'rgba(60,160,255,0.25)' : 'rgba(255,215,0,0.35)'} rx={3} />
          )}
          {check && (
            <rect x={x - CELL/2} y={y - CELL/2} width={CELL} height={CELL}
              fill="rgba(255,40,20,0.28)" rx={3} />
          )}
          {legal && !piece && (
            <circle cx={x} cy={y} r={9}
              fill={isDark ? 'rgba(74,158,255,0.55)' : 'rgba(0,160,80,0.55)'} />
          )}
          {legal && piece && (
            <circle cx={x} cy={y} r={CELL/2 - 1} fill="none"
              stroke={isDark ? 'rgba(74,158,255,0.85)' : 'rgba(0,160,80,0.85)'} strokeWidth={2.5} />
          )}
          {piece && <PieceSVG piece={piece} cx={x} cy={y} selected={sel} isDark={isDark} />}
        </g>,
      );
    }
    boardRows.push(<g key={dRow}>{cells}</g>);
  }

  const lw = 1.2;
  const riverY1 = PAD + 4 * CELL;
  const riverY2 = PAD + 5 * CELL;

  return (
    <div className={`board-wrapper theme-${themeKey}`}>
      <svg width={W} height={H} className="board-svg">
        <defs>
          {/* Piece gradients */}
          <radialGradient id="grad-red" cx="40%" cy="34%" r="70%">
            <stop offset="0%"   stopColor="#ff6644" />
            <stop offset="50%"  stopColor="#b81818" />
            <stop offset="100%" stopColor="#5a0808" />
          </radialGradient>
          <radialGradient id="grad-black" cx="40%" cy="34%" r="70%">
            <stop offset="0%"   stopColor="#2a4870" />
            <stop offset="50%"  stopColor="#0d1e38" />
            <stop offset="100%" stopColor="#04090f" />
          </radialGradient>
          {/* Board background gradient */}
          <linearGradient id="board-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={colors.bg} />
            <stop offset="100%" stopColor={colors.bgDark} />
          </linearGradient>
          {/* Piece drop shadow */}
          <filter id="piece-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(0,0,0,0.7)" />
          </filter>
          {/* Selected glow filters */}
          <filter id="glow-red" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feFlood floodColor="#e84040" floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-blue" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feFlood floodColor="#4a9eff" floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* River gradient */}
          <linearGradient id="river-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={colors.river} stopOpacity="0.15" />
            <stop offset="50%"  stopColor={colors.river} stopOpacity="0.08" />
            <stop offset="100%" stopColor={colors.river} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Board background */}
        <rect width={W} height={H} fill="url(#board-grad)" rx={8} />

        {/* River band */}
        <rect x={PAD} y={riverY1} width={8*CELL} height={CELL}
          fill="url(#river-grad)" />

        {/* Horizontal lines */}
        {Array.from({ length: 10 }, (_, r) => (
          <line key={`h${r}`}
            x1={PAD} y1={PAD + r*CELL} x2={PAD + 8*CELL} y2={PAD + r*CELL}
            stroke={colors.lines} strokeWidth={r === 0 || r === 9 ? 2 : lw} opacity={0.9} />
        ))}

        {/* Vertical lines (split at river) */}
        {Array.from({ length: 9 }, (_, c) => {
          const x = PAD + c * CELL;
          const thick = c === 0 || c === 8 ? 2 : lw;
          return c === 0 || c === 8
            ? <line key={`v${c}`} x1={x} y1={PAD} x2={x} y2={PAD + 9*CELL}
                stroke={colors.lines} strokeWidth={thick} opacity={0.9} />
            : [
                <line key={`vt${c}`} x1={x} y1={PAD} x2={x} y2={PAD + 4*CELL}
                  stroke={colors.lines} strokeWidth={lw} opacity={0.9} />,
                <line key={`vb${c}`} x1={x} y1={PAD + 5*CELL} x2={x} y2={PAD + 9*CELL}
                  stroke={colors.lines} strokeWidth={lw} opacity={0.9} />,
              ];
        })}

        {/* Palace diagonals */}
        {[
          [PAD+3*CELL, PAD, PAD+5*CELL, PAD+2*CELL],
          [PAD+5*CELL, PAD, PAD+3*CELL, PAD+2*CELL],
          [PAD+3*CELL, PAD+7*CELL, PAD+5*CELL, PAD+9*CELL],
          [PAD+5*CELL, PAD+7*CELL, PAD+3*CELL, PAD+9*CELL],
        ].map(([x1,y1,x2,y2], i) => (
          <line key={`pal${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={colors.palace} strokeWidth={1} opacity={0.8} />
        ))}

        {/* River text */}
        <text x={PAD + 0.65*CELL} y={PAD + 4.5*CELL + 9}
          fill={colors.river} fontSize={21} fontFamily="'KaiTi','STKaiti','SimSun',serif"
          fontWeight="bold" opacity={0.7} letterSpacing="8">楚  河</text>
        <text x={PAD + 4.85*CELL} y={PAD + 4.5*CELL + 9}
          fill={colors.river} fontSize={21} fontFamily="'KaiTi','STKaiti','SimSun',serif"
          fontWeight="bold" opacity={0.7} letterSpacing="8">漢  界</text>

        {/* Corner marks (cannon + soldier positions) */}
        {[[2,1],[2,7],[7,1],[7,7],[3,0],[3,2],[3,4],[3,6],[3,8],[6,0],[6,2],[6,4],[6,6],[6,8]].map(([r,c]) => {
          const { x, y } = pos(c, r);
          return <CornerMark key={`m${r}${c}`} cx={x} cy={y}
            hasLeft={c > 0} hasRight={c < 8} hasTop={r > 0} hasBottom={r < 9}
            color={colors.lines} />;
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
  const L = 7; const G = 4;
  const lines = [];
  if (hasLeft)   lines.push(`M${cx-G},${cy-L} L${cx-G},${cy-G} L${cx-L},${cy-G}`);
  if (hasLeft)   lines.push(`M${cx-G},${cy+L} L${cx-G},${cy+G} L${cx-L},${cy+G}`);
  if (hasRight)  lines.push(`M${cx+G},${cy-L} L${cx+G},${cy-G} L${cx+L},${cy-G}`);
  if (hasRight)  lines.push(`M${cx+G},${cy+L} L${cx+G},${cy+G} L${cx+L},${cy+G}`);
  return <path d={lines.join(' ')} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />;
}

function PieceSVG({ piece, cx, cy, selected, isDark }: {
  piece: Piece; cx: number; cy: number; selected: boolean; isDark: boolean;
}) {
  const R = 24;
  const isRed = piece.color === 'red';

  const outerRing = isRed ? '#4a0808' : '#081428';
  const innerRing = isRed ? '#e06050' : '#4a80c0';
  const gradId    = isRed ? 'grad-red' : 'grad-black';
  const glowId    = isRed ? 'glow-red' : 'glow-blue';
  const textColor = isRed ? '#ffeedd' : '#c8dcff';
  const highlight = isRed ? 'rgba(255,200,160,0.22)' : 'rgba(140,200,255,0.18)';

  return (
    <g filter={selected ? `url(#${glowId})` : 'url(#piece-shadow)'}>
      {/* Outer shadow ring */}
      <circle cx={cx} cy={cy} r={R+3} fill={outerRing} opacity={0.8} />
      {/* Main body with radial gradient */}
      <circle cx={cx} cy={cy} r={R} fill={`url(#${gradId})`} />
      {/* Inner decorative ring */}
      <circle cx={cx} cy={cy} r={R-5} fill="none" stroke={innerRing} strokeWidth={1.3} opacity={0.9} />
      {/* Subtle highlight for 3-D depth */}
      <ellipse cx={cx-5} cy={cy-8} rx={9} ry={6} fill={highlight} />
      {/* Piece character */}
      <text
        x={cx} y={cy + 7}
        textAnchor="middle"
        fill={textColor}
        fontSize={20}
        fontFamily="'KaiTi','STKaiti','SimSun',serif"
        fontWeight="bold"
      >
        {getPieceChar(piece)}
      </text>
    </g>
  );
}
