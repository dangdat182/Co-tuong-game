import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { JWT_SECRET } from '../middleware/auth';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;
  if (!username || !password || !securityQuestion || !securityAnswer)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-20 ký tự' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự' });
  if (securityAnswer.trim().length < 1)
    return res.status(400).json({ error: 'Câu trả lời bảo mật không được để trống' });

  try {
    const [hashedPw, hashedAns] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(securityAnswer.trim().toLowerCase(), 10),
    ]);
    const id = db.insertUser(username, hashedPw, securityQuestion, hashedAns);
    db.insertScore(id);
    const token = jwt.sign({ userId: id, username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id, username } });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE') || err.message?.includes('already exists'))
      return res.status(400).json({ error: 'Tên đăng nhập đã được sử dụng' });
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Cần nhập tên đăng nhập và mật khẩu' });

  try {
    const user = db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, username: user.username } });
  } catch {
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Step 1: get security question for a username
router.get('/security-question', (req, res) => {
  const { username } = req.query as { username: string };
  if (!username) return res.status(400).json({ error: 'Thiếu tên đăng nhập' });

  const user = db.getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'Tên đăng nhập không tồn tại' });
  if (!user.securityQuestion) return res.status(400).json({ error: 'Tài khoản này chưa thiết lập câu hỏi bảo mật' });

  return res.json({ securityQuestion: user.securityQuestion });
});

// Step 2: verify answer + reset password
router.post('/reset-password', async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;
  if (!username || !securityAnswer || !newPassword)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });

  try {
    const user = db.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'Tên đăng nhập không tồn tại' });
    if (!user.securityAnswer) return res.status(400).json({ error: 'Tài khoản này chưa thiết lập câu hỏi bảo mật' });

    const valid = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.securityAnswer);
    if (!valid) return res.status(401).json({ error: 'Câu trả lời bảo mật không đúng' });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.updatePassword(username, hashed);
    return res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch {
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

export default router;
