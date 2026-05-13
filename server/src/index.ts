import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth';
import scoresRouter from './routes/scores';
import aiRouter from './routes/ai';
import gamesRouter from './routes/games';
import { setupSocketHandlers } from './socket/gameHandler';

const isProd = process.env.NODE_ENV === 'production';

// CORS: dev = localhost, prod = domain thật từ CLIENT_URL
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.CLIENT_URL) allowedOrigins.push(process.env.CLIENT_URL);

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: isProd ? process.env.CLIENT_URL || true : allowedOrigins, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: isProd ? process.env.CLIENT_URL || true : allowedOrigins }));
app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/ai', aiRouter);
app.use('/api/games', gamesRouter);
app.get('/api/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

setupSocketHandlers(io);

// Production: serve built React app từ client/dist/
if (isProd) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — mọi route không khớp API đều trả index.html
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});
