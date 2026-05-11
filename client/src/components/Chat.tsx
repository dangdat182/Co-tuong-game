import { useState, useRef, useEffect } from 'react';
import './Chat.css';

export interface ChatMsg {
  username: string;
  message: string;
  time: number;
}

interface Props {
  messages: ChatMsg[];
  onSend: (msg: string) => void;
  myUsername: string;
}

export default function Chat({ messages, onSend, myUsername }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    onSend(msg);
    setInput('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-title">💬 Chat</div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Chưa có tin nhắn</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.username === myUsername ? 'me' : 'them'}`}>
            <span className="chat-name">{m.username === myUsername ? 'Bạn' : m.username}</span>
            <span className="chat-text">{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={120}
        />
        <button type="submit" disabled={!input.trim()}>➤</button>
      </form>
    </div>
  );
}
