import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id?: number;
  session_id: number;
  sender_id: number;
  sender_username?: string;
  sender_avatar?: string | null;
  message: string;
  read_status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  read_at?: string | null;
  created_at: string;
}

interface OrderChatProps {
  sessionId: number;
  userId: number;
  username: string;
  isActive: boolean;
}

// Read receipt checkmarks
function ReadReceipt({ status }: { status?: string }) {
  if (!status || status === 'sending') {
    return <span className="text-text-muted/40 text-[10px]">&#10003;</span>;
  }
  if (status === 'failed') {
    return <span className="text-red-500 text-[10px] font-bold">!</span>;
  }
  if (status === 'read') {
    return <span className="text-green-400 text-[10px] tracking-[-3px]">&#10003;&#10003;</span>;
  }
  if (status === 'delivered') {
    return <span className="text-blue-400 text-[10px] tracking-[-3px]">&#10003;&#10003;</span>;
  }
  // sent
  return <span className="text-text-muted text-[10px]">&#10003;</span>;
}

export default function OrderChat({ sessionId, userId, username, isActive }: OrderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const initialFetchDone = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior });
  };

  // Fetch messages (paginated — page 1 = latest 20)
  const fetchMessages = useCallback(async (pageNum: number, append: 'prepend' | 'replace' = 'replace') => {
    try {
      const res = await fetchWithAuth(`/api/orders/${sessionId}/chat?page=${pageNum}`);
      if (res.ok) {
        const data = await res.json();
        const newMsgs: ChatMessage[] = data.messages || [];
        setTotalPages(data.totalPages || 1);
        setIsLocked(data.isLocked || false);
        if (data.partner) setPartner(data.partner);
        if (append === 'prepend') {
          setMessages(prev => [...newMsgs, ...prev]);
        } else {
          setMessages(newMsgs);
        }
      }
    } catch (err) {
      console.error('[OrderChat] Failed to fetch:', err);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMessages(1, 'replace');
      setPage(1);
      setLoading(false);
      initialFetchDone.current = true;
    };
    init();
  }, [sessionId, fetchMessages]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading && initialFetchDone.current) {
      setTimeout(() => scrollToBottom('instant'), 50);
    }
  }, [loading]);

  // Load older messages (scroll-to-top pagination)
  const loadOlderMessages = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const nextPage = page + 1;
    await fetchMessages(nextPage, 'prepend');
    setPage(nextPage);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
    });
  };

  // Mark messages as read
  const markAsRead = useCallback(() => {
    socketRef.current?.emit('mark-read', { sessionId, userId });
  }, [sessionId, userId]);

  // Socket.io connection
  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-order-chat', String(sessionId));
    });

    socket.on('new-order-message', (msg: ChatMessage & { tempId?: number }) => {
      if (msg.session_id === sessionId) {
        setMessages(prev => {
          // Replace optimistic temp message if this is our own message echoed back
          const withoutTemp = msg.tempId ? prev.filter(m => m.id !== msg.tempId) : prev;
          // Dedup by real id
          if (withoutTemp.some(m => m.id != null && msg.id != null && m.id === msg.id && m.id > 0)) return withoutTemp;
          return [...withoutTemp, msg];
        });
        if (msg.sender_id !== userId) {
          socket.emit('mark-read', { sessionId, userId });
        }
      }
    });

    socket.on('message-error', (data: { tempId?: number; reason?: string }) => {
      if (data.tempId) {
        setMessages(prev => prev.map(m =>
          m.id === data.tempId ? { ...m, read_status: 'failed' } : m
        ));
      }
    });

    socket.on('message-status-update', (data: { message_id: number; status: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, read_status: data.status as any } : m
      ));
    });

    socket.on('messages-read', (data: { session_id: number; reader_id: number }) => {
      if (data.session_id === sessionId && data.reader_id !== userId) {
        setMessages(prev => prev.map(m =>
          m.sender_id === userId && m.read_status !== 'read'
            ? { ...m, read_status: 'read', read_at: new Date().toISOString() }
            : m
        ));
      }
    });

    return () => {
      socket.emit('leave-order-chat', String(sessionId));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, userId]);

  // Auto-scroll when new messages arrive (only if near bottom)
  useEffect(() => {
    if (messages.length > 0 && initialFetchDone.current) {
      const container = containerRef.current;
      if (container) {
        const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (atBottom) scrollToBottom();
      }
    }
  }, [messages]);

  // Mark as read on mount
  useEffect(() => {
    if (!loading && messages.length > 0) markAsRead();
  }, [loading, markAsRead, messages.length]);

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending || isLocked) return;

    setSending(true);
    const tempId = -(Date.now());
    const tempMsg: ChatMessage = {
      id: tempId,
      session_id: sessionId,
      sender_id: userId,
      sender_username: username,
      message: trimmed,
      read_status: 'sending',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');

    socketRef.current?.emit('send-order-message', {
      sessionId, senderId: userId, message: trimmed, tempId,
    });

    // If server doesn't confirm within 6s, mark as failed (not silently removed)
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, read_status: 'failed' } : m
      ));
    }, 6000);

    setSending(false);
    setTimeout(() => scrollToBottom(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (ds: string) => {
    try { return new Date(ds).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };
  const formatDate = (ds: string) => {
    try { return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  // Group by date
  const groups: { date: string; msgs: ChatMessage[] }[] = [];
  let ld = '';
  for (const m of messages) {
    const d = formatDate(m.created_at);
    if (d !== ld) { groups.push({ date: d, msgs: [m] }); ld = d; }
    else groups[groups.length - 1].msgs.push(m);
  }

  // Chat is active for: upcoming, ongoing, pending_completion, pending_cancellation
  const chatLocked = isLocked || !isActive;

  return (
    <div className="bg-bg-main/50 rounded-2xl border border-border-main overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border-main bg-bg-sidebar/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {partner?.avatar_url ? (
            <img src={partner.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border-main" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-primary/10 border border-orange-primary/20 flex items-center justify-center text-orange-primary text-xs font-bold uppercase">
              {(partner?.username || '?')[0]}
            </div>
          )}
          <div>
            <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">
              {partner?.username || partner?.full_name || 'Chat Pesanan'}
            </h3>
            <p className="text-[10px] text-text-muted">Order #{sessionId}</p>
          </div>
        </div>
        {chatLocked ? (
          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20 uppercase tracking-widest">Terkunci</span>
        ) : (
          <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20 uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Aktif
          </span>
        )}
      </div>

      {/* Censorship warning */}
      <div className="px-4 py-2 bg-orange-primary/5 border-b border-orange-primary/10">
        <p className="text-[10px] text-orange-primary/80">Nomor telepon dan gambar otomatis disensor demi keamanan transaksi.</p>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-1 min-h-[280px] max-h-[400px]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop === 0 && page < totalPages && !loadingMore) loadOlderMessages();
        }}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-orange-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {page < totalPages && !loadingMore && (
          <button onClick={loadOlderMessages} className="w-full text-center py-2 text-[10px] text-text-muted hover:text-orange-primary font-bold uppercase tracking-widest transition-colors">
            Muat pesan sebelumnya
          </button>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="w-6 h-6 border-2 border-orange-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-1">Belum ada pesan</p>
            <p className="text-[10px] text-text-muted/60">Mulai percakapan dengan partner Anda.</p>
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border-main" />
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{group.date}</span>
                <div className="flex-1 h-px bg-border-main" />
              </div>
              {group.msgs.map((msg, mi) => {
                const isOwn = msg.sender_id === userId;
                return (
                  <div key={msg.id || `${gi}-${mi}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
                    {/* Avatar for received */}
                    {!isOwn && (
                      <div className="shrink-0 mr-2 mt-auto">
                        {msg.sender_avatar ? (
                          <img src={msg.sender_avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-border-main" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-bg-sidebar border border-border-main flex items-center justify-center text-text-muted text-[10px] font-bold uppercase">
                            {(msg.sender_username || '?')[0]}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[75%]`}>
                      {/* Time (above bubble) */}
                      <p className={`text-[9px] text-text-muted/50 mb-0.5 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                      {/* Username for received */}
                      {!isOwn && msg.sender_username && (
                        <p className="text-[10px] font-bold text-orange-primary mb-0.5 px-1">{msg.sender_username}</p>
                      )}
                      {/* Bubble */}
                      <div className={`px-3 py-2 rounded-2xl ${isOwn ? 'bg-orange-primary text-black rounded-br-md' : 'bg-bg-sidebar border border-border-main text-text-main rounded-bl-md'}`}>
                        <p className={`text-sm leading-relaxed break-words ${isOwn ? 'text-black' : 'text-text-main'}`}>{msg.message}</p>
                      </div>
                      {/* Read receipt (own messages only) */}
                      {isOwn && (
                        <div className="flex items-center justify-end gap-1 mt-0.5 pr-1">
                          <ReadReceipt status={msg.read_status} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-3 sm:px-4 py-3 border-t border-border-main bg-bg-sidebar/50">
        {chatLocked ? (
          <div className="text-center py-2">
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Chat Terkunci</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">Pesanan ini sudah selesai atau dibatalkan. Riwayat chat tetap tersimpan.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={markAsRead}
              placeholder="Ketik pesan..."
              maxLength={1000}
              className="flex-1 bg-bg-main border border-border-main rounded-xl px-4 py-3 text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="w-11 h-11 rounded-xl bg-orange-primary text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100 shadow-lg shadow-orange-primary/10"
            >
              <span className="font-bold text-sm">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
