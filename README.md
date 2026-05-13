# Cờ Tướng Online

Game cờ tướng web với chế độ chơi vs AI và chơi online real-time.

## Tính năng

- Đăng ký / đăng nhập / quên mật khẩu (câu hỏi bảo mật)
- Chơi vs AI — 3 mức độ: Tân Thủ / Kiếm Khách / Tông Sư (Minimax + Alpha-Beta)
- **Chọn màu quân vs AI** — Quân Đỏ / Quân Đen / Ngẫu nhiên; bàn cờ tự lật khi chơi Đen
- Chơi online real-time — tạo phòng & mã 6 ký tự, chat trong game
- Timer đếm ngược — ∞ / 5 / 10 / 15 / 30 phút mỗi bên
- Đề nghị hòa, đầu hàng, phát hiện chiếu hết / bế tắc
- Bảng xếp hạng (Thắng×3 + Hòa×1 = Điểm) + stats W/D/L hiển thị ngay trên Lobby
- 4 theme bàn cờ: Cổ Trận / Hắc Dạ / Lục Lâm / Trùng Thiên
- Âm thanh: đi quân, ăn quân, chiếu, thắng/thua/hòa + nút mute
- **Quân bị ăn** — panel hiển thị quân đã ăn được trong cả chế độ vs AI lẫn online
- **Gợi ý nước đi** (vs AI) — nút 💡 tính nước tốt nhất, highlight vàng trên bàn cờ 5 giây
- **Hoàn tác** (vs AI) — lùi 2 nước (nước bạn + nước AI) trong 1 click, phục hồi cả đồng hồ và quân bị ăn
- **Đấu lại** (online) — sau ván kết thúc, gửi đề nghị đấu lại, đối thủ đồng ý thì reset ngay không cần tạo phòng mới
- **Copy link phòng** — tạo link `?join=CODE` gửi bạn bè, click link là vào thẳng (tự đăng nhập xong auto-join)
- **Lịch sử nước đi** — xem lại từng nước đã đi, click vào dòng bất kỳ để xem lại thế cờ tại thời điểm đó
- **Chế độ xem ván** — khán giả nhập mã phòng để theo dõi ván đang diễn ra trong thời gian thực (read-only)
- **Lưu lịch sử ván đấu** — tất cả ván online được lưu vào DB, xem lại từ menu "Lịch sử ván"
- **Matchmaking** — tự động ghép cặp với người chơi đang chờ, không cần biết mã phòng

## Tech Stack

| Phần | Công nghệ |
|---|---|
| Backend | Node.js + Express + Socket.IO + TypeScript |
| Frontend | React 18 + Vite + TypeScript |
| Auth | JWT + bcryptjs |
| Database | JSON file (không cần cài DB) |
| AI | Minimax + Alpha-Beta Pruning |

---

## Yêu cầu

- [Node.js](https://nodejs.org) v18 trở lên
- npm v9 trở lên

---

## Cài đặt

### 1. Clone repo

```bash
git clone https://github.com/dangdat182/Co-tuong-game.git
cd Co-tuong-game
```

### 2. Cài dependencies

```bash
npm run install:all
```

Lệnh này cài đồng thời cho cả root, server và client.

### 3. Cấu hình biến môi trường

```bash
cp server/.env.example server/.env
```

Mở `server/.env` và sửa giá trị:

```env
# JWT secret key — đặt chuỗi ngẫu nhiên dài, ví dụ dùng lệnh:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_random_secret_key_here

# Port server (mặc định 3001, không cần đổi nếu chạy local)
PORT=3001
```

> **Quan trọng:** `server/.env` đã được gitignore, không bao giờ commit file này lên GitHub.

### 4. Chạy game

```bash
npm run dev
```

Mở trình duyệt tại **http://localhost:5173**

---

## Cấu trúc project

```
Co-tuong-game/
├── client/              # React frontend (Vite, port 5173)
│   └── src/
│       ├── components/  # Board, Game, Lobby, Auth, Chat, Scoreboard, MoveHistory, GameHistory
│       ├── game/        # Luật cờ tướng phía client
│       └── utils/       # Âm thanh (Web Audio API)
├── server/              # Express backend (port 3001)
│   ├── src/
│   │   ├── ai/          # Minimax engine
│   │   ├── db/          # JSON file database
│   │   ├── game/        # Luật cờ tướng phía server
│   │   ├── middleware/  # JWT auth
│   │   ├── routes/      # REST API (auth, scores, ai, games)
│   │   └── socket/      # Socket.IO handlers
│   ├── data/            # db.json tự tạo khi chạy lần đầu (gitignored)
│   └── .env.example     # Mẫu biến môi trường
└── package.json         # Root — chạy cả 2 bằng concurrently
```

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy server + client cùng lúc |
| `npm run install:all` | Cài dependencies cho cả 3 package |
| `npm run build` | Build production cho server + client |

Chạy riêng từng phần:

```bash
# Terminal 1 — server (port 3001)
cd server && npm run dev

# Terminal 2 — client (port 5173)
cd client && npm run dev
```

---

## Dừng server

```bash
# Nhấn Ctrl + C trong terminal đang chạy
# Hoặc dừng theo port:
npx kill-port 3001 5173
```

---

## Lưu ý khi deploy lên production

- Đặt `JWT_SECRET` là chuỗi ngẫu nhiên mạnh (tối thiểu 32 ký tự)
- Thư mục `server/data/` cần có quyền ghi (lưu file `db.json`)
- Cập nhật CORS origin trong `server/src/index.ts` theo domain thực tế
- Build trước khi chạy: `npm run build`
