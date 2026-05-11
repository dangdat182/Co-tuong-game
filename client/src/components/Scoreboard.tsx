import { useEffect, useState } from 'react';
import './Scoreboard.css';

interface ScoreRow {
  username: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

interface Props { onBack: () => void; currentUser: string; }

export default function Scoreboard({ onBack, currentUser }: Props) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scores/leaderboard')
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="sb-bg">
      <div className="sb-card">
        <div className="sb-header">
          <button className="btn-back" onClick={onBack}>← Quay lại</button>
          <h2>🏆 Bảng xếp hạng</h2>
        </div>
        {loading ? (
          <div className="sb-loading">Đang tải...</div>
        ) : (
          <table className="sb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Người chơi</th>
                <th>Điểm</th>
                <th>Thắng</th>
                <th>Thua</th>
                <th>Hòa</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="sb-empty">Chưa có dữ liệu</td></tr>
              )}
              {rows.map((row, i) => (
                <tr key={row.username} className={row.username === currentUser ? 'me' : ''}>
                  <td className="rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="uname">{row.username} {row.username === currentUser && <span className="you">(bạn)</span>}</td>
                  <td className="points">{row.points}</td>
                  <td className="wins">{row.wins}</td>
                  <td className="losses">{row.losses}</td>
                  <td className="draws">{row.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sb-note">Điểm = Thắng × 3 + Hòa × 1</div>
      </div>
    </div>
  );
}
