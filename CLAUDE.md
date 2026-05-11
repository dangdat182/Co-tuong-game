# Cờ Tướng Game — Session Summary

## Yêu cầu chính

Xây dựng game Cờ Tướng web hoàn chỉnh gồm:
- Online multiplayer (Socket.IO)
- AI opponent với 3 mức độ khó
- Đăng ký / đăng nhập / đăng xuất tài khoản local
- Scoreboard tính điểm

**Các bug đã fix:**
- Cả hai người chơi bị kẹt ở "Đang chờ đối thủ..." sau khi vào phòng
- Quân đỏ không di chuyển được sau khi game bắt đầu
- Lỗi PowerShell không chạy được script (`Set-ExecutionPolicy`)
- `npm run dev --prefix server` sai cú pháp → đổi thành `npm --prefix server run dev`
- `handleJoinRoom` và `WaitingRoom` không emit event nếu socket đã connected (`socket.once('connect')` không bao giờ fire khi socket đang kết nối sẵn) → fix bằng cách check `socket.connected` trước

**Tính năng đã thêm:**
- Quên mật khẩu (dùng câu hỏi bảo mật)
- ⏱ Timer đếm ngược (client-side cho AI, server-validated cho online)
- 💬 Chat trong game online (Socket.IO)
- 🔊 Âm thanh (move/capture/check/win/lose/draw/tick/chat/drawOffer) + nút mute
- 🎨 Theme bàn cờ 4 loại (classic/dark/jade/blue), lưu localStorage
- 🤝 Đề nghị hòa (offer/accept/decline) với UI overlay
- ⏱ Time control trong Lobby (∞/5/10/15/30 phút)

---

## Khái niệm kỹ thuật chính

- **Luật Cờ Tướng:** Tướng, Sĩ, Tượng, Mã, Xe, Pháo, Tốt — bao gồm luật chiếu tướng bay, qua sông, giới hạn cung
- **AI:** Minimax + alpha-beta pruning, độ sâu 1/3/5 cho dễ/thường/khó, piece-square tables
- **Socket.IO:** Multiplayer real-time
- **React StrictMode:** Double-mount gây race condition với socket cleanup
- **JWT + bcryptjs:** Xác thực (dùng bcryptjs thuần JS, tránh lỗi native build trên Node v24)
- **JSON file database:** Thay thế `better-sqlite3` (không build được trên Node v24)
- **Web Audio API:** Tổng hợp âm thanh theo chương trình
- **SVG rendering:** Bàn cờ và quân cờ dạng SVG với absolute positioning

---

## Cấu trúc file

### Server

| File | Mô tả |
|------|-------|
| `server/src/game/rules.ts` | Luật Cờ Tướng: sinh nước đi hợp lệ, kiểm tra chiếu, `applyMove`, `getLegalMoves`, `createInitialBoard` |
| `server/src/ai/engine.ts` | Minimax + alpha-beta pruning, piece-square tables cho Xe/Pháo/Mã/Tốt |
| `server/src/db/database.ts` | JSON file database (`server/data/db.json`), typed API |
| `server/src/routes/auth.ts` | Đăng ký, đăng nhập, quên mật khẩu (câu hỏi bảo mật) |
| `server/src/routes/scores.ts` | Quản lý điểm số |
| `server/src/routes/ai.ts` | `POST /api/ai/move` — trả về nước đi tốt nhất |
| `server/src/middleware/auth.ts` | JWT middleware |
| `server/src/socket/gameHandler.ts` | Xử lý socket: tạo/vào phòng, đi quân, timer, hòa, chat |
| `server/src/index.ts` | Express server, CORS, Socket.IO, port 3001 |

### Client

