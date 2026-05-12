import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import Scoreboard from './components/Scoreboard';
import { AIGame, OnlineGame, WaitingRoom, SpectatorGame, MatchmakingRoom } from './components/Game';
import GameHistory from './components/GameHistory';
import socket from './socket';
import { Color } from './game/rules';
import './App.css';

type Difficulty = 'easy' | 'normal' | 'hard';
interface User { id: number; username: string; }

interface GameStartData {
  board: any;
  turn: Color;
  players: any;
  timeControl: number;
  timeLeft: { red: number; black: number };
}

type View =
  | { name: 'auth' }
  | { name: 'lobby' }
  | { name: 'scoreboard' }
  | { name: 'gameHistory' }
  | { name: 'ai'; difficulty: Difficulty; timeControl: number }
  | { name: 'waiting'; timeControl: number }
  | { name: 'matchmaking'; timeControl: number }
  | { name: 'online'; roomId: string; myColor: Color; initialData: GameStartData }
  | { name: 'spectating'; roomId: string; initialData: any; initialMoves: any[] };

export default function App() {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [view, setView]   = useState<View>({ name: 'auth' });
  const [pendingJoin, setPendingJoin] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('join');
    if (room) window.history.replaceState({}, '', window.location.pathname);
    return room ? room.toUpperCase() : null;
  });

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser  = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
        setView({ name: 'lobby' });
      } catch { /* ignore malformed */ }
    }
  }, []);

  // Auto-join khi mở link ?join=CODE
  useEffect(() => {
    if (user && pendingJoin) {
      const roomId = pendingJoin;
      setPendingJoin(null);
      handleJoinRoom(roomId);
    }
  }, [user, pendingJoin]); // eslint-disable-line

  function handleLogin(u: User, t: string) {
    setUser(u); setToken(t);
    setView({ name: 'lobby' });
  }

  function handleLogout() {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setUser(null); setToken('');
    socket.disconnect();
    setView({ name: 'auth' });
  }

  function handleJoinRoom(roomId: string) {
    if (!user) return;
    let capturedColor: Color = 'black';

    const doJoin = () => {
      socket.emit('join_room', { roomId, userId: user.id, username: user.username });
    };

    socket.once('room_joined', (data: { roomId: string; color: Color }) => {
      capturedColor = data.color;
    });
    socket.once('game_start', (data: GameStartData) => {
      setView({ name: 'online', roomId, myColor: capturedColor, initialData: data });
    });
    socket.once('error', (data: { message: string }) => {
      alert(data.message);
      socket.off('game_start');
      socket.disconnect();
    });

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      socket.connect();
    }
  }

  function handleWatchRoom(roomId: string) {
    const doWatch = () => {
      socket.emit('watch_room', { roomId: roomId.toUpperCase() });
    };
    socket.once('joined_as_spectator', (data: { roomId: string; room: any; moveHistory: any[] }) => {
      setView({ name: 'spectating', roomId: data.roomId, initialData: data.room, initialMoves: data.moveHistory });
    });
    socket.once('error', (data: { message: string }) => {
      alert(data.message);
    });
    if (socket.connected) {
      doWatch();
    } else {
      socket.once('connect', doWatch);
      socket.connect();
    }
  }

  if (!user) return <Auth onLogin={handleLogin} />;

  const lobby = (
    <Lobby
      user={user}
      token={token}
      onPlayAI={(d, tc) => setView({ name: 'ai', difficulty: d, timeControl: tc })}
      onCreateRoom={(tc) => setView({ name: 'waiting', timeControl: tc })}
      onJoinRoom={handleJoinRoom}
      onWatchRoom={handleWatchRoom}
      onMatchmaking={(tc) => setView({ name: 'matchmaking', timeControl: tc })}
      onShowScoreboard={() => setView({ name: 'scoreboard' })}
      onShowGameHistory={() => setView({ name: 'gameHistory' })}
      onLogout={handleLogout}
    />
  );

  switch (view.name) {
    case 'auth':
      return <Auth onLogin={handleLogin} />;

    case 'lobby':
      return lobby;

    case 'scoreboard':
      return <Scoreboard onBack={() => setView({ name: 'lobby' })} currentUser={user.username} />;

    case 'gameHistory':
      return <GameHistory token={token} currentUser={user.username} onBack={() => setView({ name: 'lobby' })} />;

    case 'ai':
      return (
        <AIGame
          user={user}
          token={token}
          difficulty={view.difficulty}
          timeControl={view.timeControl}
          onBack={() => setView({ name: 'lobby' })}
        />
      );

    case 'waiting':
      return (
        <WaitingRoom
          user={user}
          token={token}
          timeControl={view.timeControl}
          onGameStart={(roomId, myColor, data) =>
            setView({ name: 'online', roomId, myColor, initialData: data })
          }
          onBack={() => setView({ name: 'lobby' })}
        />
      );

    case 'matchmaking':
      return (
        <MatchmakingRoom
          user={user}
          timeControl={view.timeControl}
          onGameStart={(roomId, myColor, data) =>
            setView({ name: 'online', roomId, myColor, initialData: data })
          }
          onBack={() => setView({ name: 'lobby' })}
        />
      );

    case 'online':
      return (
        <OnlineGame
          user={user}
          token={token}
          roomId={view.roomId}
          myColor={view.myColor}
          initialData={view.initialData}
          onBack={() => setView({ name: 'lobby' })}
        />
      );

    case 'spectating':
      return (
        <SpectatorGame
          roomId={view.roomId}
          initialData={view.initialData}
          initialMoves={view.initialMoves}
          onBack={() => setView({ name: 'lobby' })}
        />
      );

    default:
      return lobby;
  }
}
