import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Clock, ChevronRight, Gamepad2, Zap, XCircle, CheckCircle2, MessageSquare, Calendar,
  CreditCard,
  User,
  Image as ImageIcon,
  Star,
  ArrowLeft
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface OrdersPageProps {
  user: any;
  onWithdraw: () => void;
  globalGames: any[];
}

export default function OrdersPage({ user, onWithdraw, globalGames }: OrdersPageProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
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
      const endpoint = user.role === 'kijo' ? `/api/kijo/sessions/${user.id}` : `/api/jokies/orders/${user.id}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        // Kijo endpoint returns grouped object { upcoming, ongoing, history }
        if (user.role === 'kijo') {
          const allOrders = [...data.upcoming, ...data.ongoing, ...data.history];
          setOrders(allOrders);
        } else {
          setOrders(data);
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

  const handleCancelOrder = async () => {
    if (!cancelReason) return alert('Mohon isi alasan pembatalan');
    setIsCancelling(true);
    try {
      const res = await fetchWithAuth('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          userId: user.id,
          role: user.role,
          reason: cancelReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Pesanan berhasil dibatalkan. Saldo telah dikembalikan ke Wallet Jokies.');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert(data.message || 'Gagal membatalkan pesanan');
      }
    } catch (error) {
      alert('Gagal membatalkan pesanan');
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
        body: JSON.stringify({
          orderId: selectedOrder.id,
          jokiesId: user.id
        })
      });
      if (res.ok) {
        setShowRatingModal(true);
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.message || 'Gagal mengonfirmasi penyelesaian');
      }
    } catch (error) {
      alert('Gagal mengonfirmasi penyelesaian');
    } finally {
      setIsCompleting(false);
    }
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
        alert('Terima kasih atas ulasan Anda!');
        setShowRatingModal(false);
        setSelectedOrder(null);
        fetchOrders();
      }
    } catch (error) {
      alert('Gagal mengirim ulasan');
    }
  };

  const [sortBy, setSortBy] = useState<'date' | 'rank'>('date');

  const getRankPriority = (gameTitle: string, rankName: string) => {
    const game = globalGames.find(g => g.name === gameTitle);
    if (!game || !game.ranks) return 0;
    
    const flatRanks: string[] = [];
    game.ranks.forEach((r: any) => {
      r.tiers.forEach((t: string) => {
        flatRanks.push(`${r.title} - ${t}`);
      });
    });
    
    const index = flatRanks.indexOf(rankName);
    return index === -1 ? 0 : index;
  };

  const sortOrders = (orders: any[]) => {
    if (sortBy === 'date') {
      return [...orders].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    } else {
      return [...orders].sort((a, b) => {
        const priorityA = getRankPriority(a.game_title, a.rank_start);
        const priorityB = getRankPriority(b.game_title, b.rank_start);
        return priorityB - priorityA;
      });
    }
  };

  const groupedOrders = {
    upcoming: sortOrders(orders.filter(o => o.status === 'upcoming')),
    ongoing: sortOrders(orders.filter(o => o.status === 'ongoing')),
    history: sortOrders(orders.filter(o => o.status === 'completed' || o.status === 'cancelled'))
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

  if (selectedOrder) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <button 
          onClick={() => setSelectedOrder(null)}
          className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar
        </button>

        <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-xl">
          <div className="p-8 border-b border-border-main bg-bg-card/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                  <span className="text-[11px] md:text-xs font-bold bg-orange-primary/10 text-orange-primary px-2 py-1 rounded-md border border-orange-primary/20 uppercase tracking-widest">
                    ID: #{selectedOrder.id}
                  </span>
                  <span className={`text-[11px] md:text-xs font-bold px-2 py-1 rounded-md border uppercase tracking-widest ${
                    selectedOrder.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                    selectedOrder.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                    selectedOrder.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-orange-primary/10 text-orange-primary border-orange-primary/20'
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <h2 className="text-xl md:text-3xl font-bold text-text-main tracking-tight">
                  {user.role === 'kijo' 
                    ? (selectedOrder.jokies_nickname && selectedOrder.jokies_nickname !== '-' ? selectedOrder.jokies_nickname : selectedOrder.jokies_name)
                    : (selectedOrder.kijo_nickname && selectedOrder.kijo_nickname !== '-' ? selectedOrder.kijo_nickname : selectedOrder.title)}
                </h2>
                <p className="text-text-muted text-xs md:text-sm mt-1">
                  {selectedOrder.kijo_game_id && selectedOrder.kijo_game_id !== '-' ? selectedOrder.kijo_game_id : (selectedOrder.game_title || 'Game Session')}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs md:text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Total Pembayaran</p>
                <p className="text-2xl md:text-3xl font-bold text-orange-primary font-mono">Rp {(selectedOrder.total_price || (selectedOrder.price + (selectedOrder.admin_fee || 0))).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column: Details */}
            <div className="space-y-8">
              {/* Order Info */}
              <div className="bg-bg-main/50 p-6 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Calendar size={14} /> Detail Pemesanan
                </h3>
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Tanggal Pesan</p>
                    <p className="text-sm font-bold text-text-main">{new Date(selectedOrder.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Waktu Booking</p>
                    <p className="text-sm font-bold text-text-main">{new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Jadwal Mabar</p>
                    <p className="text-sm font-bold text-orange-primary">{new Date(selectedOrder.scheduled_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Durasi</p>
                    <p className="text-sm font-bold text-text-main">{selectedOrder.duration} Jam</p>
                  </div>
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

              {/* Payment Detail */}
              <div className="bg-bg-main/50 p-6 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CreditCard size={14} /> Rincian Pembayaran
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
                  <div className="flex justify-between pt-2 border-t border-border-main">
                    <span className="font-bold text-text-main uppercase text-xs">Total Keseluruhan</span>
                    <span className="font-bold text-orange-primary">Rp {(selectedOrder.total_price || (selectedOrder.price + (selectedOrder.admin_fee || 0))).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: Jokies */}
                <div className="bg-bg-main/50 p-6 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={14} /> Detail Jokies
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-text-main">
                      {user.role === 'kijo' 
                        ? (selectedOrder.jokies_name || selectedOrder.jokies_username)
                        : (user.full_name || user.username)}
                    </p>
                    {selectedOrder.status !== 'cancelled' ? (
                      <>
                        {selectedOrder.jokies_dynamic_data ? (
                          renderDynamicData(selectedOrder.jokies_dynamic_data)
                        ) : (
                          <>
                            <p className="text-xs text-text-muted">Nick: <span className="text-text-main font-bold">
                              {selectedOrder.jokies_nickname || '-'}
                            </span></p>
                            <p className="text-xs text-text-muted">ID: <span className="text-text-main font-bold">
                              {selectedOrder.jokies_game_id || '-'}
                            </span></p>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-text-muted italic">Detail akun disembunyikan karena pesanan dibatalkan</p>
                    )}
                  </div>
                </div>

                {/* Box 2: Kijo */}
                <div className="bg-bg-main/50 p-6 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap size={14} className="text-orange-primary" /> Detail Kijo
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-text-main">
                      {user.role === 'kijo'
                        ? (user.full_name || user.username)
                        : (selectedOrder.kijo_name || selectedOrder.kijo_username || selectedOrder.title)}
                    </p>
                    {selectedOrder.status !== 'cancelled' ? (
                      <>
                        {selectedOrder.kijo_dynamic_data ? (
                          renderDynamicData(selectedOrder.kijo_dynamic_data)
                        ) : (
                          <>
                            <p className="text-xs text-text-muted">Nick: <span className="text-text-main font-bold">
                              {selectedOrder.kijo_nickname || '-'}
                            </span></p>
                            <p className="text-xs text-text-muted">ID: <span className="text-text-main font-bold">
                              {selectedOrder.kijo_game_id || '-'}
                            </span></p>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-text-muted italic">Detail akun disembunyikan karena pesanan dibatalkan</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Proof Section (Only for Ongoing/Completed) */}
              {(selectedOrder.status === 'ongoing' || selectedOrder.status === 'completed') && (
                <div className="bg-bg-main/50 p-6 rounded-2xl border border-border-main">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ImageIcon size={14} /> Bukti Pengerjaan
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted font-bold uppercase text-center">Rank Awal</p>
                      <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden">
                        {selectedOrder.screenshot_start ? (
                          <img src={selectedOrder.screenshot_start} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-text-muted italic">Belum diunggah</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted font-bold uppercase text-center">Rank Akhir</p>
                      <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden">
                        {selectedOrder.screenshot_end ? (
                          <img src={selectedOrder.screenshot_end} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-text-muted italic">Belum diunggah</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-4">
                {(selectedOrder.status === 'upcoming' || selectedOrder.status === 'ongoing') && (
                  <div className="bg-red-500/5 p-6 rounded-2xl border border-red-500/20">
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Batalkan Pesanan</h3>
                    <p className="text-xs text-text-muted mb-4 italic">
                      * Pembatalan hanya dapat dilakukan setelah 15 menit pesanan dibuat.
                    </p>
                    <textarea 
                      placeholder="Alasan pembatalan..."
                      className="w-full bg-bg-main border border-border-main rounded-xl p-4 text-sm text-text-main focus:outline-none focus:border-red-500 mb-4 h-24"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <button 
                      onClick={handleCancelOrder}
                      disabled={isCancelling}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      {isCancelling ? 'MEMPROSES...' : 'KONFIRMASI PEMBATALAN'}
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'ongoing' && selectedOrder.kijo_finished && !selectedOrder.jokies_finished && (
                  <div className="bg-green-500/5 p-6 rounded-2xl border border-green-500/20">
                    <h3 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4">Konfirmasi Selesai</h3>
                    <p className="text-xs text-text-muted mb-6 leading-relaxed">
                      Partner telah menandai pesanan ini selesai. Pastikan pengerjaan sudah sesuai sebelum mengonfirmasi. Dana akan langsung diteruskan ke Partner.
                    </p>
                    <button 
                      onClick={handleConfirmFinish}
                      disabled={isCompleting}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-5 rounded-xl shadow-lg shadow-green-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      {isCompleting ? 'MEMPROSES...' : 'KONFIRMASI PESANAN SELESAI'}
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'ongoing' && !selectedOrder.kijo_finished && (
                  <div className="bg-bg-main p-6 rounded-2xl border border-border-main text-center">
                    <Clock className="mx-auto text-orange-primary mb-3" size={32} />
                    <p className="text-sm font-bold text-text-main mb-1">Menunggu Partner</p>
                    <p className="text-xs text-text-muted uppercase tracking-widest">Partner sedang mengerjakan pesanan Anda.</p>
                  </div>
                )}

                {selectedOrder.needs_admin_chat && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-4">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Peringatan Inaktivitas</p>
                    <p className="text-xs text-text-main leading-relaxed">Partner belum memulai sesi setelah 15 menit. Anda dapat menghubungi Admin untuk bantuan atau pembatalan.</p>
                  </div>
                )}

                <button className={`w-full border font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  selectedOrder.needs_admin_chat 
                    ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20 animate-pulse' 
                    : 'bg-bg-sidebar border-border-main text-text-main hover:border-orange-primary/30'
                }`}>
                  <MessageSquare size={18} /> CHAT ADMIN "MINOX"
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Modal */}
        <AnimatePresence>
          {showRatingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-border-main bg-bg-card/50 text-center">
                  <h3 className="text-2xl font-bold text-text-main mb-2">Beri Rating Untuk KIJO</h3>
                  <p className="text-text-muted text-sm">Bagaimana pengalaman mabar Anda dengan {selectedOrder.kijo_name}?</p>
                </div>

                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                  {/* Stars */}
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Kepuasan Umum (Wajib)</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button 
                          key={s} 
                          onClick={() => setRatingData({...ratingData, stars: s})}
                          className={`p-2 transition-all ${ratingData.stars >= s ? 'text-orange-primary scale-110' : 'text-text-muted opacity-30'}`}
                        >
                          <Star size={32} fill={ratingData.stars >= s ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Kategori Skill</p>
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button 
                            key={s} 
                            onClick={() => setRatingData({...ratingData, skillRating: s})}
                            className={`p-1 transition-all ${ratingData.skillRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                          >
                            <Star size={16} fill={ratingData.skillRating >= s ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Kategori Attitude</p>
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button 
                            key={s} 
                            onClick={() => setRatingData({...ratingData, attitudeRating: s})}
                            className={`p-1 transition-all ${ratingData.attitudeRating >= s ? 'text-orange-primary' : 'text-text-muted opacity-30'}`}
                          >
                            <Star size={16} fill={ratingData.attitudeRating >= s ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Pilih Keunggulan KIJO (Min. 1)</p>
                    <div className="flex flex-wrap gap-2">
                      {TRAIT_BADGES.map((badge) => (
                        <button 
                          key={badge.id}
                          onClick={() => {
                            const tags = ratingData.tags.includes(badge.label)
                              ? ratingData.tags.filter(t => t !== badge.label)
                              : [...ratingData.tags, badge.label];
                            setRatingData({...ratingData, tags});
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            ratingData.tags.includes(badge.label)
                              ? 'bg-orange-primary border-orange-primary text-black'
                              : 'bg-bg-main border-border-main text-text-muted hover:border-orange-primary/30'
                          }`}
                        >
                          {badge.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Testimoni (Opsional)</p>
                    <textarea 
                      placeholder="Tuliskan kesan Anda..."
                      className="w-full bg-bg-main border border-border-main rounded-xl p-4 text-sm text-text-main focus:outline-none focus:border-orange-primary h-24"
                      value={ratingData.comment}
                      onChange={(e) => setRatingData({...ratingData, comment: e.target.value})}
                    />
                  </div>
                </div>

                <div className="p-8 border-t border-border-main bg-bg-card/50 flex gap-4">
                  <button 
                    onClick={() => setShowRatingModal(false)}
                    className="flex-1 py-4 rounded-xl border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:bg-bg-main transition-all"
                  >
                    Nanti Saja
                  </button>
                  <button 
                    onClick={handleSubmitRating}
                    disabled={ratingData.tags.length === 0}
                    className="flex-1 py-4 rounded-xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/20"
                  >
                    KIRIM ULASAN
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10 pb-20 px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-text-main tracking-tighter uppercase">Pesanan <span className="text-orange-primary">Saya.</span></h1>
          <p className="text-text-muted text-xs md:text-sm mt-1 font-medium">Kelola riwayat dan pantau status joki Anda secara real-time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-bg-sidebar border border-border-main p-3 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest ml-2">Urutkan:</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs md:text-xs font-semibold uppercase tracking-wide text-text-main focus:outline-none cursor-pointer pr-4"
            >
              <option value="date">Waktu Sesi</option>
              <option value="rank">Rank Tertinggi</option>
            </select>
          </div>
          <div className="bg-bg-sidebar border border-border-main p-4 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Wallet Saya</p>
              <p className="text-sm font-bold text-text-main font-mono">Rp {user.wallet_jokies?.toLocaleString() || '0'}</p>
            </div>
            <button 
              onClick={onWithdraw}
              className="ml-2 bg-orange-primary text-black text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-widest hover:scale-105 transition-all"
            >
              Tarik Dana
            </button>
          </div>
          <button 
            onClick={fetchOrders}
            className="bg-bg-sidebar border border-border-main p-4 rounded-2xl text-text-muted hover:text-orange-primary hover:border-orange-primary/30 transition-all shadow-sm"
          >
            <Zap size={20} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Sinkronisasi Pesanan...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-16 text-center space-y-6 shadow-sm">
          <div className="w-24 h-24 bg-bg-main rounded-full flex items-center justify-center mx-auto text-text-muted border border-border-main shadow-inner">
            <Package size={48} />
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="text-text-main font-bold text-xl mb-2">Belum Ada Pesanan</h3>
            <p className="text-text-muted text-sm leading-relaxed">Sepertinya Anda belum memesan jasa KIJO. Cari partner terbaikmu sekarang!</p>
          </div>
          <button className="bg-orange-primary text-black font-bold px-10 py-4 rounded-2xl text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/10">
            LIHAT MARKETPLACE
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Upcoming Section */}
          {groupedOrders.upcoming.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-orange-primary/10 flex items-center justify-center text-orange-primary">
                  <Calendar size={18} />
                </div>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Sesi Mendatang</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedOrders.upcoming.map(order => (
                  <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
                ))}
              </div>
            </section>
          )}

          {/* Ongoing Section */}
          {groupedOrders.ongoing.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Activity size={18} />
                </div>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Sedang Berjalan</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedOrders.ongoing.map(order => (
                  <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} active />
                ))}
              </div>
            </section>
          )}

          {/* History Section */}
          {groupedOrders.history.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-bg-card flex items-center justify-center text-text-muted">
                  <History size={18} />
                </div>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">History Pesanan</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {groupedOrders.history.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className="bg-bg-sidebar border border-border-main rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-orange-primary/20 transition-all cursor-pointer group opacity-80 hover:opacity-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-bg-main rounded-xl flex items-center justify-center text-text-muted border border-border-main group-hover:text-orange-primary transition-colors">
                        <Gamepad2 size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-text-main font-bold">{order.title}</h4>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider">
                          {order.kijo_name} • {new Date(order.scheduled_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Total</p>
                        <p className="text-lg font-bold text-text-main font-mono">Rp {(order.total_price || order.price).toLocaleString()}</p>
                      </div>
                      <ChevronRight size={20} className="text-text-muted group-hover:text-orange-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

const OrderCard: React.FC<{ order: any; onClick: () => void; active?: boolean }> = ({ order, onClick, active }) => {
  const [canStart, setCanStart] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const checkTime = () => {
      if (order.status !== 'upcoming') {
        setCanStart(false);
        setTimeLeft(null);
        return;
      }
      
      const scheduledTime = new Date(order.scheduled_at).getTime();
      const now = new Date().getTime();
      const diffMs = scheduledTime - now;
      const diffMinutes = diffMs / (1000 * 60);
      
      // Show button 10 minutes before start time
      if (diffMinutes <= 10 && diffMinutes > -60) { // Show up to 1 hour after start if not started
        setCanStart(true);
      } else {
        setCanStart(false);
      }

      // Countdown logic
      if (diffMs > 0 && diffMs <= 10 * 60 * 1000) {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(null);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const handleStartSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetchWithAuth('/api/orders/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      });
      if (res.ok) {
        alert('Sesi dimulai! Silakan hubungi Partner.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-bg-sidebar border rounded-2xl p-6 transition-all cursor-pointer group hover:scale-[1.02] ${
        active ? 'border-blue-500/50 shadow-lg shadow-blue-500/5' : 'border-border-main hover:border-orange-primary/30'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${active ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-primary/10 text-orange-primary'}`}>
          <Gamepad2 size={24} />
        </div>
        <div className="flex flex-col items-end">
          {timeLeft && (
            <div className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full mb-1 animate-pulse flex items-center gap-1">
              <Clock size={8} /> {timeLeft}
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">ID Pesanan</p>
            <p className="text-xs font-bold text-text-main font-mono">#{order.id}</p>
          </div>
        </div>
      </div>
      
      <h4 className="text-lg font-bold text-text-main mb-1 group-hover:text-orange-primary transition-colors">
        {order.title} {order.quantity > 1 ? `(x${order.quantity})` : ''}
      </h4>
      <p className="text-xs text-text-muted mb-4 flex items-center gap-2">
        <Zap size={12} className="text-orange-primary" /> {order.kijo_name}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-border-main">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-500 animate-pulse' : 'bg-orange-primary'}`} />
          <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{order.scheduled_at}</span>
        </div>
        <span className="text-sm font-bold text-text-main font-mono">Rp {(order.total_price || order.price).toLocaleString()}</span>
      </div>
    </div>
  );
};

const Activity: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

const History: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
    <path d="M12 7v5l4 2"></path>
  </svg>
);
