import { useState } from 'react';
import './Lobby.css';

type Difficulty = 'easy' | 'normal' | 'hard';
type BoardTheme = 'classic' | 'dark' | 'jade' | 'blue';

interface User { id: number; username: string; }

interface Props {
  user: User;
  token: string;
  onPlayAI: (difficulty: Difficulty, timeControl: number) => void;
  onCreateRoom: (timeControl: number) => void;
  onJoinRoom: (roomId: string) => void;
  onShowScoreboard: () => void;
  onLogout: () => void;
}

const DIFF_LABELS: Record<Difficulty, string> = { easy: 'Dễ', normal: 'Bình thường', hard: 'Khó' };
const DIFF_DESC: Record<Difficulty, string> = {
  easy:   'Máy đi ngẫu nhiên, phù hợp người mới',
  normal: 'Máy suy nghĩ 3 nước, thách thức vừa phải',
  hard:   'Máy suy nghĩ 5 nước, rất khó để thắng',
};

const TIME_OPTIONS = [
  { label: '∞',       value: 0    },
  { label: '5 phút',  value: 300  },
  { label: '10 phút', value: 600  },
  { label: '15 phút', value: 900  },
  { label: '30 phút', value: 1800 },
];

const THEME_OPTIONS: { label: string; value: BoardTheme; bg: string }[] = [
  { label: 'Cổ điển', value: 'classic', bg: '#f0c060' },
  { label: 'Tối',     value: 'dark',    bg: '#2d1f0e' },
  { label: 'Ngọc',    value: 'jade',    bg: '#c2ddb0' },
  { label: 'Lam',     value: 'blue',    bg: '#c8dff0' },
];

export default function Lobby({ user, onPlayAI, onCreateRoom, onJoinRoom, onShowScoreboard, onLogout }: Props) {
  const [tab, setTab]         = useState<'home' | 'ai' | 'online'>('home');
  const [diff, setDiff]       = useState<Difficulty>('normal');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [timeControl, setTimeControl] = useState(0);
  const [theme, setTheme] = useState<BoardTheme>(
    () => (localStorage.getItem('board_theme') as BoardTheme) || 'classic',
  );

  function handleTheme(t: BoardTheme) {
    setTheme(t);
    localStorage.setItem('board_theme', t);
  }

  function handleJoin() {
    const id = roomInput.trim().toUpperCase();
    if (id.length !== 6) { setRoomError('Mã phòng phải gồm 6 ký tự'); return; }
    setRoomError('');
    onJoinRoom(id);
  }

  const settingsSection = (
    <div className="lobby-settings">
      <div className="settings-group">
        <div className="settings-label">⏱ Thời gian mỗi bên:</div>
        <div className="time-pills">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`time-pill ${timeControl === opt.value ? 'selected' : ''}`}
              onClick={() => setTimeControl(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-label">🎨 Giao diện bàn cờ:</div>
        <div className="theme-pills">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`theme-pill ${theme === opt.value ? 'selected' : ''}`}
              onClick={() => handleTheme(opt.value)}
              title={opt.label}
            >
              <span className="theme-swatch" style={{ background: opt.bg }} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="lobby-bg">
      <header className="lobby-header">
        <div className="lobby-logo">
          <span>♟</span>
          <span>Cờ Tướng Online</span>
        </div>
        <div className="lobby-user">
          <span className="user-badge">👤 {user.username}</span>
          <button className="btn-ghost" onClick={onShowScoreboard}>🏆 Bảng xếp hạng</button>
          <button className="btn-ghost danger" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <main className="lobby-main">
        {tab === 'home' && (
          <div className="lobby-home">
            <h2>Xin chào, <span>{user.username}</span>!</h2>
            <p>Chọn chế độ chơi:</p>
            <div className="mode-cards">
              <div className="mode-card" onClick={() => setTab('ai')}>
                <div className="mode-icon">🤖</div>
                <h3>Chơi với máy</h3>
                <p>Thử thách AI với 3 mức độ khó</p>
              </div>
              <div className="mode-card" onClick={() => setTab('online')}>
                <div className="mode-icon">🌐</div>
                <h3>Chơi Online</h3>
                <p>Thi đấu với người chơi khác</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="lobby-section">
            <button className="btn-back" onClick={() => setTab('home')}>← Quay lại</button>
            <h2>Chơi với máy</h2>
            <p className="section-desc">Chọn mức độ khó:</p>
            <div className="diff-cards">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <div
                  key={d}
                  className={`diff-card ${diff === d ? 'selected' : ''}`}
                  onClick={() => setDiff(d)}
                >
                  <div className="diff-label">{DIFF_LABELS[d]}</div>
                  <div className="diff-desc">{DIFF_DESC[d]}</div>
                </div>
              ))}
            </div>
            {settingsSection}
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => onPlayAI(diff, timeControl)}>
              Bắt đầu chơi
            </button>
          </div>
        )}

        {tab === 'online' && (
          <div className="lobby-section">
            <button className="btn-back" onClick={() => setTab('home')}>← Quay lại</button>
            <h2>Chơi Online</h2>
            {settingsSection}
            <div className="online-options" style={{ marginTop: 20 }}>
              <div className="online-card">
                <h3>🆕 Tạo phòng mới</h3>
                <p>Tạo phòng và gửi mã cho bạn bè</p>
                <button className="btn-primary" onClick={() => onCreateRoom(timeControl)}>Tạo phòng</button>
              </div>
              <div className="online-divider">HOẶC</div>
              <div className="online-card">
                <h3>🔗 Vào phòng</h3>
                <p>Nhập mã phòng từ bạn bè</p>
                <input
                  type="text" value={roomInput}
                  onChange={e => { setRoomInput(e.target.value.toUpperCase()); setRoomError(''); }}
                  placeholder="Mã phòng (6 ký tự)"
                  maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                {roomError && <div className="form-error">{roomError}</div>}
                <button className="btn-primary" onClick={handleJoin}>Vào phòng</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
