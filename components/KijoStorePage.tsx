import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Star
} from 'lucide-react';
import PaymentPage from './PaymentPage';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { formatDuration } from '@/utils/formatters';
import { useAlert } from './AlertContext';

interface KijoStorePageProps {
  user: any;
  kijoId: number;
  onBack: () => void;
  onOrderSuccess: () => void;
  systemStatus: { status: string; schedule?: any };
}

export default function KijoStorePage({ user, kijoId, onBack, onOrderSuccess, systemStatus }: KijoStorePageProps) {
  const { showAlert } = useAlert();

  // Kijo data
  const [kijo, setKijo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kijoHistory, setKijoHistory] = useState<any[]>([]);
  const [selectedBoostingAccountId, setSelectedBoostingAccountId] = useState<number | null>(null);

  // Admin fee
  const [adminFeePercent, setAdminFeePercent] = useState(10);

  // Available games (for schema-based form fields)
  const [availableGames, setAvailableGames] = useState<any[]>([]);

  // User's personal game accounts
  const [userGameAccounts, setUserGameAccounts] = useState<any[]>([]);

  // Booking flow
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [selectedGameName, setSelectedGameName] = useState('');
  const [matchingAccounts, setMatchingAccounts] = useState<any[]>([]);
  const [adminFeeAmount, setAdminFeeAmount] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isPaying, setIsPaying] = useState(false);

  // Scheduling
  const [availableSlots, setAvailableSlots] = useState<any>(null);
  const toLocalDateStr = (d = new Date()) => {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
  const [selectedTime, setSelectedTime] = useState('');

  // Booking form data
  const [bookingData, setBookingData] = useState({
    nickname: '',
    gameId: '',
    dynamic_data: {} as any,
    gameAccountId: null as number | null,
    paymentMethod: 'Wallet',
    scheduledAt: '',
    gameTitle: '',
    categoryId: null as number | null,
    quantity: 1,
    player_count: 1
  });

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Reset all booking state when kijoId changes
    setSelectedDate(toLocalDateStr());
    setSelectedTime('');
    setBookingStep(1);
    setSelectedPackage(null);
    setAvailableSlots(null);
    setSelectedBoostingAccountId(null);
    setIsPaying(false);
    setBookingData({
      nickname: '', gameId: '', dynamic_data: {}, gameAccountId: null,
      paymentMethod: 'Wallet', scheduledAt: '', gameTitle: '',
      categoryId: null, quantity: 1, player_count: 1
    });

    const load = async () => {
      setIsLoading(true);
      try {
        const [detailRes, historyRes, gamesRes, feeRes, accountsRes, reviewsRes] = await Promise.all([
          fetchWithAuth(`/api/marketplace/kijo/${kijoId}`),
          fetchWithAuth(`/api/marketplace/kijo/${kijoId}/history`),
          fetchWithAuth('/api/kijo/available-games'),
          fetchWithAuth('/api/settings/admin-fee'),
          fetchWithAuth(`/api/kijo/game-accounts/${user.id}`),
          fetchWithAuth(`/api/marketplace/kijo/${kijoId}/reviews`)
        ]);

        if (detailRes.ok) {
          const data = await detailRes.json();
          setKijo(data);
          if (data.boosting_accounts && data.boosting_accounts.length === 1) {
            setSelectedBoostingAccountId(data.boosting_accounts[0].id);
          }
        }
        if (historyRes.ok) setKijoHistory(await historyRes.json());
        if (gamesRes.ok) setAvailableGames(await gamesRes.json());
        if (feeRes.ok) {
          const d = await feeRes.json();
          setAdminFeePercent(d.admin_fee || 10);
        }
        if (accountsRes.ok) setUserGameAccounts(await accountsRes.json());
        if (reviewsRes.ok) setReviews(await reviewsRes.json());
      } catch (e) {
        console.error('KijoStorePage load error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [kijoId, user.id]);

  // ── Fetch available slots when kijo or date changes, or returning from payment ──
  const fetchAvailableSlots = useCallback(async () => {
    if (!kijo || !selectedDate) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/available-slots/${kijo.id}?date=${selectedDate}`);
      if (res.ok) setAvailableSlots(await res.json());
    } catch (e) {
      console.error('Error fetching slots:', e);
    }
  }, [kijo, selectedDate]);

  useEffect(() => {
    fetchAvailableSlots();
  }, [fetchAvailableSlots]);

  // ── Recompute admin fee & total when package/qty changes ────────────────────
  useEffect(() => {
    const basePrice = (selectedPackage?.price || 0) * (bookingData.quantity || 1);
    const amount = selectedPackage ? Math.round((basePrice * adminFeePercent) / 100) : 0;
    setAdminFeeAmount(amount);
    setTotalPrice(selectedPackage ? basePrice + amount : 0);
  }, [selectedPackage, adminFeePercent, bookingData.quantity]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const calculateTotalDuration = (qtyOverride?: number) => {
    if (!selectedPackage) return 0;
    const qty = qtyOverride !== undefined ? qtyOverride : (bookingData.quantity || 1);
    const baseDuration = selectedPackage.duration || 0;
    if (selectedPackage.is_recurring === 1) {
      return baseDuration * qty;
    }
    return baseDuration;
  };

  const getMaxPossibleQuantity = (startTimeStr: string) => {
    if (!selectedPackage || !availableSlots?.work_end) return 1;
    const [h, m] = startTimeStr.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(h, m, 0, 0);
    const [weH, weM] = availableSlots.work_end.split(':').map(Number);
    const workEnd = new Date(startTime);
    workEnd.setHours(weH, weM, 0, 0);
    if (workEnd <= startTime) workEnd.setDate(workEnd.getDate() + 1);
    const availableMins = (workEnd.getTime() - startTime.getTime()) / 60000;
    const breakMins = (availableSlots.break_time || 0) * 60;
    let maxQ = 1;
    const rawMaxSlots = kijo?.max_slots ?? 3;
    const activeOrders = kijo?.active_orders || 0;
    const kijoMax = rawMaxSlots === 0 ? 999 : Math.max(0, rawMaxSlots - activeOrders);
    const absoluteMax = selectedPackage.is_recurring === 1 ? kijoMax : 1;
    for (let q = 1; q <= absoluteMax; q++) {
      if (calculateTotalDuration(q) + breakMins <= availableMins) maxQ = q;
      else break;
    }
    return maxQ;
  };

  const handleSelectPackage = (pkg: any, categoryName: string, categoryId: number, gameName?: string) => {
    const matches = userGameAccounts.filter(a => {
      if (a.account_type !== 'personal') return false;
      const userGame = (a?.game_name || '').toLowerCase();
      const catGame = (gameName || '').toLowerCase();
      const catName = (categoryName || '').toLowerCase();
      const kijoVer = (kijo?.verified_game || '').toLowerCase();
      const matchCatGame = catGame && (userGame === catGame || userGame.includes(catGame) || catGame.includes(userGame));
      const matchCatName = catName && (userGame === catName || userGame.includes(catName) || catName.includes(userGame));
      const matchVer = kijoVer && (userGame === kijoVer || userGame.includes(kijoVer) || kijoVer.includes(userGame));
      return userGame && (matchCatGame || matchCatName || matchVer);
    });
    setMatchingAccounts(matches);
    setSelectedPackage(pkg);
    setSelectedCategoryName(categoryName);
    setSelectedGameName(gameName || '');
    setSelectedTime('');
    setBookingStep(2);
    if (matches.length === 1) {
      const acc = matches[0];
      const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
      setBookingData(prev => ({
        ...prev,
        nickname: acc.nickname,
        gameId: `${acc.game_id}${acc.server ? ` (${acc.server})` : ''}`,
        dynamic_data: dynamic,
        gameAccountId: acc.id,
        gameTitle: gameName || '',
        categoryId,
        player_count: pkg.min_players || 2
      }));
    } else {
      setBookingData(prev => ({
        ...prev,
        nickname: '',
        gameId: '',
        dynamic_data: {},
        gameAccountId: null,
        gameTitle: gameName || '',
        categoryId,
        player_count: pkg.min_players || 2
      }));
    }
  };

  // ── Time Slots ──────────────────────────────────────────────────────────────
  const timeSlots = useMemo(() => {
    if (!availableSlots) return [];
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = DAYS_ID[new Date(selectedDate).getDay()];
    const allowedDays = availableSlots.weekly_days ? availableSlots.weekly_days.split(',') : [];
    if (allowedDays.length > 0 && !allowedDays.includes(dayName)) return [];

    const kijoHolidays: Array<{ start_date: string; end_date: string | null }> = availableSlots.holidays || [];

    const [startH, startM] = availableSlots.work_start.split(':').map(Number);
    const [endH, endM] = availableSlots.work_end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

    const totalDurationMins = calculateTotalDuration();
    const baseDurationMins = calculateTotalDuration(1);
    const breakMins = (availableSlots.break_time || 0) * 60;
    const slots = [];

    for (let min = startMinutes; min < endMinutes; min += 30) {
      const hour = Math.floor((min / 60) % 24);
      const minute = min % 60;
      const isNextDay = min >= 24 * 60;
      const slotTime = new Date(selectedDate);
      if (isNextDay) slotTime.setDate(slotTime.getDate() + 1);
      slotTime.setHours(hour, minute, 0, 0);

      const now = new Date();
      const LEAD_TIME_MS = 20 * 60 * 1000; // 20-minute lead time required before booking
      let type: 'available' | 'busy' | 'past' | 'overlap' = slotTime.getTime() - now.getTime() < LEAD_TIME_MS ? 'past' : 'available';

      if (type === 'available' && availableSlots.break_until) {
        if (slotTime < new Date(availableSlots.break_until)) type = 'busy';
      }

      let busySubType: 'none' | 'active' | 'break' | 'pre' | 'holiday' = 'none';
      let isFirstBreak = false;
      // Holiday check — block individual slots that fall within a day-off window
      if (type === 'available') {
        for (const h of kijoHolidays) {
          const hStart = new Date(h.start_date);
          const hEnd = h.end_date ? new Date(h.end_date) : null;
          if (slotTime >= hStart && (!hEnd || slotTime < hEnd)) {
            type = 'busy'; busySubType = 'holiday'; break;
          }
        }
      }
      if (type === 'available') {
        for (const s of availableSlots.busy_slots) {
          const sessionStart = new Date(s.start);
          const sessionEnd = new Date(sessionStart.getTime() + ((s.duration || 1) * 60) * 60 * 1000);
          const breakEnd = new Date(sessionEnd.getTime() + breakMins * 60 * 1000);
          const preStart = new Date(sessionStart.getTime() - (totalDurationMins + breakMins) * 60 * 1000);
          const slotMs = slotTime.getTime();
          if (slotMs >= sessionStart.getTime() && slotMs < sessionEnd.getTime()) {
            busySubType = 'active'; type = 'busy'; isFirstBreak = false; break;
          } else if (slotMs >= sessionEnd.getTime() && slotMs < breakEnd.getTime()) {
            busySubType = 'break'; type = 'busy';
            if (slotMs === sessionEnd.getTime()) isFirstBreak = true;
          } else if (slotMs > preStart.getTime() && slotMs < sessionStart.getTime()) {
            if (busySubType === 'none') { busySubType = 'pre'; type = 'busy'; }
          }
        }
      }

      const checkFullAvailability = () => {
        const sessionEnd = new Date(slotTime.getTime() + (baseDurationMins + breakMins) * 60 * 1000);
        const workEndDate = new Date(selectedDate);
        workEndDate.setHours(0, endMinutes, 0, 0);
        if (sessionEnd.getTime() > workEndDate.getTime()) return false;
        return !availableSlots.busy_slots.some((s: any) => {
          const sStart = new Date(s.start).getTime();
          const sEnd = sStart + ((s.duration || 1) * 60 + breakMins) * 60 * 1000;
          return slotTime.getTime() < sEnd && sessionEnd.getTime() > sStart;
        });
      };

      const available = type === 'available' && checkFullAvailability();
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        hour, minute, isNextDay, type, busySubType, isFirstBreak, available
      });
    }
    return slots;
  }, [availableSlots, selectedDate, bookingData.quantity, selectedPackage]);

  // ── Calendar day strip (respects weekly_days + holidays) ───────────────────
  const calendarDays = useMemo(() => {
    const DAYS_ID_LOC = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const DAYS_SHORT  = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const preOrderDays = availableSlots?.pre_order_days ?? 7;
    const weeklyAllowed: string[] = availableSlots?.weekly_days
      ? availableSlots.weekly_days.split(',').map((d: string) => d.trim())
      : [];
    const kijoHolidays: Array<{ start_date: string; end_date: string | null }> = availableSlots?.holidays || [];

    const [wsh2, wsm2] = (availableSlots?.work_start || '08:00').split(':').map(Number);
    const [weh2, wem2] = (availableSlots?.work_end || '22:00').split(':').map(Number);
    const isDisabled = (d: Date): boolean => {
      if (weeklyAllowed.length > 0 && !weeklyAllowed.includes(DAYS_ID_LOC[d.getDay()])) return true;
      if (kijoHolidays.length === 0) return false;
      // Disable only if the ENTIRE work window on this day is covered by holidays
      const wStart = new Date(d); wStart.setHours(wsh2, wsm2, 0, 0);
      const wEnd = new Date(d); wEnd.setHours(weh2, wem2, 0, 0);
      if (wEnd <= wStart) wEnd.setDate(wEnd.getDate() + 1);
      for (let t = new Date(wStart); t < wEnd; t.setMinutes(t.getMinutes() + 30)) {
        const tSnap = new Date(t);
        const covered = kijoHolidays.some(h => {
          const hStart = new Date(h.start_date);
          const hEnd = h.end_date ? new Date(h.end_date) : null;
          return tSnap >= hStart && (!hEnd || tSnap < hEnd);
        });
        if (!covered) return false;
      }
      return true;
    };

    const localStr = (d: Date) => {
      const y = d.getFullYear(), mo = d.getMonth() + 1, day = d.getDate();
      return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const days = [];
    for (let i = 0; i <= preOrderDays; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dateStr = localStr(d);
      days.push({
        dateStr,
        dayShort: DAYS_SHORT[d.getDay()],
        dayNum: d.getDate(),
        disabled: isDisabled(d)
      });
    }
    return days;
  }, [availableSlots]);

  // ── PaymentPage ─────────────────────────────────────────────────────────────
  if (isPaying && kijo && selectedPackage) {
    return (
      <PaymentPage
        user={user}
        kijo={kijo}
        pkg={selectedPackage}
        bookingData={{
          ...bookingData,
          gameTitle: selectedGameName || selectedCategoryName,
          duration: calculateTotalDuration() / 60,
          scheduledAt: `${selectedDate}T${selectedTime}:00`,
          kijoGameAccountId: selectedBoostingAccountId || undefined
        }}
        onBack={() => { setIsPaying(false); fetchAvailableSlots(); }}
        onSuccess={() => {
          setIsPaying(false);
          fetchAvailableSlots();
          onOrderSuccess();
        }}
      />
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 py-20 flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Memuat Toko Partner...</p>
      </div>
    );
  }

  if (!kijo) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 py-20 text-center">
        <p className="text-text-muted text-sm font-bold">Partner tidak ditemukan.</p>
        <button onClick={onBack} className="mt-4 text-orange-primary font-bold text-sm hover:underline flex items-center gap-2 mx-auto">
          <ArrowLeft size={16} /> Kembali ke Marketplace
        </button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 pb-20 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={onBack}
          className="p-2 bg-bg-sidebar border border-border-main rounded-xl text-text-muted hover:text-text-main hover:border-orange-primary/30 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Marketplace / Toko Partner</p>
          <h1 className="text-lg font-bold text-text-main">{kijo.full_name}</h1>
        </div>
      </div>

      {/* Main Content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left Column: Profile & Info ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Profile Card */}
          <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm">
            <div className="relative h-52 overflow-hidden">
              <img
                src={kijo.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kijo.username}`}
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-sidebar via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-text-main">{kijo.full_name}</h2>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    kijo.effective_status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                    kijo.effective_status === 'busy' ? 'bg-orange-primary' :
                    kijo.effective_status === 'holiday' ? 'bg-blue-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-orange-primary">
                    <Star size={13} fill="currentColor" />
                    <span className="text-sm font-bold">{kijo.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-text-muted text-xs font-bold">({kijo.total_reviews} Ulasan)</span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Status warning */}
              {kijo.effective_status === 'busy' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <div>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Slot Penuh</p>
                    <p className="text-xs text-red-500/80 font-bold leading-relaxed">
                      Partner ini telah mencapai batas maksimal pesanan aktif ({kijo.max_slots} slot).
                    </p>
                  </div>
                </div>
              )}

              {/* Motto & Detail */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Motto & Detail</span>
                </div>
                <p className="text-xs font-bold text-text-muted italic leading-relaxed">"{kijo.motto || 'Siap menggendong Anda sampai rank impian!'}"</p>
                <p className="text-text-muted text-xs leading-relaxed">{kijo.detail_kijo || 'Partner profesional dengan jam terbang tinggi.'}</p>
              </div>

              {/* Traits */}
              {kijo.traits && kijo.traits.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {kijo.traits.map((t: any) => (
                    <div key={t.trait_key} className="flex items-center gap-1 px-2 py-1 bg-bg-main border border-border-main rounded-lg">
                      <span className="text-[11px] font-bold text-text-main uppercase tracking-widest">{t.trait_key.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-main">
                <div className="bg-bg-main p-3 rounded-xl border border-border-main text-center">
                  <p className="text-[11px] text-text-muted font-bold uppercase mb-1">Pesanan Aktif</p>
                  <p className="text-sm font-bold text-text-main">{kijo.active_orders || 0}</p>
                </div>
                <div className="bg-bg-main p-3 rounded-xl border border-border-main text-center">
                  <p className="text-[11px] text-text-muted font-bold uppercase mb-1">Waktu Aktif</p>
                  <p className="text-xs font-bold text-orange-primary">{kijo.work_start} – {kijo.work_end}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Rating & Review Box */}
          <button
            onClick={() => setShowReviewsModal(true)}
            className="w-full bg-bg-sidebar border border-border-main rounded-2xl p-4 shadow-sm hover:border-orange-primary/30 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-orange-primary" fill="currentColor" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Rating & Ulasan</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-text-main">{(kijo.rating || 0).toFixed(1)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={12} className={s <= Math.round(kijo.rating || 0) ? 'text-orange-primary' : 'text-border-main'} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-text-muted">{kijo.total_reviews || 0} ulasan</p>
              </div>
            </div>
            {reviews.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-main">
                <p className="text-xs text-text-muted italic line-clamp-2">"{reviews[0].comment || 'Tidak ada komentar'}"</p>
                <p className="text-[11px] font-bold text-text-muted mt-1">— {reviews[0].jokies_name}</p>
              </div>
            )}
          </button>

          {/* Order History */}
          {kijoHistory.length > 0 && (
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Riwayat Pesanan</h3>
              </div>
              <div className="space-y-2">
                {kijoHistory.map((h: any) => (
                  <div key={h.id} className="bg-bg-main border border-border-main rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-text-main uppercase tracking-tight">{h.title}</p>
                      <p className="text-[11px] text-text-muted font-bold uppercase">{new Date(h.scheduled_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] text-text-muted font-semibold uppercase">{h.package_type}</p>
                        <p className="text-xs font-bold text-text-main">{formatDuration(h.duration)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Packages + Booking ─────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {bookingStep === 1 ? (
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Pilihan Paket</h3>
              </div>

              <div className="space-y-3">
                {(() => {
                  const etalase = kijo.etalase || [];
                  const filtered = etalase.filter((cat: any) =>
                    !selectedBoostingAccountId ||
                    cat.game_account_id === selectedBoostingAccountId ||
                    !cat.game_account_id
                  );

                  if (etalase.length === 0) {
                    return (
                      <div className="p-8 text-center bg-bg-main border border-dashed border-border-main rounded-2xl">
                        <p className="text-text-muted text-xs italic">Partner ini belum memiliki paket aktif.</p>
                      </div>
                    );
                  }
                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center bg-bg-main border border-dashed border-border-main rounded-2xl">
                        <p className="text-text-muted text-xs italic">Tidak ada kategori untuk akun yang dipilih.</p>
                      </div>
                    );
                  }

                  return filtered.map((cat: any) => (
                    <div key={cat.id} className="space-y-2">
                      <div className="flex items-center justify-between ml-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-orange-primary/60 uppercase tracking-widest">{cat.name}</p>
                          {cat.rank && (
                            <span className="bg-orange-primary/10 text-orange-primary text-[11px] font-bold px-1.5 py-0.5 rounded border border-orange-primary/20 uppercase tracking-widest">
                              {cat.rank}
                            </span>
                          )}
                        </div>
                        {cat.game_name && (
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-tighter bg-bg-main px-1.5 py-0.5 rounded border border-border-main">
                            {cat.game_name}
                          </span>
                        )}
                      </div>
                      {cat.packages.length === 0 ? (
                        <div className="p-4 text-center bg-bg-main/30 border border-dashed border-border-main rounded-xl">
                          <p className="text-xs text-text-muted italic">Kategori ini belum memiliki paket.</p>
                        </div>
                      ) : (
                        cat.packages.map((pkg: any) => (
                          <button
                            key={pkg.id}
                            disabled={kijo.effective_status === 'busy'}
                            onClick={() => handleSelectPackage(pkg, cat.name, cat.id, cat.game_name)}
                            className={`w-full bg-bg-main border border-border-main rounded-2xl p-5 flex items-center justify-between group transition-all ${
                              kijo.effective_status === 'busy'
                                ? 'opacity-40 cursor-not-allowed grayscale'
                                : 'hover:border-orange-primary'
                            }`}
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold transition-colors ${
                                  kijo.effective_status === 'busy' ? 'text-text-muted' : 'text-text-main group-hover:text-orange-primary'
                                }`}>
                                  {pkg.name} {pkg.package_type === 'VIP' ? `(${pkg.min_players}-${pkg.max_players} Pemain)` : ''} {pkg.rank ? `• ${pkg.rank}` : ''}
                                </p>
                                {pkg.package_type === 'VIP' && (
                                  <span className="bg-orange-primary text-black text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">VIP</span>
                                )}
                              </div>
                              {pkg.criteria && (
                                <p className="text-xs text-text-muted font-bold mt-1 italic">{pkg.criteria}</p>
                              )}
                              {pkg.is_bundle === 1 && (
                                <p className="text-xs text-orange-primary font-bold uppercase mt-1">{pkg.bundle_start} → {pkg.bundle_end}</p>
                              )}
                              <p className="text-xs text-text-muted font-bold uppercase">
                                Estimasi: {pkg.duration >= 60 ? `${Math.floor(pkg.duration / 60)} Jam${pkg.duration % 60 > 0 ? ` ${pkg.duration % 60} Menit` : ''}` : `${pkg.duration} Menit`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold font-mono ${kijo.effective_status === 'busy' ? 'text-text-muted' : 'text-text-main'}`}>
                                Rp {Math.round(pkg.price * (1 + adminFeePercent / 100)).toLocaleString()}
                              </p>
                              <p className={`text-xs font-bold uppercase ${kijo.effective_status === 'busy' ? 'text-text-muted' : 'text-orange-primary'}`}>
                                {kijo.effective_status === 'busy' ? 'Penuh' : 'Pilih Paket'}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ));
                })()}
              </div>

              {/* No personal accounts warning */}
              {userGameAccounts.filter(a => a.account_type === 'personal').length === 0 && (
                <div className="bg-orange-primary/10 border border-orange-primary/30 p-4 rounded-2xl flex items-start gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-orange-primary uppercase tracking-widest">Belum Ada Akun Game</p>
                    <p className="text-xs text-orange-primary/80 font-bold leading-relaxed uppercase">
                      Daftarkan akun personal Anda di menu Akun sebelum melakukan pemesanan.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Step 2: Booking Confirmation ── */
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 shadow-sm space-y-8"
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setBookingStep(1); setSelectedTime(''); }}
                  className="p-2 bg-bg-main border border-border-main rounded-xl text-text-muted hover:text-text-main transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-xl font-bold text-text-main">Konfirmasi Pemesanan</h3>
              </div>

              <div className="bg-bg-main p-6 rounded-2xl border border-border-main space-y-6">
                {/* Schedule */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Jadwal</label>
                      {selectedTime && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                          <div className="flex items-center gap-2 bg-orange-primary/10 px-3 py-2 rounded-xl border border-orange-primary/20">
                            <span className="text-xs font-bold text-orange-primary uppercase tracking-tighter">
                              Selesai: {(() => {
                                const [h, m] = selectedTime.split(':').map(Number);
                                const totalMins = h * 60 + m + calculateTotalDuration();
                                const fH = Math.floor((totalMins / 60) % 24);
                                const fM = totalMins % 60;
                                return `${fH.toString().padStart(2, '0')}:${fM.toString().padStart(2, '0')}${totalMins >= 24 * 60 ? ' (Besok)' : ''}`;
                              })()}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedTime('')}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all"
                          >
                            <span className="font-bold text-sm">×</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Day strip: respects weekly_days + holidays */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                      {calendarDays.map(day => (
                        <button
                          key={day.dateStr}
                          disabled={day.disabled}
                          onClick={() => { if (!day.disabled) { setSelectedDate(day.dateStr); setSelectedTime(''); } }}
                          className={`flex flex-col items-center justify-center min-w-[44px] py-2 px-1 rounded-xl border transition-all text-center shrink-0 ${
                            day.disabled
                              ? 'opacity-35 cursor-not-allowed bg-bg-main border-border-main text-text-muted'
                              : selectedDate === day.dateStr
                                ? 'bg-orange-primary border-orange-primary text-black'
                                : 'bg-bg-sidebar border-border-main text-text-main hover:border-orange-primary/50 cursor-pointer'
                          }`}
                          title={day.disabled ? 'Hari tidak aktif' : day.dateStr}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider">{day.dayShort}</span>
                          <span className="text-sm font-bold leading-tight">{day.dayNum}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.length === 0 && availableSlots && (
                      <div className="col-span-4 py-8 text-center bg-bg-sidebar border border-border-main rounded-xl">
                        <p className="text-xs text-text-muted italic">Maaf, partner tidak aktif pada hari ini.</p>
                      </div>
                    )}
                    {timeSlots.map(slot => {
                      const totalDuration = calculateTotalDuration();
                      const breakMins = (availableSlots?.break_time || 0) * 60;

                      let status: 'none' | 'selected' | 'active' | 'break' | 'pre' = 'none';
                      if (selectedTime) {
                        const [selH, selM] = selectedTime.split(':').map(Number);
                        const selTotal = selH * 60 + selM;
                        const slotTotal = slot.hour * 60 + slot.minute + (slot.isNextDay ? 24 * 60 : 0);
                        if (selectedTime === slot.time) status = 'selected';
                        else if (slotTotal > selTotal && slotTotal < selTotal + totalDuration) status = 'active';
                        else if (slotTotal === selTotal + totalDuration) status = 'break';
                      }

                      const isBookedActive = slot.type === 'busy' && slot.busySubType === 'active';
                      const isBookedBreak = slot.type === 'busy' && slot.busySubType === 'break';
                      const isBookedPre = slot.type === 'busy' && slot.busySubType === 'pre';
                      const isHoliday = slot.type === 'busy' && slot.busySubType === 'holiday';

                      return (
                        <button
                          key={`${slot.time}-${slot.isNextDay}`}
                          disabled={!slot.available}
                          onClick={() => {
                            setSelectedTime(slot.time);
                            const maxQ = getMaxPossibleQuantity(slot.time);
                            if (bookingData.quantity > maxQ) {
                              setBookingData(prev => ({ ...prev, quantity: maxQ }));
                            }
                          }}
                          className={`py-2 rounded-lg text-xs font-bold border transition-all relative overflow-hidden ${
                            !slot.available ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'
                          } ${
                            status === 'selected'
                              ? 'bg-orange-primary border-orange-primary text-black z-10'
                              : status === 'active' || isBookedActive
                                ? 'bg-orange-primary/30 border-orange-primary/50 text-orange-primary/90'
                                : status === 'break' || isBookedBreak
                                  ? (status === 'break' || slot.isFirstBreak)
                                    ? 'bg-gradient-to-r from-orange-primary/40 to-blue-500/40 border-blue-500/50 text-blue-100'
                                    : 'bg-blue-500/30 border-blue-500/50 text-blue-100'
                                  : isBookedPre
                                    ? 'bg-gray-800/80 border-gray-700 text-gray-400'
                                    : isHoliday
                                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                      : slot.available
                                      ? 'bg-bg-sidebar border-border-main text-text-main hover:border-orange-primary/50'
                                      : slot.type === 'busy'
                                        ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                                        : 'bg-red-500/10 border-red-500/20 text-red-500/50'
                          }`}
                        >
                          {slot.time}
                          {isBookedActive && <span className="block text-xs font-bold uppercase">Booked</span>}
                          {isHoliday && <span className="block text-xs font-bold uppercase">Libur</span>}
                          {slot.type === 'busy' && status === 'none' && !slot.busySubType && <span className="block text-xs font-bold uppercase">Penuh</span>}
                          {slot.type === 'past' && status === 'none' && <span className="block text-xs opacity-70 uppercase">Lewat</span>}
                          {slot.isNextDay && <span className="block text-xs opacity-50 uppercase">Besok</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* VIP player count */}
                {selectedPackage?.package_type === 'VIP' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Jumlah Pemain</label>
                    <div className="flex items-center gap-4 bg-bg-sidebar border border-border-main rounded-xl p-2">
                      <button
                        onClick={() => setBookingData(prev => ({ ...prev, player_count: Math.max(selectedPackage.min_players || 2, (prev.player_count || 2) - 1) }))}
                        className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                      >-</button>
                      <div className="flex-1 text-center font-bold text-lg text-text-main">
                        {bookingData.player_count || selectedPackage.min_players || 2}
                      </div>
                      <button
                        onClick={() => setBookingData(prev => {
                          const current = prev.player_count || selectedPackage.min_players || 2;
                          const pkgMax = selectedPackage.max_players || selectedPackage.min_players || 2;
                          return { ...prev, player_count: Math.min(pkgMax, current + 1) };
                        })}
                        disabled={bookingData.player_count >= (selectedPackage.max_players || selectedPackage.min_players || 2)}
                        className={`w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl ${bookingData.player_count >= (selectedPackage.max_players || selectedPackage.min_players || 2) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >+</button>
                    </div>
                    <p className="text-xs font-bold text-text-muted ml-1 uppercase tracking-wider">
                      Paket ini mendukung {selectedPackage.min_players}–{selectedPackage.max_players} pemain.
                    </p>
                  </div>
                )}

                {/* Recurring quantity */}
                {selectedPackage?.is_recurring === 1 && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Kuantitas Pesanan</label>
                    <div className="flex items-center gap-4 bg-bg-sidebar border border-border-main rounded-xl p-2">
                      <button
                        onClick={() => setBookingData(prev => ({ ...prev, quantity: Math.max(1, (prev.quantity || 1) - 1) }))}
                        className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                      >-</button>
                      <div className="flex-1 text-center font-bold text-lg text-text-main">{bookingData.quantity || 1}</div>
                      <button
                        onClick={() => {
                          const nextQty = (bookingData.quantity || 1) + 1;
                          const rawMax = kijo?.max_slots ?? 3;
                          if (rawMax !== 0 && nextQty > rawMax) {
                            showAlert(`Kuantitas tidak dapat melebihi batas maksimal pesanan Partner (${rawMax})!`, 'warning');
                            return;
                          }
                          if (selectedTime && availableSlots?.work_end) {
                            const maxQ = getMaxPossibleQuantity(selectedTime);
                            if (nextQty > maxQ) {
                              showAlert('Kuantitas tidak dapat ditambah karena melebihi jam kerja Partner!', 'warning');
                              return;
                            }
                          }
                          setBookingData(prev => ({ ...prev, quantity: nextQty }));
                        }}
                        className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                      >+</button>
                    </div>
                    <p className="text-xs font-bold text-text-muted ml-1 uppercase tracking-wider">Paket ini mendukung pemesanan berulang.</p>
                  </div>
                )}

                {/* Account selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Akun Terpilih</label>
                  {matchingAccounts.length >= 1 ? (
                    <div className="relative">
                      <select
                        className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary appearance-none cursor-pointer font-bold"
                        value={bookingData.gameAccountId || ''}
                        onChange={(e) => {
                          const accId = parseInt(e.target.value);
                          const acc = matchingAccounts.find(a => a.id === accId);
                          if (acc) {
                            const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                            let formattedId = acc.game_id || '';
                            if (dynamic['Hashtag'] && !formattedId.includes('#')) formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                            else if (!formattedId && dynamic['ID Game']) {
                              formattedId = dynamic['ID Game'];
                              if (dynamic['Hashtag']) formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                            }
                            const server = acc.server || dynamic['Server ID'] || dynamic['Server'];
                            if (server) formattedId = `${formattedId} (${server})`;
                            setBookingData({ ...bookingData, nickname: acc.nickname || dynamic['Nickname'] || '-', gameId: formattedId || '-', dynamic_data: dynamic, gameAccountId: acc.id });
                          } else {
                            setBookingData({ ...bookingData, nickname: '', gameId: '', dynamic_data: {}, gameAccountId: null });
                          }
                        }}
                      >
                        <option value="">-- Pilih Akun --</option>
                        {matchingAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.nickname} ({acc.rank})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="bg-bg-sidebar border border-dashed border-border-main rounded-xl py-3 px-4 text-xs text-text-muted italic">
                      Tidak ada akun terdaftar untuk game ini. Silakan isi manual.
                    </div>
                  )}
                </div>

                {/* Manual fields / Akun terpilih display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!bookingData.gameAccountId ? (
                    <>
                      {(() => {
                        const game = availableGames.find(g => g.name === selectedGameName || g.name === selectedCategoryName || g.name === kijo?.verified_game);
                        const schema = game?.schema || [];
                        if (schema.length > 0) {
                          return schema.map((field: any, index: number) => (
                            <div key={index} className="space-y-1.5">
                              <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">
                                {typeof field.name === 'string' ? field.name : 'Field'}
                              </label>
                              {field.type === 'rank' ? (
                                <select
                                  required
                                  className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                  value={(bookingData.dynamic_data && bookingData.dynamic_data[field.name]) || ''}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    const fn = field.name.toLowerCase();
                                    const extra: any = {};
                                    if (fn.includes('start') || fn.includes('awal') || fn.includes('current') || fn.includes('saat ini')) extra.rankStart = newValue;
                                    else if (fn.includes('end') || fn.includes('target') || fn.includes('akhir') || fn.includes('tujuan')) extra.rankEnd = newValue;
                                    setBookingData({ ...bookingData, ...extra, dynamic_data: { ...(bookingData.dynamic_data || {}), [field.name]: newValue } });
                                  }}
                                >
                                  <option value="">Pilih Rank</option>
                                  {(game?.ranks || []).map((r: any, i: number) => (
                                    <optgroup key={i} label={r.title}>
                                      {r.tiers.map((tier: string, j: number) => (
                                        <option key={`${i}-${j}`} value={`${r.title} - ${tier}`}>{tier}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  required
                                  placeholder={typeof field.placeholder === 'string' ? field.placeholder : ''}
                                  className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                  value={(bookingData.dynamic_data && bookingData.dynamic_data[field.name]) || ''}
                                  onChange={(e) => {
                                    const nv = e.target.value;
                                    setBookingData({
                                      ...bookingData,
                                      dynamic_data: { ...(bookingData.dynamic_data || {}), [field.name]: nv },
                                      nickname: field.name === 'Nickname' || field.name === 'ID' ? nv : bookingData.nickname,
                                      gameId: field.name === 'ID Game' || field.name === 'Hashtag' || field.name === 'ID' ? nv : bookingData.gameId
                                    });
                                  }}
                                />
                              )}
                            </div>
                          ));
                        }
                        return (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nickname Game</label>
                              <input type="text" required placeholder="Your Nickname"
                                className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                value={bookingData.nickname}
                                onChange={(e) => setBookingData({ ...bookingData, nickname: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">ID Game</label>
                              <input type="text" required placeholder="12345678 (1234)"
                                className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                value={bookingData.gameId}
                                onChange={(e) => setBookingData({ ...bookingData, gameId: e.target.value })} />
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="col-span-2 bg-bg-sidebar/50 border border-border-main rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Akun Terpilih</p>
                        <p className="text-sm font-bold text-text-main">{bookingData.nickname}</p>
                        <p className="text-xs font-bold text-text-muted">{bookingData.gameId}</p>
                      </div>
                      </div>
                  )}
                </div>

                {/* Price summary */}
                <div className="pt-4 space-y-2 border-t border-border-main">
                  {matchingAccounts.length === 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex items-start gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Akses Ditolak</p>
                        <p className="text-xs font-bold text-red-500 leading-relaxed uppercase">
                          Anda WAJIB mendaftarkan akun personal untuk game <span className="font-bold underline">{selectedGameName || selectedCategoryName}</span> di menu Akun sebelum melakukan pemesanan.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted font-bold">Harga Paket {bookingData.quantity > 1 ? `(x${bookingData.quantity})` : ''}</span>
                    <span className="text-text-main font-bold">Rp {((selectedPackage?.price || 0) * (bookingData.quantity || 1)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted font-bold">Biaya Penanganan ({adminFeePercent}%)</span>
                    <span className="text-text-main font-bold">Rp {adminFeeAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border-main">
                    <span className="text-sm font-bold text-text-main uppercase">Total Bayar</span>
                    <span className="text-xl font-bold text-orange-primary font-mono">Rp {totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setBookingData(prev => ({ ...prev, scheduledAt: `${selectedDate}T${selectedTime}:00` }));
                  setIsPaying(true);
                }}
                disabled={!bookingData.nickname || !bookingData.gameId || !selectedTime || matchingAccounts.length === 0}
                className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-4 md:py-5 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base"
              >
                {matchingAccounts.length === 0 ? 'TAMBAHKAN AKUN PERSONAL DAHULU' : 'LANJUT KE PEMBAYARAN'}
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reviews Modal */}
      {showReviewsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReviewsModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-sidebar border border-border-main rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border-main flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star size={16} className="text-orange-primary" fill="currentColor" />
                <div>
                  <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">Ulasan</h3>
                  <p className="text-[11px] text-text-muted font-bold">{kijo.total_reviews || 0} ulasan · {(kijo.rating || 0).toFixed(1)} rata-rata</p>
                </div>
              </div>
              <button onClick={() => setShowReviewsModal(false)} className="p-2 hover:bg-bg-main rounded-xl transition-all">
                <span className="font-bold text-text-muted">×</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)] space-y-4">
              {/* Star Distribution */}
              <div className="space-y-1.5 pb-4 border-b border-border-main">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = reviews.filter(r => Math.round(r.stars) === star).length;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-text-muted w-3">{star}</span>
                      <Star size={10} className="text-orange-primary" fill="currentColor" />
                      <div className="flex-1 h-2 bg-bg-main rounded-full overflow-hidden">
                        <div className="h-full bg-orange-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-text-muted w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Review List */}
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-text-muted italic">Belum ada ulasan.</p>
                </div>
              ) : reviews.map((r: any, i: number) => (
                <div key={i} className="bg-bg-main border border-border-main rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={r.jokies_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.jokies_name}`}
                        className="w-7 h-7 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-xs font-bold text-text-main">{r.jokies_name}</p>
                        <p className="text-[11px] text-text-muted font-bold">{new Date(r.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={10} className={s <= Math.round(r.stars) ? 'text-orange-primary' : 'text-border-main'} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-text-muted leading-relaxed">{r.comment}</p>}
                  {r.tags && (
                    <div className="flex flex-wrap gap-1">
                      {(() => { try { return (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags); } catch { return []; } })().map((tag: string, ti: number) => (
                        <span key={ti} className="text-[10px] font-bold text-orange-primary bg-orange-primary/10 px-1.5 py-0.5 rounded border border-orange-primary/20 uppercase">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                  {r.reply && (
                    <div className="mt-2 pl-3 border-l-2 border-orange-primary/30">
                      <p className="text-[11px] font-bold text-orange-primary uppercase tracking-widest mb-0.5">Balasan Partner</p>
                      <p className="text-xs text-text-muted leading-relaxed">{r.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
