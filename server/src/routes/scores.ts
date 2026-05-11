import { Router, Response } from 'express';
import db from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/leaderboard', (_req, res: Response) => {
  res.json(db.getLeaderboard());
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json(db.getUserWithScore(req.user!.userId) ?? null);
});

router.post('/update', authenticate, (req: AuthRequest, res: Response) => {
  const { result } = req.body as { result: 'win' | 'loss' | 'draw' };
  if (!['win', 'loss', 'draw'].includes(result)) {
    res.status(400).json({ error: 'Kết quả không hợp lệ' }); return;
  }
  const field = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
  db.incrementScore(req.user!.userId, field);
  res.json(db.getScoreByUserId(req.user!.userId));
});

export default router;
