import { Router } from 'express';
import db from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/my', authenticate, (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const games = db.getGamesByUserId(userId);
  res.json(games);
});

export default router;
