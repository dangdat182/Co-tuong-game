import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');
const dbPath  = path.join(dataDir, 'db.json');

export interface User {
  id: number;
  username: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string; // hashed
  createdAt: string;
}
interface Score { userId: number; wins: number; losses: number; draws: number; }

interface DbData {
  users: User[];
  scores: Score[];
  nextUserId: number;
}

function load(): DbData {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath))  return { users: [], scores: [], nextUserId: 1 };
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function save(data: DbData) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const db = {
  // ── users ──────────────────────────────────────────────────────────────────
  insertUser(username: string, password: string, securityQuestion: string, securityAnswer: string): number {
    const data = load();
    if (data.users.some(u => u.username === username))
      throw new Error('UNIQUE constraint failed: users.username already exists');
    const id = data.nextUserId++;
    data.users.push({ id, username, password, securityQuestion, securityAnswer, createdAt: new Date().toISOString() });
    save(data);
    return id;
  },

  getUserByUsername(username: string): User | null {
    return load().users.find(u => u.username === username) ?? null;
  },

  updatePassword(username: string, hashedPassword: string): boolean {
    const data = load();
    const user = data.users.find(u => u.username === username);
    if (!user) return false;
    user.password = hashedPassword;
    save(data);
    return true;
  },

  // ── scores ─────────────────────────────────────────────────────────────────
  insertScore(userId: number): void {
    const data = load();
    data.scores.push({ userId, wins: 0, losses: 0, draws: 0 });
    save(data);
  },

  getScoreByUserId(userId: number): Score | null {
    return load().scores.find(s => s.userId === userId) ?? null;
  },

  incrementScore(userId: number, field: 'wins' | 'losses' | 'draws'): void {
    const data = load();
    const s = data.scores.find(x => x.userId === userId);
    if (s) { s[field]++; save(data); }
  },

  getLeaderboard(): { username: string; wins: number; losses: number; draws: number; points: number }[] {
    const data = load();
    return data.users
      .map(u => {
        const s = data.scores.find(x => x.userId === u.id) ?? { wins: 0, losses: 0, draws: 0 };
        return { username: u.username, wins: s.wins, losses: s.losses, draws: s.draws, points: s.wins * 3 + s.draws };
      })
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .slice(0, 20);
  },

  getUserWithScore(userId: number) {
    const data = load();
    const u = data.users.find(x => x.id === userId);
    const s = data.scores.find(x => x.userId === userId);
    if (!u || !s) return null;
    return { username: u.username, wins: s.wins, losses: s.losses, draws: s.draws, points: s.wins * 3 + s.draws };
  },
};

export default db;
