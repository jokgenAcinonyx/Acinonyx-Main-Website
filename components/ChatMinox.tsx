import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface Message {
  id: number;
  session_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
  sender_name: string;
  sender_role: string;
}

interface ChatMinoxProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatMinox({ user, isOpen, onClose }: ChatMinoxProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [adminId, setAdminId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'open' | 'closed' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
    }
  }, [isOpen]);

  useEffect(() => {
    if (sessionId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSession = async () => {
    try {
      const res = await fetchWithAuth('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId);
        if (data.adminId) setAdminId(data.adminId);
        setSessionStatus('open');
      }
    } catch (error) {
      console.error('Error starting chat session:', error);
    }
  };

  const fetchMessages = async () => {
    if (!sessionId) return;
    try {
      const res = await fetchWithAuth(`/api/chat/sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !sessionId) return;

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          senderId: user.id,
          receiverId: adminId,
          message: newMessage
        })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="relative w-full max-w-lg bg-bg-sidebar border-t sm:border border-border-main rounded-t-[32px] sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[85vh] sm:h-[600px] mt-auto sm:mt-0"
          >
            {/* Header */}
            <div className="p-6 border-b border-border-main bg-bg-sidebar flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary border border-orange-primary/20">
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main uppercase tracking-tight">Chat Minox</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Tim Support</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-text-muted hover:text-text-main hover:bg-bg-main rounded-xl transition-all"
              >
                <span>×</span>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-bg-main/30">
              <div className="text-center space-y-2 mb-8">
                <div className="inline-block px-4 py-1.5 bg-bg-sidebar border border-border-main rounded-full text-[11px] font-bold text-text-muted uppercase tracking-widest">
                  Tiket Chat #{sessionId}
                </div>
                <p className="text-xs text-text-muted font-medium">Silakan sampaikan kendala atau pertanyaan Anda kepada admin.</p>
              </div>

              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] space-y-1 ${msg.sender_id === user.id ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${msg.sender_id === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{msg.sender_name}</span>
                      {msg.sender_role === 'admin' && (
                        <span className="bg-orange-primary/10 text-orange-primary text-xs font-bold px-1.5 py-0.5 rounded-full border border-orange-primary/20 uppercase tracking-widest">Admin</span>
                      )}
                    </div>
                    <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                      msg.sender_id === user.id 
                        ? 'bg-orange-primary text-black rounded-tr-none' 
                        : 'bg-bg-sidebar border border-border-main text-text-main rounded-tl-none'
                    }`}>
                      {msg.message}
                    </div>
                    <div className={`text-[11px] text-text-muted font-semibold uppercase tracking-wide mt-1 ${msg.sender_id === user.id ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-bg-sidebar border-t border-border-main">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input 
                  type="text"
                  placeholder="Tulis pesan Anda..."
                  className="flex-1 bg-bg-main border border-border-main rounded-2xl px-5 py-4 text-xs font-medium text-text-main focus:outline-none focus:border-orange-primary transition-all shadow-inner"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={loading || !newMessage.trim()}
                  className="w-14 h-14 bg-orange-primary text-black rounded-2xl flex items-center justify-center shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : <span className="font-bold text-sm">→</span>}
                </button>
              </form>
              <p className="text-[11px] text-text-muted text-center mt-4 font-semibold uppercase tracking-wide">
                Pesan Anda akan dibalas oleh admin secepat mungkin.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
