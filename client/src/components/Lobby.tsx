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
  onWatchRoom: (roomId: string) => void;
  onMatchmaking: (timeControl: number) => void;
  onShowScoreboard: () => void;
  onShowGameHistory: () => void;
  onLogout: () => void;
}

const DIFF_LABELS: Record<Difficulty, string> = { easy: 'Tân Thủ', normal: 'Kiếm Khách', hard: 'Tông Sư' };
const DIFF_ICONS: Record<Difficulty, string>  = { easy: '🪄', normal: '⚔️', hard: '🔱' };
const DIFF_DESC: Record<Difficulty, string> = {
  easy:   'Vừa bước vào giang hồ — học hỏi từng bước',
  normal: 'Kiếm pháp điêu luyện — một trận đấu thú vị',
  hard:   'Đỉnh cao võ học — không dễ để đánh bại',
};

const TIME_OPTIONS = [
  { label: '∞',       value: 0    },
  { label: '5 phút',  value: 300  },
  { label: '10 phút', value: 600  },
  { label: '15 phút', value: 900  },
  { label: '30 phút', value: 1800 },
];

const THEME_OPTIONS: { label: string; value: BoardTheme; bg: string }[] = [
  { label: 'Cổ Trận',   value: 'classic', bg: '#c8944a' },
  { label: 'Hắc Dạ',   value: 'dark',    bg: '#0d1e38' },
  { label: 'Lục Lâm',  value: 'jade',    bg: '#6aaa60' },
  { label: 'Trùng Thiên', value: 'blue',  bg: '#5090d0' },
];

export default function Lobby({ user, onPlayAI, onCreateRoom, onJoinRoom, onWatchRoom, onMatchmaking, onShowScoreboard, onShowGameHistory, onLogout }: Props) {
  const [tab, setTab]         = useState<'home' | 'ai' | 'online'>('home');
  const [diff, setDiff]       = useState<Difficulty>('normal');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [watchInput, setWatchInput] = useState('');
  const [watchError, setWatchError] = useState('');
  const [timeControl, setTimeControl] = useState(0);
  const [theme, setTheme] = useState<BoardTheme>(
    () => (localStorage.getItem('board_theme') as BoardTheme) || 'dark',
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

  function handleWatch() {
    const id = watchInput.trim().toUpperCase();
    if (id.length !== 6) { setWatchError('Mã phòng phải gồm 6 ký tự'); return; }
    setWatchError('');
    onWatchRoom(id);
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
          <span className="lobby-logo-icon">將</span>
          <div className="lobby-logo-text">
            <span className="lobby-logo-main">Cờ Tướng Online</span>
            <span className="lobby-logo-sub">Võ Đài Giang Hồ</span>
          </div>
        </div>
        <div className="lobby-user">
          <span className="user-badge">👤 {user.username}</span>
          <button className="btn-ghost" onClick={onShowScoreboard}>🏆 Bảng xếp hạng</button>
          <button className="btn-ghost" onClick={onShowGameHistory}>📚 Lịch sử ván</button>
          <button className="btn-ghost danger" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <main className="lobby-main">
        {tab === 'home' && (
          <div className="lobby-home">
            <p className="home-greeting">Giang Hồ Chào Đón</p>
            <h2>Cao Thủ <span>{user.username}</span></h2>
            <p className="home-desc">Chọn chế độ thi đấu của bạn</p>
            <div className="mode-cards">
              <div className="mode-card" onClick={() => setTab('ai')}>
                <span className="mode-icon">🤖</span>
                <h3>Luyện Đấu với Máy</h3>
                <p>Thách thức AI ở 3 cấp độ võ công</p>
              </div>
              <div className="mode-card" onClick={() => setTab('online')}>
                <span className="mode-icon">⚔️</span>
                <h3>Giang Hồ Online</h3>
                <p>Thi đấu với cao thủ khắp nơi</p>
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
                  <span className="diff-icon">{DIFF_ICONS[d]}</span>
                  <div className="diff-text">
                    <div className="diff-label">{DIFF_LABELS[d]}</div>
                    <div className="diff-desc">{DIFF_DESC[d]}</div>
                  </div>
                  {diff === d && <span className="diff-selected-badge" />}
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
                <h3>🔍 Tìm đối thủ</h3>
                <p>Ghép cặp tự động với người chơi khác</p>
                <button className="btn-primary" onClick={() => onMatchmaking(timeControl)}>Tìm đối thủ</button>
              </div>
              <div className="online-divider">HOẶC</div>
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
              <div className="online-divider">HOẶC</div>
              <div className="online-card">
                <h3>👁 Xem ván đấu</h3>
                <p>Nhập mã phòng để theo dõi ván đang diễn ra</p>
                <input
                  type="text" value={watchInput}
                  onChange={e => { setWatchInput(e.target.value.toUpperCase()); setWatchError(''); }}
                  placeholder="Mã phòng (6 ký tự)"
                  maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && handleWatch()}
                />
                {watchError && <div className="form-error">{watchError}</div>}
                <button className="btn-secondary" onClick={handleWatch}>Xem ván</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
