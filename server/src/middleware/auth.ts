import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set. Copy server/.env.example to server/.env');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_dotenv';

export interface AuthRequest extends Request {
  user?: { userId: number; username: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
