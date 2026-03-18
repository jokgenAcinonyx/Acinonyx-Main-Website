import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface Notification {
  id: number;
  type: 'login' | 'order_new' | 'order_update' | 'order_completed' | 'rating' | 'system';
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface NotificationPageProps {
  user: any;
  onBadgeUpdate?: (count: number) => void;
  subView?: string;
}

export default function NotificationPage({ user, onBadgeUpdate, subView }: NotificationPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth(`/api/kijo/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user.id]);

  // Lazy loading with IntersectionObserver
  const observerCb = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && visibleCount < notifications.length) {
      setVisibleCount(prev => Math.min(prev + 20, notifications.length));
    }
  }, [visibleCount, notifications.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(observerCb, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [observerCb]);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/kijo/notifications/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setNotifications(prev => {
          const updated = prev.map(n => n.id === id ? { ...n, is_read: 1 } : n);
          const newUnreadCount = updated.filter(n => n.is_read === 0).length;
          onBadgeUpdate?.(newUnreadCount);
          return updated;
        });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetchWithAuth('/api/kijo/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        onBadgeUpdate?.(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => n.is_read === 0).length;
  const visibleNotifications = notifications.slice(0, visibleCount);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Notifikasi<span className="text-orange-primary">.</span></h2>
          <p className="text-text-muted text-xs md:text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold bg-orange-primary text-black hover:scale-105 transition-all"
          >
            <span className="hidden md:inline">Tandai Semua Dibaca</span>
            <span className="md:hidden">Baca Semua</span>
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted text-xs font-bold tracking-widest uppercase animate-pulse">Memuat notifikasi...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-20 text-center shadow-sm">
            <h3 className="text-text-main font-bold text-xl mb-2">Kotak Masuk Kosong</h3>
            <p className="text-text-muted text-sm max-w-xs mx-auto leading-relaxed">Tidak ada notifikasi baru untuk saat ini.</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {visibleNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    setExpandedId(expandedId === notification.id ? null : notification.id);
                    if (notification.is_read === 0) markAsRead(notification.id);
                  }}
                  className={`relative group bg-bg-sidebar border rounded-2xl p-5 transition-all cursor-pointer hover:border-orange-primary/30 shadow-sm ${notification.is_read === 0 ? 'border-orange-primary/20 bg-orange-primary/[0.02]' : 'border-border-main'}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-bold text-sm tracking-tight truncate ${notification.is_read === 0 ? 'text-text-main' : 'text-text-muted'}`}>
                          {notification.title}
                        </h4>
                        <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wide ml-2 shrink-0">
                          {new Date(notification.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="relative">
                        <p className={`text-xs leading-relaxed transition-all ${expandedId === notification.id ? 'text-text-main' : 'line-clamp-1 text-text-muted'}`}>
                          {notification.message}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-text-muted font-semibold flex items-center gap-1">
                          {new Date(notification.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {notification.is_read === 0 && (
                    <div className="absolute top-5 right-5 w-2 h-2 bg-orange-primary rounded-full shadow-[0_0_10px_rgba(255,159,28,0.6)] animate-pulse" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Lazy loading sentinel */}
            {visibleCount < notifications.length && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-orange-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
