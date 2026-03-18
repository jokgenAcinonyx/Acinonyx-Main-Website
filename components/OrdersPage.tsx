import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star,
  ArrowLeft
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { formatDuration, statusColor, statusLabel, toJakartaDT as toJakartaDateTime, toJakartaDate, toJakartaTime } from '@/utils/formatters';
import { useAlert } from './AlertContext';
import OrderChat from './OrderChat';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

interface OrdersPageProps {
  user: any;
  globalGames: any[];
  onGoToMarketplace?: () => void;
}

export default function OrdersPage({ user, globalGames, onGoToMarketplace }: OrdersPageProps) {
  const { showAlert } = useAlert();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAgreeingCancel, setIsAgreeingCancel] = useState(false);
  const [isRejectingCancel, setIsRejectingCancel] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [snapReady, setSnapReady] = useState(false);
  const [resumingPayment, setResumingPayment] = useState<number | null>(null);
  const [paymentCountdowns, setPaymentCountdowns] = useState<Record<number, number>>({});
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRevertingCancel, setIsRevertingCancel] = useState(false);
  const [ratingData, setRatingData] = useState({
    stars: 5,
    skillRating: 5,
    attitudeRating: 5,
    comment: '',
    tags: [] as string[]
  });

  const TRAIT_BADGES = [
    { id: 'polite', label: '🌟 Polite Customer' },
    { id: 'communicator', label: '🗣️ Great Communicator' },
    { id: 'chill', label: '🎭 Chill Player' },
    { id: 'learner', label: '🎓 Quick Learner' },
    { id: 'ontime', label: '⏰ Always On-Time' },
    { id: 'done', label: '✅ Consider it done' },
    { id: 'loyal', label: '🛡️ Loyal Supporter' },
    { id: 'carry', label: '🎒 Carry-able' }
  ];

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/jokies/orders/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);

        // Auto-verify any pending_payment orders in case webhook was missed
        const pendingOrders = data.filter((o: any) => o.status === 'pending_payment');
        if (pendingOrders.length > 0) {
          let anyChanged = false;
          for (const o of pendingOrders) {
            try {
              const vRes = await fetchWithAuth(`/api/payment/verify/${o.id}`, { method: 'POST' });
              if (vRes.ok) {
                const vData = await vRes.json();
                if (vData.success && vData.status === 'settlement') anyChanged = true;
              }
            } catch {}
          }
          // If any order was just settled, re-fetch to show updated list
          if (anyChanged) {
            const res2 = await fetchWithAuth(`/api/jokies/orders/${user.id}`);
            if (res2.ok) setOrders(await res2.json());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user.id]);

  // Load Midtrans Snap.js for resume payment
  useEffect(() => {
    const loadSnap = async () => {
      try {
        const res = await fetchWithAuth('/api/payment/client-key');
        if (!res.ok) return;
        const data = await res.json();
        if (!document.getElementById('midtrans-snap-script')) {
          const snapUrl = data.isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';
          const script = document.createElement('script');
          script.id = 'midtrans-snap-script';
          script.src = snapUrl;
          script.setAttribute('data-client-key', data.clientKey);
          script.onload = () => setSnapReady(true);
          document.head.appendChild(script);
        } else {
          setSnapReady(true);
        }
      } catch {}
    };
    loadSnap();
  }, []);

  // Countdown timer for pending_payment orders
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending_payment');
    if (pendingOrders.length === 0) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }

    const updateCountdowns = () => {
      const now = Date.now();
      const newCountdowns: Record<number, number> = {};
      let anyExpired = false;
      for (const o of pendingOrders) {
        const createdAt = new Date(o.created_at).getTime();
        const remaining = Math.max(0, Math.floor((15 * 60 * 1000 - (now - createdAt)) / 1000));
        newCountdowns[o.id] = remaining;
        if (remaining === 0) anyExpired = true;
      }
      setPaymentCountdowns(newCountdowns);
      if (anyExpired) fetchOrders(); // refresh to pick up auto-cancelled sessions
    };

    updateCountdowns();
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(updateCountdowns, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [orders]);

  const handleResumePayment = useCallback(async (sessionId: number) => {
    if (!snapReady || !window.snap) {
      showAlert('Payment gateway belum siap. Tunggu sebentar...', 'error');
      return;
    }
    setResumingPayment(sessionId);
    try {
      const res = await fetchWithAuth(`/api/payment/resume/${sessionId}`);
      if (!res.ok) {
        let msg = 'Gagal membuka pembayaran.';
        try { const err = await res.json(); msg = err.message || msg; } catch {}
        showAlert(msg, 'error');
        if (res.status === 410) fetchOrders(); // expired, refresh
        return;
      }
      const data = await res.json();
      window.snap!.pay(data.snapToken, {
        onSuccess: async () => {
          // Verify payment with server to ensure session moves to 'upcoming'
          try {
            await fetchWithAuth(`/api/payment/verify/${sessionId}`, { method: 'POST' });
          } catch {}
          showAlert('Pembayaran berhasil! Pesanan Anda sedang diproses.', 'success');
          fetchOrders();
        },
        onPending: () => {
          showAlert('Menunggu pembayaran. Selesaikan pembayaran sesuai instruksi.', 'warning');
          fetchOrders();
        },
        onError: () => {
          showAlert('Pembayaran gagal. Silakan coba lagi.', 'error');
        },
        onClose: () => {
          // User closed popup — that's fine, they can re-open
        },
      });
    } catch (error) {
      showAlert('Terjadi kesalahan.', 'error');
    } finally {
      setResumingPayment(null);
    }
  }, [snapReady, showAlert, fetchOrders]);

  const handleCancelOrder = async () => {
    if (!cancelReason) { showAlert('Mohon isi alasan pembatalan', 'warning'); return; }
    setIsCancelling(true);
    try {
      const res = await fetchWithAuth('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id, reason: cancelReason })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || 'Permintaan pembatalan telah dikirim.', 'success');
        setCancelReason('');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        showAlert(data.message || 'Gagal membatalkan pesanan', 'error');
      }
    } catch (error) {
      showAlert('Gagal membatalkan pesanan', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmFinish = async () => {
    setIsCompleting(true);
    try {
      const res = await fetchWithAuth('/api/jokies/confirm-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id })
      });
      if (res.ok) {
        setShowRatingModal(true);
        fetchOrders();
      } else {
        const data = await res.json();
        showAlert(data.message || 'Gagal mengonfirmasi penyelesaian', 'error');
      }
    } catch (error) {
      showAlert('Gagal mengonfirmasi penyelesaian', 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAgreeCancel = async () => {
    setIsAgreeingCancel(true);
    try {
      const res = await fetchWithAuth('/api/orders/agree-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Pembatalan disetujui.', 'success');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        showAlert(data.message || 'Gagal menyetujui pembatalan', 'error');
      }
    } catch { showAlert('Terjadi kesalahan', 'error'); }
    finally { setIsAgreeingCancel(false); }
  };

  const handleRejectCancel = async () => {
    setIsRejectingCancel(true);
    try {
      const res = await fetchWithAuth('/api/orders/reject-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Pembatalan ditolak. Masalah dieskalasi ke Admin.', 'warning');
        fetchOrders();
      } else {
        showAlert(data.message || 'Gagal menolak pembatalan', 'error');
      }
    } catch { showAlert('Terjadi kesalahan', 'error'); }
    finally { setIsRejectingCancel(false); }
  };

  const handleRevertCancel = async () => {
    if (!selectedOrder) return;
    setIsRevertingCancel(true);
    try {
      const res = await fetchWithAuth('/api/orders/revert-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || 'Permintaan pembatalan berhasil dibatalkan.', 'success');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        showAlert(data.message || 'Gagal membatalkan permintaan pembatalan', 'error');
      }
    } catch { showAlert('Terjadi kesalahan', 'error'); }
    finally { setIsRevertingCancel(false); }
  };

  const handleSubmitRating = async () => {
    try {
      const res = await fetchWithAuth('/api/jokies/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedOrder.user_id,
          jokiesId: user.id,
          sessionId: selectedOrder.id,
          ...ratingData
        })
      });
      if (res.ok) {
        showAlert('Terima kasih atas ulasan Anda!', 'success');
        setShowRatingModal(false);
        fetchOrders();
      }
    } catch (error) {
      showAlert('Gagal mengirim ulasan', 'error');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.title || '').toLowerCase().includes(q) ||
      (o.kijo_name || '').toLowerCase().includes(q) ||
      (o.kijo_username || '').toLowerCase().includes(q) ||
      (o.game_title || '').toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  });

  const groupedOrders = {
    pendingPayment: [...filteredOrders.filter(o => o.status === 'pending_payment')].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    upcoming: [...filteredOrders.filter(o => o.status === 'upcoming')].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    ongoing: [...filteredOrders.filter(o => ['ongoing', 'pending_completion'].includes(o.status))].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    cancellation: [...filteredOrders.filter(o => ['pending_cancellation', 'cancelled'].includes(o.status))].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    history: [...filteredOrders.filter(o => o.status === 'completed')].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
  };

  const renderDynamicData = (dataString: string) => {
    if (!dataString) return null;
    try {
      const data = JSON.parse(dataString);
      return Object.entries(data).map(([key, value]) => (
        <p key={key} className="text-xs text-text-muted">
          {key}: <span className="text-text-main font-bold">{String(value)}</span>
        </p>
      ));
    } catch (e) {
      return null;
    }
  };

  // ─── Mobile Chat Full Page ───
  if (showMobileChat && selectedOrder) {
    return (
      <div className="fixed inset-0 z-[120] bg-bg-main flex flex-col">
        <div className="p-4 border-b border-border-main bg-bg-sidebar flex items-center gap-3">
          <button onClick={() => setShowMobileChat(false)} className="p-2 text-text-muted hover:text-orange-primary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h3 className="text-sm font-bold text-text-main">Chat Pesanan #{selectedOrder.id}</h3>
            <p className="text-xs text-text-muted">{selectedOrder.title}</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <OrderChat
            sessionId={selectedOrder.id}
            userId={user.id}
            username={user.username || user.full_name}
            isActive={!['completed', 'cancelled'].includes(selectedOrder.status)}
          />
        </div>
      </div>
    );
  }

  // ─── Order Detail View ───
  if (selectedOrder) {
    const isActive = ['ongoing', 'pending_completion', 'pending_cancellation'].includes(selectedOrder.status);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
        <button
          onClick={() => { setSelectedOrder(null); setCancelReason(''); }}
          className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar
        </button>

        <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-border-main bg-bg-card/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold bg-orange-primary/10 text-orange-primary px-2 py-1 rounded-md border border-orange-primary/20 uppercase tracking-widest">
                    ID: #{selectedOrder.id}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-md border uppercase tracking-widest ${statusColor(selectedOrder.status)}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                </div>
                <h2 className="text-xl md:text-3xl font-bold text-text-main tracking-tight">{selectedOrder.title}</h2>
                <p className="text-text-muted text-xs mt-1">{selectedOrder.game_title || 'Game Session'}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Total Pembayaran</p>
                <p className="text-2xl md:text-3xl font-bold text-orange-primary font-mono">Rp {(selectedOrder.total_price || selectedOrder.price).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column: Details */}
            <div className="space-y-6">
              {/* Detail Pemesanan */}
              <div className="bg-bg-main/50 p-5 md:p-6 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  Detail Pemesanan
                </h3>
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Tanggal Pesan</p>
                    <p className="text-sm font-bold text-text-main">{toJakartaDate(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Waktu Booking</p>
                    <p className="text-sm font-bold text-text-main">{toJakartaTime(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Jadwal Mabar</p>
                    <p className="text-sm font-bold text-orange-primary">{toJakartaDateTime(selectedOrder.scheduled_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Durasi</p>
                    <p className="text-sm font-bold text-text-main">{formatDuration(selectedOrder.duration)}</p>
                  </div>
                  {selectedOrder.game_title && (
                    <div>
                      <p className="text-xs text-text-muted font-bold uppercase">Game</p>
                      <p className="text-sm font-bold text-text-main">{selectedOrder.game_title}</p>
                    </div>
                  )}
                  {selectedOrder.quantity > 1 && (
                    <div>
                      <p className="text-xs text-text-muted font-bold uppercase">Jumlah</p>
                      <p className="text-sm font-bold text-text-main">x{selectedOrder.quantity}</p>
                    </div>
                  )}
                  {selectedOrder.rank_start && (
                    <div>
                      <p className="text-xs text-text-muted font-bold uppercase">Rank Awal</p>
                      <p className="text-sm font-bold text-text-main">{selectedOrder.rank_start}</p>
                    </div>
                  )}
                  {selectedOrder.rank_end && (
                    <div>
                      <p className="text-xs text-text-muted font-bold uppercase">Rank Akhir</p>
                      <p className="text-sm font-bold text-text-main">{selectedOrder.rank_end}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rincian Pembayaran */}
              <div className="bg-bg-main/50 p-5 md:p-6 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  Rincian Pembayaran
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Harga Paket {selectedOrder.quantity > 1 ? `(x${selectedOrder.quantity})` : ''}</span>
                    <span className="font-bold text-text-main">Rp {(selectedOrder.price * (selectedOrder.quantity || 1)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Biaya Penanganan</span>
                    <span className="font-bold text-text-main">Rp {(selectedOrder.admin_fee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Metode Pembayaran</span>
                    <span className="font-bold text-text-main">{selectedOrder.payment_method || '-'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border-main">
                    <span className="font-bold text-text-main uppercase text-xs">Total Keseluruhan</span>
                    <span className="font-bold text-orange-primary">Rp {(selectedOrder.total_price || selectedOrder.price).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Jokies */}
                <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    Detail Jokies
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-text-main">{user.full_name || user.username}</p>
                    {selectedOrder.status !== 'cancelled' && selectedOrder.jokies_dynamic_data && renderDynamicData(selectedOrder.jokies_dynamic_data)}
                  </div>
                </div>
                {/* Kijo */}
                <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    Detail Kijo
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-text-main">{selectedOrder.kijo_name || selectedOrder.kijo_username || selectedOrder.title}</p>
                    {selectedOrder.status !== 'cancelled' && selectedOrder.kijo_dynamic_data && renderDynamicData(selectedOrder.kijo_dynamic_data)}
                    {selectedOrder.status === 'cancelled' && (
                      <p className="text-xs text-text-muted italic">Detail disembunyikan karena pesanan dibatalkan</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bukti Pengerjaan (read-only for Jokies) */}
              {(isActive || selectedOrder.status === 'completed') && (
                <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    Bukti Pengerjaan
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted font-bold uppercase text-center">Sebelum</p>
                      <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden">
                        {selectedOrder.screenshot_start ? (
                          <img src={selectedOrder.screenshot_start} className="w-full h-full object-cover" alt="Bukti sebelum" />
                        ) : (
                          <span className="text-xs text-text-muted italic">Belum diunggah oleh Kijo</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted font-bold uppercase text-center">Sesudah</p>
                      <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden">
                        {selectedOrder.screenshot_end ? (
                          <img src={selectedOrder.screenshot_end} className="w-full h-full object-cover" alt="Bukti sesudah" />
                        ) : (
                          <span className="text-xs text-text-muted italic">Belum diunggah oleh Kijo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-4">
                {/* Pending Completion: Kijo requested finish, Jokies must confirm */}
                {selectedOrder.status === 'pending_completion' && (
                  <div className="bg-green-500/5 p-5 rounded-2xl border border-green-500/20">
                    <h3 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3">Partner Minta Konfirmasi Selesai</h3>
                    <p className="text-xs text-text-muted mb-4 leading-relaxed">
                      Partner telah mengajukan penyelesaian pesanan. Periksa hasil pengerjaan — jika sudah sesuai, konfirmasi untuk mencairkan dana ke Partner.
                    </p>
                    <button
                      onClick={handleConfirmFinish}
                      disabled={isCompleting}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/10 transition-all disabled:opacity-50 text-xs uppercase tracking-widest"
                    >
                      {isCompleting ? 'MEMPROSES...' : 'KONFIRMASI PESANAN SELESAI'}
                    </button>
                  </div>
                )}

                {/* Ongoing: Jokies can finish directly or wait for Kijo to request */}
                {selectedOrder.status === 'ongoing' && (
                  <div className="space-y-3">
                    <div className="bg-bg-main p-4 rounded-xl border border-border-main text-center">
                      <p className="text-sm font-bold text-text-main mb-1">Partner Sedang Mengerjakan</p>
                      <p className="text-xs text-text-muted">Pesanan Anda sedang dikerjakan oleh Partner.</p>
                    </div>
                    <div className="bg-green-500/5 p-5 rounded-2xl border border-green-500/20">
                      <h3 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-2">Jika Sudah Selesai</h3>
                      <p className="text-xs text-text-muted mb-4">Jika pengerjaan sudah sesuai, Anda bisa langsung menyelesaikan pesanan. Dana akan segera diteruskan ke Partner.</p>
                      <button
                        onClick={handleConfirmFinish}
                        disabled={isCompleting}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/10 transition-all disabled:opacity-50 text-xs uppercase tracking-widest"
                      >
                        {isCompleting ? 'MEMPROSES...' : 'SELESAIKAN PESANAN'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Cancellation: agree/reject or waiting */}
                {selectedOrder.status === 'pending_cancellation' && (
                  <div className="space-y-3">
                    {selectedOrder.cancel_escalated ? (
                      <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-center">
                        SENGKETA — MENUNGGU KEPUTUSAN ADMIN
                      </div>
                    ) : selectedOrder.cancelled_by === 'jokies' ? (
                      <div className="space-y-3">
                        <div className="w-full bg-orange-primary/10 border border-orange-primary/20 text-orange-primary font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-center">
                          MENUNGGU PERSETUJUAN PARTNER
                        </div>
                        <button
                          onClick={handleRevertCancel}
                          disabled={isRevertingCancel}
                          className="w-full border border-green-500/30 text-green-500 font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-green-500/10 transition-all disabled:opacity-50"
                        >
                          {isRevertingCancel ? 'MEMPROSES...' : 'BATALKAN PERMINTAAN PEMBATALAN'}
                        </button>
                        <p className="text-xs text-text-faint text-center">Membatalkan permintaan pembatalan dan melanjutkan pesanan.</p>
                      </div>
                    ) : (
                      <div className="bg-red-500/5 p-5 rounded-2xl border border-red-500/20">
                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Pembatalan Diminta Partner</h3>
                        <p className="text-xs text-text-muted mb-4">
                          Alasan: <span className="text-text-main italic">"{selectedOrder.cancellation_reason}"</span>
                        </p>
                        <p className="text-xs text-text-muted mb-4">
                          Jika disetujui, pesanan dibatalkan dan refund penuh akan dikembalikan ke wallet Anda.
                        </p>
                        <div className="space-y-2">
                          <button onClick={handleAgreeCancel} disabled={isAgreeingCancel}
                            className="w-full bg-red-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50"
                          >
                            {isAgreeingCancel ? 'MEMPROSES...' : 'SETUJUI PEMBATALAN (REFUND PENUH)'}
                          </button>
                          <button onClick={handleRejectCancel} disabled={isRejectingCancel}
                            className="w-full border border-border-main text-text-muted font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-bg-card transition-all disabled:opacity-50"
                          >
                            {isRejectingCancel ? 'MEMPROSES...' : 'TOLAK (ESKALASI KE ADMIN)'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Resume Payment: available for pending_payment orders */}
                {selectedOrder.status === 'pending_payment' && (() => {
                  const remaining = paymentCountdowns[selectedOrder.id] ?? 0;
                  const mins = Math.floor(remaining / 60);
                  const secs = remaining % 60;
                  return (
                    <div className="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/20">
                      <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">Menunggu Pembayaran</h3>
                      <p className="text-xs text-text-muted mb-2">Selesaikan pembayaran sebelum waktu habis. Pesanan akan otomatis dibatalkan jika tidak dibayar.</p>
                      <p className="text-sm font-bold mb-3" style={{ color: remaining > 60 ? 'var(--color-text-main)' : '#ef4444' }}>
                        Sisa waktu: {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                      </p>
                      <button
                        onClick={() => handleResumePayment(selectedOrder.id)}
                        disabled={resumingPayment === selectedOrder.id || remaining === 0}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
                      >
                        {remaining === 0 ? 'WAKTU HABIS' : resumingPayment === selectedOrder.id ? 'MEMBUKA...' : 'BAYAR SEKARANG'}
                      </button>
                    </div>
                  );
                })()}

                {/* Cancel: available for upcoming/ongoing (not when already pending_cancellation) */}
                {['upcoming', 'ongoing'].includes(selectedOrder.status) && (
                  <div className="bg-red-500/5 p-5 rounded-2xl border border-red-500/20">
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Batalkan Pesanan</h3>
                    {selectedOrder.status === 'upcoming' && (() => {
                      const minsUntil = (new Date(selectedOrder.scheduled_at).getTime() - Date.now()) / (1000 * 60);
                      return minsUntil >= 60
                        ? <p className="text-xs text-text-muted mb-3">Pembatalan otomatis tanpa persetujuan Partner. Refund sebesar harga paket (biaya admin tidak dikembalikan).</p>
                        : <p className="text-xs text-text-muted mb-3">Kurang dari 1 jam sebelum sesi. Pembatalan memerlukan persetujuan Partner. Refund sebesar harga paket (biaya admin tidak dikembalikan). Jika Partner menolak, masalah dieskalasi ke Admin.</p>;
                    })()}
                    {selectedOrder.status === 'ongoing' && (
                      <p className="text-xs text-text-muted mb-3">Sesi sedang berjalan. Pembatalan memerlukan persetujuan Partner. Refund sebesar harga paket (biaya admin tidak dikembalikan). Jika Partner menolak, masalah dieskalasi ke Admin.</p>
                    )}
                    <textarea
                      placeholder="Alasan pembatalan..."
                      className="w-full bg-bg-main border border-border-main rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-red-500 mb-3 h-20"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <button
                      onClick={handleCancelOrder}
                      disabled={isCancelling}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/10 transition-all disabled:opacity-50"
                    >
                      {isCancelling ? 'MEMPROSES...' : 'KONFIRMASI PEMBATALAN'}
                    </button>
                  </div>
                )}

                {/* Inactivity warning */}
                {selectedOrder.needs_admin_chat && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Peringatan Inaktivitas</p>
                    <p className="text-xs text-text-main leading-relaxed">Partner belum memulai sesi setelah 15 menit. Silakan hubungi Admin untuk bantuan.</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    const subject = encodeURIComponent(`Bantuan Pesanan #${selectedOrder.id}`);
                    const body = encodeURIComponent(`Order ID: #${selectedOrder.id}\nPaket: ${selectedOrder.title}\nStatus: ${selectedOrder.status}\nTanggal: ${selectedOrder.scheduled_at}\n\nKeterangan:\n[tuliskan masalah Anda di sini]`);
                    window.open(`mailto:jokgen.acinonyx@gmail.com?subject=${subject}&body=${body}`);
                  }}
                  className="w-full border bg-bg-sidebar border-border-main text-text-main hover:border-orange-primary/30 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  EMAIL ADMIN "MINOX"
                </button>
              </div>
            </div>

            {/* Right Column: Order Chat + Rating */}
            {selectedOrder.status !== 'pending' && (
              <div className="space-y-6 self-start">
                {/* Desktop: show inline chat */}
                <div className="hidden lg:block lg:sticky lg:top-4 space-y-4">
                  <OrderChat
                    sessionId={selectedOrder.id}
                    userId={user.id}
                    username={user.username || user.full_name}
                    isActive={!['completed', 'cancelled'].includes(selectedOrder.status)}
                  />
                  {/* Inline Rating — completed & not yet rated */}
                  {selectedOrder.status === 'completed' && !selectedOrder.has_rating && (
                    <div className="bg-orange-primary/5 border border-orange-primary/20 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-orange-primary/10 text-center">
                        <h3 className="text-sm font-bold text-orange-primary uppercase tracking-widest mb-1">Beri Rating untuk Kijo</h3>
                        <p className="text-xs text-text-muted">Bagaimana pengalaman mabar Anda dengan {selectedOrder.kijo_name}?</p>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Kepuasan Umum (Wajib)</p>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((s) => (
                              <button key={s} onClick={() => setRatingData({...ratingData, stars: s})}
                                className={`p-2 transition-all ${ratingData.stars >= s ? 'text-orange-primary scale-110' : 'text-text-muted opacity-30'}`}
                              >
                                <Star size={24} fill={ratingData.stars >= s ? 'currentColor' : 'none'} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Skill</p>
                            <div className="flex justify-center gap-1">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onClick={() => setRatingData({...ratingData, skillRating: s})}
                                  className={`p-1 transition-all ${ratingData.skillRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                                >
                                  <Star size={12} fill={ratingData.skillRating >= s ? 'currentColor' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Attitude</p>
                            <div className="flex justify-center gap-1">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onClick={() => setRatingData({...ratingData, attitudeRating: s})}
                                  className={`p-1 transition-all ${ratingData.attitudeRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                                >
                                  <Star size={12} fill={ratingData.attitudeRating >= s ? 'currentColor' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Keunggulan Kijo (Min. 1)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TRAIT_BADGES.map((badge) => (
                              <button key={badge.id}
                                onClick={() => {
                                  const tags = ratingData.tags.includes(badge.label)
                                    ? ratingData.tags.filter(t => t !== badge.label)
                                    : [...ratingData.tags, badge.label];
                                  setRatingData({...ratingData, tags});
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                  ratingData.tags.includes(badge.label)
                                    ? 'bg-orange-primary border-orange-primary text-black'
                                    : 'bg-bg-main border-border-main text-text-muted hover:border-orange-primary/30'
                                }`}
                              >{badge.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Testimoni (Opsional)</p>
                          <textarea
                            placeholder="Tuliskan kesan Anda..."
                            className="w-full bg-bg-main border border-border-main rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-orange-primary h-16 resize-none"
                            value={ratingData.comment}
                            onChange={(e) => setRatingData({...ratingData, comment: e.target.value})}
                          />
                        </div>
                        <button
                          onClick={handleSubmitRating}
                          disabled={ratingData.tags.length === 0}
                          className="w-full py-3 rounded-xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/20"
                        >
                          KIRIM ULASAN
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedOrder.status === 'completed' && !!selectedOrder.has_rating && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-green-500 uppercase tracking-widest">✓ Ulasan Terkirim</p>
                      <p className="text-xs text-text-muted mt-1">Terima kasih sudah memberi ulasan untuk Kijo ini.</p>
                    </div>
                  )}
                </div>
                {/* Mobile/Tablet: show button to open chat, rating below */}
                <div className="lg:hidden space-y-4">
                  <button
                    onClick={() => setShowMobileChat(true)}
                    className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/10"
                  >
                    BUKA CHAT PESANAN
                  </button>
                  {selectedOrder.status === 'completed' && !selectedOrder.has_rating && (
                    <div className="bg-orange-primary/5 border border-orange-primary/20 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-orange-primary/10 text-center">
                        <h3 className="text-sm font-bold text-orange-primary uppercase tracking-widest mb-1">Beri Rating untuk Kijo</h3>
                        <p className="text-xs text-text-muted">Bagaimana pengalaman mabar Anda dengan {selectedOrder.kijo_name}?</p>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Kepuasan Umum (Wajib)</p>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((s) => (
                              <button key={s} onClick={() => setRatingData({...ratingData, stars: s})}
                                className={`p-2 transition-all ${ratingData.stars >= s ? 'text-orange-primary scale-110' : 'text-text-muted opacity-30'}`}
                              >
                                <Star size={28} fill={ratingData.stars >= s ? 'currentColor' : 'none'} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Skill</p>
                            <div className="flex justify-center gap-1">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onClick={() => setRatingData({...ratingData, skillRating: s})}
                                  className={`p-1 transition-all ${ratingData.skillRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                                >
                                  <Star size={14} fill={ratingData.skillRating >= s ? 'currentColor' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Attitude</p>
                            <div className="flex justify-center gap-1">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onClick={() => setRatingData({...ratingData, attitudeRating: s})}
                                  className={`p-1 transition-all ${ratingData.attitudeRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                                >
                                  <Star size={14} fill={ratingData.attitudeRating >= s ? 'currentColor' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Keunggulan Kijo (Min. 1)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TRAIT_BADGES.map((badge) => (
                              <button key={badge.id}
                                onClick={() => {
                                  const tags = ratingData.tags.includes(badge.label)
                                    ? ratingData.tags.filter(t => t !== badge.label)
                                    : [...ratingData.tags, badge.label];
                                  setRatingData({...ratingData, tags});
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                  ratingData.tags.includes(badge.label)
                                    ? 'bg-orange-primary border-orange-primary text-black'
                                    : 'bg-bg-main border-border-main text-text-muted hover:border-orange-primary/30'
                                }`}
                              >{badge.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Testimoni (Opsional)</p>
                          <textarea
                            placeholder="Tuliskan kesan Anda..."
                            className="w-full bg-bg-main border border-border-main rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-orange-primary h-20 resize-none"
                            value={ratingData.comment}
                            onChange={(e) => setRatingData({...ratingData, comment: e.target.value})}
                          />
                        </div>
                        <button
                          onClick={handleSubmitRating}
                          disabled={ratingData.tags.length === 0}
                          className="w-full py-3 rounded-xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/20"
                        >
                          KIRIM ULASAN
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedOrder.status === 'completed' && !!selectedOrder.has_rating && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-green-500 uppercase tracking-widest">✓ Ulasan Terkirim</p>
                      <p className="text-xs text-text-muted mt-1">Terima kasih sudah memberi ulasan untuk Kijo ini.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rating Modal */}
        <AnimatePresence>
          {showRatingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-border-main bg-bg-card/50 text-center">
                  <h3 className="text-2xl font-bold text-text-main mb-2">Beri Rating Untuk KIJO</h3>
                  <p className="text-text-muted text-sm">Bagaimana pengalaman mabar Anda dengan {selectedOrder.kijo_name}?</p>
                </div>
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  {/* Stars */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Kepuasan Umum (Wajib)</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setRatingData({...ratingData, stars: s})}
                          className={`p-2 transition-all ${ratingData.stars >= s ? 'text-orange-primary scale-110' : 'text-text-muted opacity-30'}`}
                        >
                          <Star size={32} fill={ratingData.stars >= s ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Skill</p>
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRatingData({...ratingData, skillRating: s})}
                            className={`p-1 transition-all ${ratingData.skillRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                          >
                            <Star size={16} fill={ratingData.skillRating >= s ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Attitude</p>
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRatingData({...ratingData, attitudeRating: s})}
                            className={`p-1 transition-all ${ratingData.attitudeRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                          >
                            <Star size={16} fill={ratingData.attitudeRating >= s ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Pilih Keunggulan KIJO (Min. 1)</p>
                    <div className="flex flex-wrap gap-2">
                      {TRAIT_BADGES.map((badge) => (
                        <button key={badge.id}
                          onClick={() => {
                            const tags = ratingData.tags.includes(badge.label)
                              ? ratingData.tags.filter(t => t !== badge.label)
                              : [...ratingData.tags, badge.label];
                            setRatingData({...ratingData, tags});
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                            ratingData.tags.includes(badge.label)
                              ? 'bg-orange-primary border-orange-primary text-black'
                              : 'bg-bg-main border-border-main text-text-muted hover:border-orange-primary/30'
                          }`}
                        >{badge.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Testimoni (Opsional)</p>
                    <textarea placeholder="Tuliskan kesan Anda..."
                      className="w-full bg-bg-main border border-border-main rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-orange-primary h-20"
                      value={ratingData.comment} onChange={(e) => setRatingData({...ratingData, comment: e.target.value})}
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-border-main bg-bg-card/50 flex gap-4">
                  <button onClick={() => setShowRatingModal(false)}
                    className="flex-1 py-3 rounded-xl border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:bg-bg-main transition-all"
                  >Nanti Saja</button>
                  <button onClick={handleSubmitRating} disabled={ratingData.tags.length === 0}
                    className="flex-1 py-3 rounded-xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/20"
                  >KIRIM ULASAN</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Orders List View ───
  return (
    <div className="space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-text-main tracking-tighter uppercase">Pesanan <span className="text-orange-primary">Saya.</span></h1>
          <p className="text-text-muted text-xs md:text-sm mt-1 font-medium">Kelola dan pantau status joki Anda secara real-time.</p>
        </div>
        <button onClick={fetchOrders}
          className="bg-bg-sidebar border border-border-main p-3 rounded-xl text-text-muted hover:text-orange-primary hover:border-orange-primary/30 transition-all"
        >
          <span className="font-bold text-sm">↻</span>
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Sinkronisasi Pesanan...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-12 text-center space-y-5">
          <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mx-auto text-text-muted border border-border-main">
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="text-text-main font-bold text-xl mb-2">Belum Ada Pesanan</h3>
            <p className="text-text-muted text-sm leading-relaxed">Cari partner terbaikmu sekarang!</p>
          </div>
          <button onClick={onGoToMarketplace} className="bg-orange-primary text-black font-bold px-8 py-3 rounded-2xl text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/10">
            LIHAT MARKETPLACE
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ─── Search Bar ─── */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari pesanan (nama, game, ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-sidebar border border-border-main rounded-xl px-4 py-3 pl-10 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint text-sm">&#128269;</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-main text-xs font-bold">
                ✕
              </button>
            )}
          </div>

          {/* ─── Menunggu Pembayaran ─── */}
          {groupedOrders.pendingPayment.length > 0 && (
            <div className="bg-bg-card border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-text-main font-bold text-sm uppercase tracking-wider">Menunggu Pembayaran</h3>
                <span className="ml-auto text-xs text-amber-500 font-bold">{groupedOrders.pendingPayment.length}</span>
              </div>
              <div className="space-y-3">
                {groupedOrders.pendingPayment.map(order => {
                  const remaining = paymentCountdowns[order.id] ?? 0;
                  const mins = Math.floor(remaining / 60);
                  const secs = remaining % 60;
                  return (
                    <div key={order.id} className="bg-bg-main/50 border border-border-main rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-text-main font-bold text-sm truncate">{order.title || `Pesanan #${order.id}`}</p>
                        <p className="text-text-muted text-xs mt-1">
                          {order.kijo_name} • {toJakartaDate(order.scheduled_at)} {toJakartaTime(order.scheduled_at)} • {formatDuration(order.duration)}
                        </p>
                        <p className="text-xs mt-1 font-bold" style={{ color: remaining > 60 ? 'var(--color-text-muted)' : '#ef4444' }}>
                          Sisa waktu: {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleResumePayment(order.id)}
                          disabled={resumingPayment === order.id || remaining === 0}
                          className="px-5 py-2.5 bg-amber-500 text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                        >
                          {resumingPayment === order.id ? 'Membuka...' : 'BAYAR SEKARANG'}
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-4 py-2.5 bg-bg-card border border-border-main text-text-muted font-bold text-xs uppercase tracking-wider rounded-xl hover:text-text-main transition-all"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Sesi Mendatang ─── */}
          <OrderSection title="Sesi Mendatang" iconBg="bg-orange-primary/10" iconColor="text-orange-primary" count={groupedOrders.upcoming.length}>
            {groupedOrders.upcoming.map(order => (
              <OrderListCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
            ))}
          </OrderSection>

          {/* ─── Sedang Berjalan ─── */}
          <OrderSection title="Sedang Berjalan" iconBg="bg-blue-500/10" iconColor="text-blue-500" count={groupedOrders.ongoing.length}>
            {groupedOrders.ongoing.map(order => (
              <OrderListCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} active />
            ))}
          </OrderSection>

          {/* ─── Pembatalan ─── */}
          <OrderSection title="Pembatalan" iconBg="bg-red-500/10" iconColor="text-red-500" count={groupedOrders.cancellation.length}>
            {groupedOrders.cancellation.map(order => (
              <OrderListCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
            ))}
          </OrderSection>

          {/* ─── History ─── */}
          <OrderSection title="History Pesanan" iconBg="bg-bg-card" iconColor="text-text-muted" count={groupedOrders.history.length}>
            {groupedOrders.history.map(order => (
              <OrderListCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
            ))}
          </OrderSection>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper (box-in-box layout) ───
function OrderSection({ title, iconBg, iconColor, count, children }: {
  title: string; iconBg: string; iconColor: string; count: number; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 md:p-5 border-b border-border-main">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider flex-1">{title}</h2>
        <span className="text-xs font-mono font-bold text-text-muted">{count}</span>
      </div>
      <div className="p-3 md:p-4 space-y-3">
        {children}
      </div>
    </section>
  );
}

// ─── Order list card (inside the section box) ───
function OrderListCard({ order, onClick, active }: { order: any; onClick: () => void; active?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-main border rounded-xl p-4 transition-all cursor-pointer group hover:scale-[1.01] ${
        active ? 'border-blue-500/40 shadow-sm shadow-blue-500/5' : 'border-border-main hover:border-orange-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-bold text-text-main truncate">{order.title}</h4>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 ${statusColor(order.status)}`}>
              {statusLabel(order.status)}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            <span className="font-medium">{order.kijo_name || order.kijo_username}</span> &bull; {toJakartaDateTime(order.scheduled_at)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-text-main font-mono">Rp {(order.total_price || order.price).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SVG icons (not available in lucide-react directly) ───
const ActivityIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

const HistoryIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
    <path d="M12 7v5l4 2"></path>
  </svg>
);
