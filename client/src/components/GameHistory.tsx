import { useEffect, useState } from 'react';
import './GameHistory.css';

interface GameRecord {
  id: number;
  redUsername: string;
  blackUsername: string;
  winner: 'red' | 'black' | null;
  reason: string;
  moveCount: number;
  timeControl: number;
  startedAt: string;
  endedAt: string;
}

interface Props {
  token: string;
  currentUser: string;
  onBack: () => void;
}

const REASON_MAP: Record<string, string> = {
  checkmate:   'Chiếu hết',
  stalemate:   'Bế tắc',
  resign:      'Đầu hàng',
  disconnect:  'Ngắt kết nối',
  timeout:     'Hết giờ',
  draw_agreed: 'Đồng ý hòa',
};

export default function GameHistory({ token, currentUser, onBack }: Props) {
  const [games, setGames]   = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    fetch('/api/games/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setGames(data); setLoading(false); })
      .catch(() => { setError('Không thể tải lịch sử ván đấu'); setLoading(false); });
  }, [token]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatTime(sec: number) {
    if (!sec) return '∞';
    return `${Math.floor(sec / 60)} phút`;
  }

  function getResult(game: GameRecord) {
    if (!game.winner) return { label: 'Hòa', cls: 'draw' };
    const iWon = (game.winner === 'red'   && game.redUsername   === currentUser) ||
                 (game.winner === 'black' && game.blackUsername === currentUser);
    return iWon ? { label: 'Thắng', cls: 'win' } : { label: 'Thua', cls: 'loss' };
  }

  return (
    <div className="gh-bg">
      <div className="gh-container">
        <div className="gh-header">
          <button className="gh-back-btn" onClick={onBack}>← Quay lại</button>
          <h2>📚 Lịch sử ván đấu</h2>
          <span className="gh-sub">Hiển thị 50 ván gần nhất</span>
        </div>

        {loading && <div className="gh-loading"><div className="gh-spinner" />Đang tải...</div>}
        {error   && <div className="gh-error">{error}</div>}

        {!loading && !error && games.length === 0 && (
          <div className="gh-empty">Chưa có ván đấu online nào được lưu</div>
        )}

        {!loading && games.length > 0 && (
          <div className="gh-list">
            {games.map(g => {
              const result  = getResult(g);
              const myColor = g.redUsername === currentUser ? 'red' : 'black';
              const opp     = myColor === 'red' ? g.blackUsername : g.redUsername;
              return (
                <div key={g.id} className={`gh-row ${result.cls}`}>
                  <div className={`gh-badge ${result.cls}`}>{result.label}</div>
                  <div className="gh-info">
                    <div className="gh-players">
                      <span className="gh-red">{g.redUsername}</span>
                      <span className="gh-vs">vs</span>
                      <span className="gh-black">{g.blackUsername}</span>
                    </div>
                    <div className="gh-meta">
                      <span>📅 {formatDate(g.endedAt)}</span>
                      <span>♟ {g.moveCount} nước</span>
                      <span>⏱ {formatTime(g.timeControl)}</span>
                      <span>{REASON_MAP[g.reason] ?? g.reason}</span>
                    </div>
                  </div>
                  <div className="gh-opp">vs {opp}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
