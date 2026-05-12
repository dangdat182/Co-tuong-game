import { useEffect, useRef } from 'react';
import { Board as BoardType, GameMove, Color, PieceType } from '../game/rules';
import './MoveHistory.css';

const PIECE_NAMES: Record<PieceType, string> = {
  general: 'Tướng', advisor: 'Sĩ', elephant: 'Tượng',
  horse: 'Mã', chariot: 'Xe', cannon: 'Pháo', soldier: 'Tốt',
};
const COLS = 'abcdefghi';

export interface MoveRecord {
  move: GameMove;
  board: BoardType;   // board state AFTER this move
  notation: string;
  color: Color;
}

export function buildMoveRecord(
  boardBefore: BoardType,
  boardAfter: BoardType,
  move: GameMove,
  color: Color,
): MoveRecord {
  const piece    = boardBefore[move.from[0]][move.from[1]];
  const captured = boardBefore[move.to[0]][move.to[1]];
  const name     = piece ? PIECE_NAMES[piece.type] : '?';
  const from     = `${COLS[move.from[1]]}${10 - move.from[0]}`;
  const to       = `${COLS[move.to[1]]}${10 - move.to[0]}`;
  const notation = captured ? `${name} ăn ${to}` : `${name} ${from}→${to}`;
  return { move, board: boardAfter, notation, color };
}

interface Props {
  records: MoveRecord[];
  reviewIndex: number | null;
  onReview: (index: number | null) => void;
  interactive?: boolean;  // false = show only, no click (e.g. during online game)
}

export default function MoveHistory({ records, reviewIndex, onReview, interactive = true }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new move added (and not reviewing)
  useEffect(() => {
    if (reviewIndex === null && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [records.length, reviewIndex]);

  return (
    <div className="move-history">
      <div className="mh-header">
        <span>📋 Lịch sử nước đi</span>
        {reviewIndex !== null && (
          <button className="mh-back-btn" onClick={() => onReview(null)}>↩ Hiện tại</button>
        )}
      </div>
      <div className="mh-list" ref={listRef}>
        {records.length === 0 ? (
          <div className="mh-empty">Chưa có nước nào</div>
        ) : (
          records.map((rec, i) => (
            <div
              key={i}
              className={`mh-row ${rec.color}${reviewIndex === i ? ' active' : ''}${!interactive ? ' no-click' : ''}`}
              onClick={interactive ? () => onReview(reviewIndex === i ? null : i) : undefined}
              title={interactive ? 'Click để xem lại thế cờ' : ''}
            >
              <span className="mh-num">{i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}</span>
              <span className={`mh-dot ${rec.color}`} />
              <span className="mh-notation">{rec.notation}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
