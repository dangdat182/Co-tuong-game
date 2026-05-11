# Cờ Tướng Online

## Cách chạy

### Cài dependencies (chỉ cần làm 1 lần)
```bash
npm run install:all
```

### Chạy cả server lẫn client cùng lúc
```bash
npm run dev
```
- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

Hoặc chạy riêng:
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

## Cách dừng

**Nếu chạy bằng `npm run dev` (concurrently):** nhấn `Ctrl + C` trong terminal đang chạy là dừng cả hai.

**Nếu chạy riêng từng terminal:** nhấn `Ctrl + C` trong từng terminal.

**Nếu chạy nền và cần dừng thủ công:**
```bash
# Dừng server (port 3001)
npx kill-port 3001

# Dừng client (port 5173)
npx kill-port 5173

# Dừng cả hai cùng lúc
npx kill-port 3001 5173
```

## Tính năng
- Đăng ký / đăng nhập tài khoản local
- Chơi vs AI (Dễ / Bình thường / Khó)
- Chơi online real-time (tạo phòng + mã 6 ký tự)
- Bảng xếp hạng (Thắng×3 + Hòa×1 = Điểm)
- Đầu hàng, phát hiện chiếu hết, lật bàn theo màu quân

## Tech Stack
- **Backend**: Node.js + Express + Socket.IO + TypeScript
- **Frontend**: React + Vite + TypeScript
- **Database**: JSON file (server/data/db.json)
- **Auth**: JWT + bcryptjs
- **AI**: Minimax + Alpha-Beta Pruning (depth 1/3/5)
