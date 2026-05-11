import { Router, Request, Response } from 'express';
import { getBestMove, Difficulty } from '../ai/engine';
import { Board } from '../game/rules';

const router = Router();

router.post('/move', (req: Request, res: Response) => {
  const { board, color, difficulty } = req.body as {
    board: Board;
    color: 'red' | 'black';
    difficulty: Difficulty;
  };
  if (!board || !color || !difficulty) {
    res.status(400).json({ error: 'Thiếu dữ liệu' }); return;
  }
  try {
    const move = getBestMove(board, color, difficulty);
    res.json({ move });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi AI' });
  }
});

export default router;
