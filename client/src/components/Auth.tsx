import { useState } from 'react';
import './Auth.css';

interface Props {
  onLogin: (user: { id: number; username: string }, token: string) => void;
}

type Mode = 'login' | 'register' | 'forgot';
type ForgotStep = 'username' | 'answer';

const SECURITY_QUESTIONS = [
  'Tên thú cưng đầu tiên của bạn?',
  'Trường tiểu học bạn đã học?',
  'Tên thành phố bạn sinh ra?',
  'Món ăn yêu thích của bạn?',
  'Tên người bạn thân nhất thời thơ ấu?',
  'Tên trường đại học bạn đang/đã học?',
  'Biệt danh thời nhỏ của bạn?',
];

export default function Auth({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('login');

  // login / register fields
  const [username, setUsername]             = useState('');
  const [password, setPassword]             = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer]   = useState('');

  // forgot password fields
  const [forgotStep, setForgotStep]           = useState<ForgotStep>('username');
  const [forgotUsername, setForgotUsername]   = useState('');
  const [forgotQuestion, setForgotQuestion]   = useState('');
  const [forgotAnswer, setForgotAnswer]       = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function resetAll() {
    setUsername(''); setPassword(''); setSecurityAnswer('');
    setForgotStep('username'); setForgotUsername(''); setForgotQuestion('');
    setForgotAnswer(''); setNewPassword(''); setConfirmPassword('');
    setError(''); setSuccess('');
  }

  function switchMode(m: Mode) { resetAll(); setMode(m); }

  // ── Login / Register ────────────────────────────────────────────────────────
  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const body: Record<string, string> = { username, password };
      if (mode === 'register') {
        body.securityQuestion = securityQuestion;
        body.securityAnswer   = securityAnswer;
      }
      const res  = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Có lỗi xảy ra'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch {
      setError('Không kết nối được server');
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot — Step 1: get security question ──────────────────────────────────
  async function submitForgotStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`/api/auth/security-question?username=${encodeURIComponent(forgotUsername)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Có lỗi xảy ra'); return; }
      setForgotQuestion(data.securityQuestion);
      setForgotStep('answer');
    } catch {
      setError('Không kết nối được server');
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot — Step 2: verify answer + reset ──────────────────────────────────
  async function submitForgotStep2(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Mật khẩu xác nhận không khớp'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, securityAnswer: forgotAnswer, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Có lỗi xảy ra'); return; }
      setSuccess('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.');
      setTimeout(() => switchMode('login'), 2000);
    } catch {
      setError('Không kết nối được server');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-title">
          <span className="auth-icon">♟</span>
          <h1>Cờ Tướng Online</h1>
        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
              Đăng nhập
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
              Đăng ký
            </button>
          </div>
        )}

        {/* ── LOGIN / REGISTER ── */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={submitAuth} className="auth-form">
            <div className="form-group">
              <label>Tên đăng nhập</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập" autoFocus required />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu" required />
            </div>

            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label>Câu hỏi bảo mật</label>
                  <select value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)}>
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Câu trả lời</label>
                  <input type="text" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)}
                    placeholder="Nhập câu trả lời bảo mật" required />
                  <span className="field-hint">Không phân biệt hoa/thường</span>
                </div>
              </>
            )}

            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>

            {mode === 'login' && (
              <button type="button" className="btn-forgot" onClick={() => switchMode('forgot')}>
                Quên mật khẩu?
              </button>
            )}
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <div className="auth-form">
            <div className="forgot-header">
              <button className="btn-back-text" onClick={() => switchMode('login')}>← Quay lại</button>
              <h3>Đặt lại mật khẩu</h3>
              <div className="forgot-steps">
                <span className={forgotStep === 'username' ? 'step active' : 'step done'}>1</span>
                <span className="step-line" />
                <span className={forgotStep === 'answer' ? 'step active' : 'step'}>2</span>
              </div>
            </div>

            {forgotStep === 'username' && (
              <form onSubmit={submitForgotStep1}>
                <div className="form-group">
                  <label>Tên đăng nhập</label>
                  <input type="text" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập của bạn" autoFocus required />
                </div>
                {error && <div className="auth-error">{error}</div>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Đang kiểm tra...' : 'Tiếp tục'}
                </button>
              </form>
            )}

            {forgotStep === 'answer' && (
              <form onSubmit={submitForgotStep2}>
                <div className="security-question-box">
                  <span className="sq-label">Câu hỏi bảo mật:</span>
                  <span className="sq-text">{forgotQuestion}</span>
                </div>
                <div className="form-group">
                  <label>Câu trả lời</label>
                  <input type="text" value={forgotAnswer} onChange={e => setForgotAnswer(e.target.value)}
                    placeholder="Nhập câu trả lời" autoFocus required />
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự" required />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu mới</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới" required />
                </div>
                {error   && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">{success}</div>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                </button>
                <button type="button" className="btn-back-text"
                  onClick={() => { setForgotStep('username'); setError(''); }}>
                  ← Nhập lại username
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
