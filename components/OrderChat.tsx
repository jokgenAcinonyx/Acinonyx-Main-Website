import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ShieldAlert } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id?: number;
  session_id: number;
  sender_id: number;
  sender_username?: string;
  message: string;
  created_at: string;
}

interface OrderChatProps {
  sessionId: number;
  userId: number;
  username: string;
  isActive: boolean; // false when order is completed/cancelled
}

export default function OrderChat({ sessionId, userId, username, isActive }: OrderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch existing messages on mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetchWithAuth(`/api/orders/${sessionId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('[OrderChat] Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [sessionId]);

  // Socket.io connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-order-chat', String(sessionId));
    });

    socket.on('new-order-message', (msg: ChatMessage) => {
      if (msg.session_id === sessionId) {
        setMessages((prev) => {
          // Avoid duplicates
          const exists = prev.some(
            (m) => m.sender_id === msg.sender_id && m.created_at === msg.created_at && m.message === msg.message
          );
          if (exists) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => {
      socket.emit('leave-order-chat', String(sessionId));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending || !isActive) return;

    setSending(true);
    try {
      socketRef.current?.emit('send-order-message', {
        sessionId,
        senderId: userId,
        message: trimmed,
      });
      setNewMessage('');
    } catch (err) {
      console.error('[OrderChat] Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Group messages by date
  const groupedByDate: { date: string; messages: ChatMessage[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = formatDate(msg.created_at);
    if (d !== lastDate) {
      groupedByDate.push({ date: d, messages: [msg] });
      lastDate = d;
    } else {
      groupedByDate[groupedByDate.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="bg-bg-main/50 rounded-2xl border border-border-main overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-main bg-bg-sidebar/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-primary/10 flex items-center justify-center text-orange-primary">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">Chat Pesanan</h3>
            <p className="text-[10px] text-text-muted">Order #{sessionId}</p>
          </div>
        </div>
        {!isActive && (
          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20 uppercase tracking-widest">
            Berakhir
          </span>
        )}
        {isActive && (
          <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20 uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Aktif
          </span>
        )}
      </div>

      {/* Censorship warning */}
      <div className="px-4 py-2 bg-orange-primary/5 border-b border-orange-primary/10 flex items-center gap-2">
        <ShieldAlert size={12} className="text-orange-primary flex-shrink-0" />
        <p className="text-[10px] text-orange-primary/80">
          Nomor telepon dan gambar otomatis disensor demi keamanan transaksi.
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-[280px] max-h-[400px]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="w-6 h-6 border-2 border-orange-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <MessageSquare size={32} className="text-text-muted/30 mb-3" />
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-1">Belum ada pesan</p>
            <p className="text-[10px] text-text-muted/60">Mulai percakapan dengan partner Anda.</p>
          </div>
        ) : (
          groupedByDate.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border-main" />
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{group.date}</span>
                <div className="flex-1 h-px bg-border-main" />
              </div>
              {group.messages.map((msg, mi) => {
                const isOwn = msg.sender_id === userId;
                return (
                  <div
                    key={msg.id || `${gi}-${mi}`}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-orange-primary text-black rounded-br-md'
                          : 'bg-bg-sidebar border border-border-main text-text-main rounded-bl-md'
                      }`}
                    >
                      {!isOwn && msg.sender_username && (
                        <p className="text-[10px] font-bold text-orange-primary mb-0.5">{msg.sender_username}</p>
                      )}
                      <p className={`text-sm leading-relaxed break-words ${isOwn ? 'text-black' : 'text-text-main'}`}>
                        {msg.message}
                      </p>
                      <p className={`text-[9px] mt-1 text-right ${isOwn ? 'text-black/50' : 'text-text-muted/50'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border-main bg-bg-sidebar/50">
        {isActive ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              maxLength={1000}
              className="flex-1 bg-bg-main border border-border-main rounded-xl px-4 py-3 text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="w-11 h-11 rounded-xl bg-orange-primary text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100 shadow-lg shadow-orange-primary/10"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Chat telah berakhir</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">Pesanan ini sudah selesai atau dibatalkan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
