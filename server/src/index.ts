import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRouter from './routes/auth';
import scoresRouter from './routes/scores';
import aiRouter from './routes/ai';
import gamesRouter from './routes/games';
import { setupSocketHandlers } from './socket/gameHandler';

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], methods: ['GET', 'POST'] },
});

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/ai', aiRouter);
app.use('/api/games', gamesRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
