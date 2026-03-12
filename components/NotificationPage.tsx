import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Star, 
  LogIn, 
  Package, 
  Clock, 
  Trash2, 
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';
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
}

export default function NotificationPage({ user, onBadgeUpdate }: NotificationPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth(`/api/kijo/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.slice(0, 50));
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

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const res = await fetchWithAuth(`/api/kijo/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    if (!confirm('Hapus semua notifikasi?')) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/notifications/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'login': return <LogIn className="text-blue-400" size={18} />;
      case 'order_new': return <Package className="text-orange-primary" size={18} />;
      case 'order_completed': return <CheckCircle2 className="text-green-400" size={18} />;
      case 'rating': return <Star className="text-yellow-400" size={18} />;
      case 'system': return <Info className="text-purple-400" size={18} />;
      default: return <Bell className="text-gray-400" size={18} />;
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.is_read === 0);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-0 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-4xl font-bold text-text-main tracking-tighter">INBOX <span className="text-orange-primary">NOTIFIKASI.</span></h2>
            <div className="flex items-center gap-2">
              <span className="bg-bg-sidebar border border-border-main text-text-muted text-xs md:text-xs font-bold px-2 md:px-3 py-1 rounded-full">
                {notifications.length}/50
              </span>
              {unreadCount > 0 && (
                <span className="bg-orange-primary text-black text-xs md:text-xs font-bold px-2 md:px-3 py-1 rounded-full shadow-lg shadow-orange-primary/20">
                  {unreadCount} BARU
                </span>
              )}
            </div>
          </div>
          <p className="text-text-muted text-xs md:text-sm font-medium">Pantau aktivitas pesanan dan pembaruan sistem Anda.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={markAllAsRead}
            className="p-3 text-text-muted hover:text-orange-primary bg-bg-sidebar border border-border-main rounded-2xl transition-all shadow-sm"
            title="Tandai Semua Terbaca"
          >
            <Check size={20} />
          </button>
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-1 flex items-center shadow-sm">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all ${filter === 'all' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
            >
              SEMUA
            </button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all ${filter === 'unread' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
            >
              UNREAD
            </button>
          </div>
          <button 
            onClick={clearAll}
            className="p-3 text-text-muted hover:text-red-500 bg-bg-sidebar border border-border-main rounded-2xl transition-all shadow-sm hover:border-red-500/20"
            title="Bersihkan Semua"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted text-xs font-bold tracking-widest uppercase animate-pulse">Sinkronisasi Inbox...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-20 text-center shadow-sm">
            <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mx-auto mb-6 border border-border-main shadow-inner">
              <Bell className="text-text-muted" size={40} />
            </div>
            <h3 className="text-text-main font-bold text-xl mb-2">Kotak Masuk Kosong</h3>
            <p className="text-text-muted text-sm max-w-xs mx-auto leading-relaxed">Anda sudah up-to-date! Tidak ada notifikasi baru untuk saat ini.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((notification) => (
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
                className={`relative group bg-bg-sidebar border rounded-2xl p-6 transition-all cursor-pointer hover:border-orange-primary/30 shadow-sm ${notification.is_read === 0 ? 'border-orange-primary/20 bg-orange-primary/[0.02]' : 'border-border-main'}`}
              >
                <div className="flex gap-6">
                  <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${notification.is_read === 0 ? 'bg-orange-primary/10 border-orange-primary/20' : 'bg-bg-main border-border-main'}`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-bold text-lg tracking-tight truncate ${notification.is_read === 0 ? 'text-text-main' : 'text-text-muted'}`}>
                        {notification.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted font-semibold uppercase tracking-wide bg-bg-main px-2 py-1 rounded-md border border-border-main">
                          {new Date(notification.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button 
                          onClick={(e) => deleteNotification(e, notification.id)}
                          className="p-1.5 text-text-muted hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <p className={`text-sm leading-relaxed transition-all ${expandedId === notification.id ? '' : 'line-clamp-1 text-text-muted'}`}>
                        {notification.message}
                      </p>
                      {expandedId !== notification.id && notification.message.length > 60 && (
                        <span className="text-xs font-bold text-orange-primary uppercase tracking-widest mt-2 block">... read more</span>
                      )}
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-text-muted font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <Clock size={10} /> {new Date(notification.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl transition-all ${expandedId === notification.id ? 'bg-orange-primary text-black rotate-90' : 'bg-bg-main text-text-muted'}`}>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </div>

                {notification.is_read === 0 && (
                  <div className="absolute top-6 right-6 w-2.5 h-2.5 bg-orange-primary rounded-full shadow-[0_0_15px_rgba(255,159,28,0.6)] animate-pulse" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* System Status Footer */}
      <div className="bg-orange-primary/5 border border-orange-primary/10 rounded-2xl p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div>
            <h5 className="text-text-main text-xs font-bold">Status Sistem: Optimal</h5>
            <p className="text-text-muted text-xs">Semua layanan berjalan normal. Terakhir diperbarui: Baru saja.</p>
          </div>
        </div>
        <button className="text-xs font-bold text-orange-primary hover:underline uppercase tracking-widest">
          Detail Server
        </button>
      </div>
    </div>
  );
}