| File | Mô tả |
|------|-------|
| `client/src/game/rules.ts` | Bản sao luật phía client (gợi ý nước đi + UI) |
| `client/src/socket.ts` | Khởi tạo socket, `autoConnect: false` |
| `client/src/App.tsx` | State machine điều hướng các view; `View` type có `timeControl` |
| `client/src/components/Game.tsx` | `AIGame` (timer + sounds + mute), `OnlineGame` (timer + sounds + chat + draw offer + mute), `WaitingRoom` (pass timeControl) |
| `client/src/components/Board.tsx` | SVG bàn cờ; export `BoardTheme`; đọc theme từ localStorage |
| `client/src/components/Lobby.tsx` | Chọn độ khó, time control (∞/5/10/15/30 phút), theme bàn cờ |
| `client/src/components/Auth.tsx` | Login / Register / Quên mật khẩu |
| `client/src/components/Chat.tsx` | Panel chat trong game |
| `client/src/components/Chat.css` | Style dark theme cho chat |
| `client/src/utils/sounds.ts` | Web Audio API: move/capture/check/win/lose/draw/tick/chat/drawOffer |

---

## Database API (`database.ts`)

```typescript
db.insertUser(username, password, securityQuestion, securityAnswer): number
db.getUserByUsername(username): User | null
db.updatePassword(username, hashedPassword): boolean
db.insertScore(userId): void
db.getScoreByUserId(userId): Score | null
db.incrementScore(userId, field: 'wins' | 'losses' | 'draws'): void
db.getLeaderboard(): {...}[]
db.getUserWithScore(userId): {...} | null
```

Dữ liệu lưu tại `server/data/db.json`.

---

## View State (`App.tsx`)

```typescript
type View =
  | { name: 'auth' }
  | { name: 'lobby' }
  | { name: 'scoreboard' }
  | { name: 'ai'; difficulty: Difficulty; timeControl: number }
  | { name: 'waiting'; timeControl: number }
  | { name: 'online'; roomId: string; myColor: Color; initialData: GameStartData };

// GameStartData giờ có thêm timeControl và timeLeft từ server
interface GameStartData {
  board: any; turn: Color; players: any;
  timeControl: number; timeLeft: { red: number; black: number };
}
```

---

## Các bug quan trọng đã fix

### 1. Kẹt ở "Đang chờ đối thủ..."
**Nguyên nhân:** Race condition — sự kiện `game_start` của Socket.IO đến trước khi `OnlineGame` mount xong và đăng ký listener.

**Fix:** Buffer dữ liệu `game_start` trước khi mount `OnlineGame`. Player 2 chờ `game_start` (không phải `room_joined`) trước khi chuyển view. `OnlineGame` nhận `initialData` qua props, không lắng nghe `game_start`.

---

### 2. Quân đỏ không đi được
**Nguyên nhân:** React StrictMode double-mount → cleanup gọi `socket.disconnect()` giữa lần mount 1 và 2 → lần mount 2 socket bị ngắt, server từ chối nước đi.

**Fix:** Xóa `disconnect/leave_room` khỏi cleanup. Thêm `socket.connect()` khi effect chạy (idempotent). Dùng pattern `leavingRef` — chỉ disconnect khi user chủ động rời qua `leaveGame()`.

---

### 3. `better-sqlite3` / `bcrypt` không build được trên Node v24
**Fix:** Thay `better-sqlite3` bằng JSON file database tự viết. Thay `bcrypt` bằng `bcryptjs` (thuần JS).

---

### 4. PowerShell không chạy script
**Fix:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

---

## Tính năng đã hoàn thành (2026-05-02)

Tất cả tính năng đã được implement đầy đủ:

- [x] Timer đếm ngược — client-side (AIGame), server-validated (OnlineGame)
- [x] Âm thanh — move/capture/check/win/lose/draw/tick/chat/drawOffer + nút mute
- [x] Chat trong OnlineGame (Socket.IO real-time)
- [x] UI đề nghị hòa — nút + overlay Accept/Decline + thông báo từ chối
- [x] Theme bàn cờ — 4 màu (classic/dark/jade/blue), lưu localStorage
- [x] Time control trong Lobby — ∞/5/10/15/30 phút
- [x] `timeControl` thread qua toàn bộ flow: Lobby → App → WaitingRoom/AIGame → server

## Không còn tính năng nào đang làm dở

---

## Lệnh chạy dự án

```bash
# Cài dependencies
cd server && npm install
cd ../client && npm install

# Chạy dev (mở 2 terminal)
cd server && npm run dev   # port 3001
cd client && npm run dev   # port 5173

# Dừng: Ctrl + C trong mỗi terminal
```

