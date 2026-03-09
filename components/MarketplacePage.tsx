import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Star, Shield, Zap, Clock, ChevronRight, ShoppingCart, Gamepad2, Package, CheckCircle2, AlertCircle, XCircle, ArrowLeft, Wallet, ChevronDown, Calendar, History } from 'lucide-react';
import PaymentPage from './PaymentPage';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

type MainView = 'dashboard' | 'etalase' | 'notifications' | 'traits' | 'account' | 'marketplace' | 'orders' | 'withdrawal';

interface MarketplacePageProps {
  user: any;
  setView?: (view: MainView) => void;
  onOrderSuccess?: () => void;
  systemStatus: { status: string, schedule?: any };
}

export default function MarketplacePage({ user, setView, onOrderSuccess, systemStatus }: MarketplacePageProps) {
  const [kijos, setKijos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState('Semua Game');
  const [showGameDropdown, setShowGameDropdown] = useState(false);
  const [selectedKijo, setSelectedKijo] = useState<any | null>(null);
  const [selectedBoostingAccountId, setSelectedBoostingAccountId] = useState<number | null>(null);
  const [isKijoLoading, setIsKijoLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [adminFeePercent, setAdminFeePercent] = useState(10);
  const [kijoHistory, setKijoHistory] = useState<any[]>([]);
  const [availableGames, setAvailableGames] = useState<any[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetchWithAuth('/api/kijo/available-games');
        if (res.ok) {
          const data = await res.json();
          setAvailableGames([{ name: 'Semua Game' }, ...data]);
        }
      } catch (e) {
        console.error('Failed to fetch available games');
      }
    };
    fetchGames();
  }, []);

  useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await fetchWithAuth('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setAdminFeePercent(data.admin_fee || 10);
        }
      } catch (e) {
        console.error('Failed to fetch admin fee');
      }
    };
    fetchFee();
  }, []);

  const [bookingStep, setBookingStep] = useState(1); // 1: Select Package, 2: Confirm
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [selectedGameName, setSelectedGameName] = useState('');
  const [adminFeeAmount, setAdminFeeAmount] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [userGameAccounts, setUserGameAccounts] = useState<any[]>([]);
  const [matchingAccounts, setMatchingAccounts] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserAccounts = async () => {
      try {
        const res = await fetchWithAuth(`/api/kijo/game-accounts/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          // Fetch all accounts (personal and boosting)
          setUserGameAccounts(data);
        }
      } catch (e) {
        console.error('Failed to fetch user game accounts');
      }
    };
    if (user?.id) fetchUserAccounts();
  }, [user?.id]);

  const [availableSlots, setAvailableSlots] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('');
  
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

  useEffect(() => {
    const basePrice = (selectedPackage?.price || 0) * (bookingData.quantity || 1);
    const amount = selectedPackage ? Math.round((basePrice * adminFeePercent) / 100) : 0;
    setAdminFeeAmount(amount);
    setTotalPrice(selectedPackage ? basePrice + amount : 0);
  }, [selectedPackage, adminFeePercent, bookingData.quantity]);

  const fetchKijos = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/marketplace/kijo');
      if (res.ok) {
        const data = await res.json();
        setKijos(data);
      }
    } catch (error) {
      console.error('Error fetching kijos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (systemStatus.status === 'freeze' || systemStatus.status === 'maintenance') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-12 md:p-20 text-center shadow-sm">
          <div className="w-20 h-20 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary mx-auto mb-8">
            <Clock size={40} />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main uppercase tracking-tighter mb-4">Marketplace Sedang Dibekukan</h2>
          <p className="text-text-muted text-sm md:text-base font-bold uppercase tracking-widest max-w-xl mx-auto leading-relaxed">
            Sistem akan segera memasuki masa pemeliharaan. Pemesanan baru dinonaktifkan sementara hingga pemeliharaan selesai.
          </p>
          {systemStatus.schedule && (
            <div className="mt-10 pt-10 border-t border-border-main flex flex-col items-center gap-4">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Jadwal Maintenance</p>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-bold text-text-muted uppercase">Mulai</p>
                  <p className="text-sm font-bold text-text-main">{new Date(systemStatus.schedule.start_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="w-8 h-[1px] bg-border-main" />
                <div className="text-left">
                  <p className="text-xs font-bold text-text-muted uppercase">Selesai</p>
                  <p className="text-sm font-bold text-text-main">{new Date(systemStatus.schedule.end_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const fetchAvailableSlots = async (kijoId: number, date: string) => {
    try {
      const res = await fetchWithAuth(`/api/kijo/available-slots/${kijoId}?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

  useEffect(() => {
    fetchKijos();

    const handleRefresh = () => fetchKijos();
    window.addEventListener('refreshStats', handleRefresh);
    return () => window.removeEventListener('refreshStats', handleRefresh);
  }, []);

  useEffect(() => {
    if (selectedKijo && selectedDate) {
      fetchAvailableSlots(selectedKijo.id, selectedDate);
    }
  }, [selectedKijo, selectedDate]);

  const handleSelectKijo = async (kijo: any) => {
    setSelectedKijo(kijo);
    setIsKijoLoading(true);
    setKijoHistory([]);
    try {
      const [detailsRes, historyRes] = await Promise.all([
        fetchWithAuth(`/api/marketplace/kijo/${kijo.id}`),
        fetchWithAuth(`/api/marketplace/kijo/${kijo.id}/history`)
      ]);
      
      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setSelectedKijo(data);
        
        // Auto-select if only one boosting account
        if (data.boosting_accounts && data.boosting_accounts.length === 1) {
          setSelectedBoostingAccountId(data.boosting_accounts[0].id);
        } else {
          setSelectedBoostingAccountId(null);
        }
      }
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setKijoHistory(historyData);
      }
    } catch (error) {
      console.error('Error fetching kijo details:', error);
    } finally {
      setIsKijoLoading(false);
    }
  };

  const handleSelectPackage = (pkg: any, categoryName: string, categoryId: number, gameName?: string) => {
    // Find all matching PERSONAL accounts for this game (Fuzzy matching)
    // We check category game name, category name, and the Kijo's verified game
    const matches = userGameAccounts.filter(a => {
      if (a.account_type !== 'personal') return false;
      
      const userGame = (a?.game_name || '').toLowerCase();
      const catGame = (gameName || '').toLowerCase();
      const catName = (categoryName || '').toLowerCase();
      const kijoVer = (selectedKijo?.verified_game || '').toLowerCase();
      
      // Try to match against the explicit game name of the category first
      const matchCatGame = catGame && (userGame === catGame || userGame.includes(catGame) || catGame.includes(userGame));
      // Fallback to matching against category name (e.g. "Mobile Legends - Rank")
      const matchCatName = catName && (userGame === catName || userGame.includes(catName) || catName.includes(userGame));
      // Fallback to matching against Kijo's verified game
      const matchVer = kijoVer && (userGame === kijoVer || userGame.includes(kijoVer) || kijoVer.includes(userGame));
      
      return userGame && (matchCatGame || matchCatName || matchVer);
    });
    
    setMatchingAccounts(matches);
    setSelectedPackage(pkg);
    setSelectedCategoryName(categoryName);
    setSelectedGameName(gameName || '');
    setSelectedTime(''); // Clear time choice when switching packages
    setBookingStep(2);
    
    // Auto-fill if exactly one matching account found
    if (matches.length === 1) {
      const acc = matches[0];
      setBookingData(prev => ({
        ...prev,
        nickname: acc.nickname,
        gameId: `${acc.game_id}${acc.server ? ` (${acc.server})` : ''}`,
        dynamic_data: acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {},
        gameAccountId: acc.id,
        gameTitle: gameName || '',
        categoryId: categoryId,
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
        categoryId: categoryId,
        player_count: pkg.min_players || 2
      }));
    }
  };

  const calculateTotalDuration = (qtyOverride?: number) => {
    if (!selectedPackage) return 0;
    const qty = qtyOverride !== undefined ? qtyOverride : (bookingData.quantity || 1);
    const baseDuration = selectedPackage.duration || 0; // Duration is in minutes
    if (selectedPackage.is_recurring === 1) {
      const extraDuration = selectedPackage.recurring_extra_duration || 0; // Extra duration is in minutes
      const everyQuantity = selectedPackage.recurring_every_quantity || 1;
      // Formula: floor((quantity - 1) / every_quantity)
      const extraCount = Math.floor((qty - 1) / everyQuantity);
      return baseDuration + (extraCount * extraDuration);
    }
    return baseDuration;
  };

  const getMaxPossibleQuantity = (startTimeStr: string) => {
    if (!selectedPackage || !availableSlots?.work_end) return 1;
    
    const [h, m] = startTimeStr.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(h, m, 0, 0);
    
    const [workEndH, workEndM] = availableSlots.work_end.split(':').map(Number);
    const workEndTime = new Date(startTime);
    workEndTime.setHours(workEndH, workEndM, 0, 0);
    if (workEndTime <= startTime) workEndTime.setDate(workEndTime.getDate() + 1);
    
    const availableMins = (workEndTime.getTime() - startTime.getTime()) / 60000;
    const breakMins = (availableSlots.break_time || 0) * 60;
    
    let maxQ = 1;
    const activeOrders = selectedKijo?.active_orders || 0;
    const kijoMax = Math.max(0, (selectedKijo?.max_slots || 3) - activeOrders);
    const absoluteMax = selectedPackage.is_recurring === 1 ? kijoMax : 1;
    
    for (let q = 1; q <= absoluteMax; q++) {
      if (calculateTotalDuration(q) + breakMins <= availableMins) {
        maxQ = q;
      } else {
        break;
      }
    }
    return maxQ;
  };

  const filteredKijos = kijos.filter(k => {
    const searchTerms = (search || '').toLowerCase().split(' ').filter(t => t.length > 0);
    const searchableText = `${k?.username || ''} ${k?.full_name || ''} ${(k?.games || []).join(' ')} ${k?.motto || ''}`.toLowerCase();
    
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
    const matchesGame = selectedGame === 'Semua Game' || k.games.includes(selectedGame);
    
    // Logic: If no search, only show those with packages or a profile. If searching, show all matches.
    const shouldShowByPackageCount = searchTerms.length > 0 || k.total_package_count > 0 || k.has_kijo_profile === 1;
    
    return matchesSearch && matchesGame && shouldShowByPackageCount;
  });

  const timeSlots = useMemo(() => {
    if (!availableSlots) return [];
    
    // Check if the selected date is in the weekly schedule
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const selectedDateObj = new Date(selectedDate);
    const dayName = DAYS_ID[selectedDateObj.getDay()];
    const allowedDays = availableSlots.weekly_days ? availableSlots.weekly_days.split(',') : [];
    
    if (allowedDays.length > 0 && !allowedDays.includes(dayName)) {
      return []; // Return empty slots if day is not allowed
    }

    const slots = [];
    const [startH, startM] = availableSlots.work_start.split(':').map(Number);
    const [endH, endM] = availableSlots.work_end.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Handle overnight
    }

    const totalDurationMins = calculateTotalDuration();
    const baseDurationMins = calculateTotalDuration(1);
    const breakHrs = availableSlots.break_time || 0;
    const breakMins = breakHrs * 60;
    
    // Generate slots every 30 minutes
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const currentTotalMinutes = m;
      const hour = Math.floor((currentTotalMinutes / 60) % 24);
      const minute = currentTotalMinutes % 60;
      const isNextDay = currentTotalMinutes >= 24 * 60;
      
      const slotTime = new Date(selectedDate);
      if (isNextDay) slotTime.setDate(slotTime.getDate() + 1);
      slotTime.setHours(hour, minute, 0, 0);

      const now = new Date();
      const isPast = slotTime < now;

      let type: 'available' | 'busy' | 'past' | 'overlap' = 'available';
      if (isPast) type = 'past';

      if (type === 'available' && availableSlots.break_until) {
        const breakUntil = new Date(availableSlots.break_until);
        if (slotTime < breakUntil) type = 'busy';
      }

      let busySubType: 'none' | 'active' | 'break' | 'pre' = 'none';
      let isFirstBreak = false;
      if (type === 'available') {
        for (const s of availableSlots.busy_slots) {
          const sessionStart = new Date(s.start);
          const sessionDurationMins = (s.duration || 1) * 60; // Assuming s.duration is in hours from DB
          const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMins * 60 * 1000);
          const breakEnd = new Date(sessionEnd.getTime() + breakMins * 60 * 1000);
          const preStart = new Date(sessionStart.getTime() - (totalDurationMins + breakMins) * 60 * 1000);

          const slotTimeMs = slotTime.getTime();
          const sessionStartMs = sessionStart.getTime();
          const sessionEndMs = sessionEnd.getTime();
          const breakEndMs = breakEnd.getTime();
          const preStartMs = preStart.getTime();

          if (slotTimeMs >= sessionStartMs && slotTimeMs < sessionEndMs) {
            busySubType = 'active';
            type = 'busy';
            isFirstBreak = false;
            break; // Active session has the highest priority
          } else if (slotTimeMs >= sessionEndMs && slotTimeMs < breakEndMs) {
            busySubType = 'break';
            type = 'busy';
            if (slotTimeMs === sessionEndMs) {
              isFirstBreak = true;
            }
          } else if (slotTimeMs > preStartMs && slotTimeMs < sessionStartMs) {
            if (busySubType === 'none') {
              busySubType = 'pre';
              type = 'busy';
            }
          }
        }
      }

      const checkFullAvailability = () => {
        // Smart Logic: A slot is "available" if it can fit at least ONE package (quantity 1)
        // This prevents the "off hours" (red slots) from expanding just because quantity is high.
        const sessionEnd = new Date(slotTime.getTime() + (baseDurationMins + breakMins) * 60 * 1000);
        const sessionEndMs = sessionEnd.getTime();
        const slotTimeMs = slotTime.getTime();

        const workEndDate = new Date(selectedDate);
        workEndDate.setHours(0, endMinutes, 0, 0);
        if (sessionEndMs > workEndDate.getTime()) return false;

        return !availableSlots.busy_slots.some((s: any) => {
          const sStart = new Date(s.start).getTime();
          const sEnd = sStart + ((s.duration || 1) * 60 + breakMins) * 60 * 1000;
          return slotTimeMs < sEnd && sessionEndMs > sStart;
        });
      };

      const available = type === 'available' && checkFullAvailability();

      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        hour,
        minute,
        isNextDay,
        type,
        busySubType,
        isFirstBreak,
        available
      });
    }
    return slots;
  }, [availableSlots, selectedDate, bookingData.quantity, selectedPackage]);

  if (isPaying && selectedKijo && selectedPackage) {
    return (
      <PaymentPage 
        user={user}
        kijo={selectedKijo}
        pkg={selectedPackage}
        bookingData={{
          ...bookingData,
          gameTitle: selectedCategoryName,
          duration: calculateTotalDuration() / 60,
          scheduledAt: `${selectedDate}T${selectedTime}:00`
        }}
        onBack={() => setIsPaying(false)}
        onSuccess={() => {
          setIsPaying(false);
          setSelectedKijo(null);
          if (onOrderSuccess) onOrderSuccess();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Global Account Alert */}
      {userGameAccounts.filter(a => a.account_type === 'personal').length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-primary/10 border border-orange-primary/30 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-primary/20 rounded-xl flex items-center justify-center text-orange-primary shrink-0">
              <Gamepad2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-orange-primary uppercase tracking-widest">Peringatan Akun Personal</p>
              <p className="text-[11px] font-bold text-text-main uppercase tracking-tight">Anda belum menambahkan akun game personal. Anda wajib menambahkannya di menu Akun sebelum dapat memesan.</p>
            </div>
          </div>
          <button 
            onClick={() => setView ? setView('account') : window.location.hash = '#account'}
            className="px-4 py-2 bg-orange-primary text-black text-xs font-semibold uppercase tracking-wide rounded-xl hover:scale-105 transition-transform shrink-0"
          >
            Tambah Akun
          </button>
        </motion.div>
      )}

      {/* Search Bar Only */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-orange-primary transition-colors" size={18} />
        <input 
          type="text" 
          placeholder="Cari username atau nama Kijo..."
          className="w-full bg-bg-sidebar border border-border-main rounded-2xl py-4 pl-12 pr-4 text-text-main placeholder:text-text-muted focus:outline-none focus:border-orange-primary transition-all text-sm font-bold shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter Bar with Dropdown */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:w-auto">
          <button 
            onClick={() => setShowGameDropdown(!showGameDropdown)}
            className="w-full flex items-center justify-between sm:justify-start gap-3 bg-bg-sidebar border border-border-main px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-xs sm:text-xs font-semibold uppercase tracking-wide text-text-main hover:border-orange-primary transition-all"
          >
            <div className="flex items-center gap-3">
              <Gamepad2 size={16} className="text-orange-primary" />
              {selectedGame}
            </div>
            <ChevronDown size={14} className={`transition-transform ${showGameDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showGameDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowGameDropdown(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-bg-sidebar border border-border-main rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  {availableGames.map(game => (
                    <button
                      key={game.name}
                      onClick={() => { setSelectedGame(game.name); setShowGameDropdown(false); }}
                      className={`w-full text-left px-6 py-3 sm:py-4 text-xs sm:text-xs font-semibold uppercase tracking-wide transition-colors ${
                        selectedGame === game.name ? 'bg-orange-primary text-black' : 'text-text-muted hover:bg-bg-main hover:text-orange-primary'
                      }`}
                    >
                      {game.name}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:block flex-1 h-px bg-border-main/50" />
        
        <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-bg-sidebar/50 px-4 py-2 rounded-full border border-border-main">
          <Wallet size={14} className="text-orange-primary" />
          <span className="text-xs sm:text-xs font-bold text-text-muted uppercase">Refund: <span className="text-text-main">Rp {user.wallet_jokies?.toLocaleString() || '0'}</span></span>
        </div>
      </div>

      {/* Kijo Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Memuat Partner...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
          {filteredKijos.map((kijo, idx) => (
            <motion.div 
              key={kijo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleSelectKijo(kijo)}
              className="bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl overflow-hidden group hover:border-orange-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-lg flex flex-col"
            >
              {/* Image Area */}
              <div className="relative h-32 md:h-40 overflow-hidden">
                <img 
                  src={`https://picsum.photos/seed/kijo-${kijo.id}/400/300`} 
                  alt={kijo.full_name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 md:bottom-3 left-2 md:left-3 flex flex-wrap gap-1">
                  {kijo.games.slice(0, 1).map((g: string) => (
                    <span key={g} className="bg-orange-primary text-black text-xs md:text-[11px] font-bold px-1 md:px-1.5 py-0.5 rounded uppercase tracking-widest">
                      {g}
                    </span>
                  ))}
                  {kijo.has_vip > 0 && (
                    <span className="bg-orange-primary text-black text-xs md:text-[11px] font-bold px-1 md:px-1.5 py-0.5 rounded uppercase tracking-widest border border-black/20">
                      VIP
                    </span>
                  )}
                </div>
                <div className="absolute top-2 md:top-3 right-2 md:right-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-white/10 text-orange-primary">
                  <Star size={8} className="md:w-3 md:h-3" fill="currentColor" />
                  <span className="text-xs md:text-[11px] font-bold">{kijo.rating.toFixed(1)}</span>
                </div>
              </div>
              
              {/* Info Area */}
              <div className="p-3 md:p-4 flex flex-col flex-1 justify-between">
                <div>
                  <div className="flex justify-between items-start mb-0.5 md:mb-1">
                    <h3 className="text-xs md:text-sm font-bold text-text-main group-hover:text-orange-primary transition-colors truncate pr-2">
                      {kijo.full_name}
                    </h3>
                    <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mt-1 shrink-0 ${
                      kijo.effective_status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                      kijo.effective_status === 'busy' ? 'bg-orange-primary' : 
                      kijo.effective_status === 'holiday' ? 'bg-blue-500' : 'bg-red-500'
                    }`} />
                  </div>
                  
                  <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                    <div className="flex items-center gap-1 md:gap-1.5">
                      <span className={`text-[11px] md:text-[11px] font-semibold uppercase tracking-wide ${
                        kijo.effective_status === 'online' ? 'text-green-500' : 
                        kijo.effective_status === 'busy' ? 'text-red-500' : 
                        kijo.effective_status === 'holiday' ? 'text-blue-500' : 'text-red-500'
                      }`}>
                        {kijo.effective_status === 'online' ? 'Online' : 
                         kijo.effective_status === 'busy' ? 'Penuh' : 
                         kijo.effective_status === 'holiday' ? 'Libur' : 'Offline'}
                      </span>
                      {kijo.effective_status === 'busy' && (
                        <span className="bg-red-500 text-white text-xs md:text-[11px] font-bold px-1 md:px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                          Limit
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] md:text-[11px] text-text-muted font-bold uppercase">| {kijo.total_booked} Booked</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-border-main">
                  <span className="text-[11px] md:text-[11px] text-text-muted font-semibold uppercase tracking-wide">{kijo.total_reviews} Ulasan</span>
                  <div className="text-orange-primary group-hover:translate-x-1 transition-transform">
                    <ChevronRight size={14} className="md:w-4 md:h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detailed Kijo Modal */}
      <AnimatePresence>
        {selectedKijo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedKijo(null); setBookingStep(1); }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh] allow-scrollbar"
            >
              {/* Left Side: Photo & Quick Stats */}
              <div className="md:w-2/5 relative bg-bg-main border-b md:border-b-0 md:border-r border-border-main overflow-hidden h-32 md:h-auto shrink-0">
                <img 
                  src={`https://picsum.photos/seed/kijo-${selectedKijo.id}/600/900`} 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-sidebar via-transparent to-transparent" />
                <div className="absolute bottom-3 md:bottom-8 left-4 md:left-8 right-4 md:right-8">
                  <h2 className="text-lg md:text-4xl font-bold text-text-main mb-0.5 md:mb-2">{selectedKijo.full_name}</h2>
                  <div className="flex items-center gap-2 md:gap-4 mb-1 md:mb-4">
                    <div className="flex items-center gap-1 text-orange-primary">
                      <Star size={12} fill="currentColor" className="md:w-6 md:h-6" />
                      <span className="text-sm md:text-xl font-bold">{selectedKijo.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-text-muted text-[11px] md:text-sm font-bold">({selectedKijo.total_reviews} Ulasan)</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Details & Booking */}
              <div className="md:w-3/5 p-4 sm:p-5 md:p-8 overflow-y-auto pb-32 md:pb-8 scrollbar-hide">
                <button 
                  onClick={() => { setSelectedKijo(null); setBookingStep(1); }}
                  className="absolute top-3 right-3 md:top-6 md:right-6 text-text-muted hover:text-text-main transition-colors z-10 p-1.5 md:p-2 bg-bg-main/50 rounded-full backdrop-blur-sm"
                >
                  <XCircle size={16} className="md:w-6 md:h-6" />
                </button>

                <div className="space-y-6 md:space-y-10">
                  {isKijoLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="w-10 h-10 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Memuat Detail...</p>
                    </div>
                  ) : bookingStep === 1 ? (
                    <>
                      {/* Motto & Detail */}
                      <section className="space-y-2 md:space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 md:gap-3">
                            <Zap size={16} className="text-orange-primary md:w-[18px] md:h-[18px]" />
                            <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Motto & Detail</h3>
                          </div>
                          {selectedKijo.effective_status === 'busy' && (
                            <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 animate-pulse">
                              <AlertCircle size={12} className="md:w-[14px] md:h-[14px]" />
                              <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wide">KIJO PENUH</span>
                            </div>
                          )}
                        </div>
                        {selectedKijo.effective_status === 'busy' && (
                          <div className="p-3 md:p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl md:rounded-2xl flex items-start gap-3 md:gap-4">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/20 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                              <XCircle className="text-red-500 md:w-6 md:h-6" size={20} />
                            </div>
                            <div className="space-y-0.5 md:space-y-1">
                              <h4 className="text-red-500 font-bold text-xs md:text-xs uppercase tracking-widest">Pemesanan Ditangguhkan</h4>
                              <p className="text-xs md:text-[11px] text-red-500/80 font-bold leading-relaxed">
                                Mohon maaf, KIJO ini telah mencapai batas maksimal pesanan aktif ({selectedKijo.max_slots} slot). 
                              </p>
                            </div>
                          </div>
                        )}
                        <p className="text-sm md:text-xl font-bold text-text-main italic leading-relaxed">"{selectedKijo.motto || 'Siap menggendong Anda sampai rank impian!'}"</p>
                        <p className="text-text-muted text-xs md:text-sm leading-relaxed">{selectedKijo.detail_kijo || 'Partner profesional dengan jam terbang tinggi.'}</p>
                        
                        {/* Traits / Badges */}
                        {selectedKijo.traits && selectedKijo.traits.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 md:gap-2 pt-1 md:pt-2">
                            {selectedKijo.traits.map((t: any) => (
                              <div key={t.trait_key} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-bg-main border border-border-main rounded-lg md:rounded-xl group/trait relative">
                                <Shield size={10} className="text-orange-primary md:w-3 md:h-3" />
                                <span className="text-[11px] md:text-xs font-bold text-text-main uppercase tracking-widest">
                                  {t.trait_key.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* Stats Row */}
                      <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div className="bg-bg-main p-2.5 md:p-4 rounded-xl md:rounded-2xl border border-border-main text-center group/stat relative">
                          <p className="text-[11px] md:text-xs text-text-muted font-bold uppercase mb-0.5 md:mb-1">Pesanan Aktif</p>
                          <p className="text-xs md:text-lg font-bold text-text-main">{selectedKijo.active_orders || 0}</p>
                        </div>
                        <div className="bg-bg-main p-2.5 md:p-4 rounded-xl md:rounded-2xl border border-border-main text-center">
                          <p className="text-[11px] md:text-xs text-text-muted font-bold uppercase mb-0.5 md:mb-1">Waktu Aktif</p>
                          <p className="text-xs md:text-lg font-bold text-orange-primary">{selectedKijo.work_start} - {selectedKijo.work_end}</p>
                        </div>
                      </div>

      {/* Packages & Boosting Account Selection */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package size={20} className="text-orange-primary" />
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Pilihan Paket</h3>
          </div>
          
          {selectedKijo.boosting_accounts && selectedKijo.boosting_accounts.length > 1 && (
            <div className="flex items-center gap-2 bg-bg-main p-1.5 rounded-xl border border-border-main">
              <button 
                onClick={() => setSelectedBoostingAccountId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                  !selectedBoostingAccountId ? 'bg-orange-primary text-black shadow-lg shadow-orange-primary/20' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Semua
              </button>
              {selectedKijo.boosting_accounts.map((acc: any, idx: number) => (
                <button 
                  key={acc.id}
                  onClick={() => setSelectedBoostingAccountId(acc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                    selectedBoostingAccountId === acc.id ? 'bg-orange-primary text-black shadow-lg shadow-orange-primary/20' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Akun {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {(() => {
            const rawEtalase = selectedKijo.etalase || [];
            
            // 1. Filter by Game (from main marketplace)
            const gameFilteredEtalase = rawEtalase.filter((cat: any) => 
              selectedGame === 'Semua Game' || cat.game_name === selectedGame
            );

            // 2. Filter by Boosting Account
            const filteredEtalase = gameFilteredEtalase.filter((cat: any) => 
              !selectedBoostingAccountId || 
              cat.game_account_id === selectedBoostingAccountId ||
              !cat.game_account_id
            );

            if (rawEtalase.length === 0) {
              return (
                <div className="p-8 text-center bg-bg-main border border-dashed border-border-main rounded-2xl">
                  <p className="text-text-muted text-xs font-medium italic">Partner ini belum memiliki paket aktif.</p>
                </div>
              );
            }

            if (gameFilteredEtalase.length === 0) {
              return (
                <div className="p-8 text-center bg-bg-main border border-dashed border-border-main rounded-2xl">
                  <p className="text-text-muted text-xs font-medium italic">Tidak ada paket untuk game {selectedGame}.</p>
                </div>
              );
            }

            if (filteredEtalase.length === 0) {
              return (
                <div className="p-8 text-center bg-bg-main border border-dashed border-border-main rounded-2xl">
                  <p className="text-text-muted text-xs font-medium italic">Tidak ada kategori untuk akun boosting yang dipilih.</p>
                </div>
              );
            }

            return filteredEtalase.map((cat: any) => (
              <div key={cat.id} className="space-y-2">
                <div className="flex items-center justify-between ml-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-orange-primary/60 uppercase tracking-widest">{cat.name}</p>
                      {cat.rank && (
                        <span className="bg-orange-primary/10 text-orange-primary text-[11px] font-bold px-1.5 py-0.5 rounded border border-orange-primary/20 uppercase tracking-widest">
                          {cat.rank}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const acc = selectedKijo.boosting_accounts?.find((a: any) => a.id === cat.game_account_id);
                      if (acc && selectedKijo.boosting_accounts.length > 1) {
                        const accIdx = selectedKijo.boosting_accounts.findIndex((a: any) => a.id === cat.game_account_id);
                        return <p className="text-[11px] font-bold text-text-muted uppercase tracking-tighter">Akun: Partner {accIdx + 1}</p>;
                      }
                      return null;
                    })()}
                  </div>
                  {cat.game_name && selectedGame === 'Semua Game' && (
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
                      disabled={selectedKijo.effective_status === 'busy'}
                      onClick={() => handleSelectPackage(pkg, cat.name, cat.id, cat.game_name)}
                      className={`w-full bg-bg-main border border-border-main rounded-2xl p-5 flex items-center justify-between group transition-all ${
                        selectedKijo.effective_status === 'busy' 
                          ? 'opacity-40 cursor-not-allowed grayscale' 
                          : 'hover:border-orange-primary'
                      }`}
                    >
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold transition-colors ${
                            selectedKijo.effective_status === 'busy' ? 'text-text-muted' : 'text-text-main group-hover:text-orange-primary'
                          }`}>
                            {pkg.name} {pkg.package_type === 'VIP' ? `(${pkg.min_players}-${pkg.max_players} Pemain)` : ''} {pkg.rank ? `• ${pkg.rank}` : ''}
                          </p>
                          {pkg.package_type === 'VIP' && (
                            <span className="bg-orange-primary text-black text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">VIP</span>
                          )}
                        </div>
                        {pkg.criteria && (
                          <p className="text-xs text-text-muted font-bold mt-1 italic">
                            {pkg.criteria}
                          </p>
                        )}
                        {pkg.is_bundle === 1 && (
                          <p className="text-xs text-orange-primary font-bold uppercase mt-1">
                            {pkg.bundle_start} → {pkg.bundle_end}
                          </p>
                        )}
                        <p className="text-xs text-text-muted font-bold uppercase">Estimasi: {pkg.duration >= 60 ? `${Math.floor(pkg.duration / 60)} Jam ${pkg.duration % 60 > 0 ? `${pkg.duration % 60} Menit` : ''}` : `${pkg.duration} Menit`}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold font-mono ${
                          selectedKijo.effective_status === 'busy' ? 'text-text-muted' : 'text-text-main'
                        }`}>Rp {Math.round(pkg.price * (1 + adminFeePercent / 100)).toLocaleString()}</p>
                        <p className={`text-xs font-bold uppercase ${
                          selectedKijo.effective_status === 'busy' ? 'text-text-muted' : 'text-orange-primary'
                        }`}>
                          {selectedKijo.effective_status === 'busy' ? 'Penuh' : 'Pilih Paket'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ));
          })()}
        </div>
      </section>

      {/* Order History */}
      {kijoHistory && kijoHistory.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <History size={20} className="text-orange-primary" />
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Riwayat Pesanan</h3>
          </div>
          <div className="space-y-2">
            {kijoHistory.map((h: any) => (
              <div key={h.id} className="bg-bg-main/50 border border-border-main rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-text-main uppercase tracking-tight">{h.title}</p>
                  <p className="text-xs text-text-muted font-bold uppercase">{new Date(h.scheduled_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">{h.package_type}</p>
                    <p className="text-xs font-bold text-text-main">{h.duration} Jam</p>
                  </div>
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <button 
                          onClick={() => { setBookingStep(1); setSelectedTime(''); }}
                          className="p-2 bg-bg-main rounded-xl text-text-muted hover:text-text-main transition-colors"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <h3 className="text-xl font-bold text-text-main">Konfirmasi Pemesanan</h3>
                      </div>

                      <div className="bg-bg-main p-6 rounded-2xl border border-border-main space-y-6">
                        {/* Slot Selection */}
                        <div className="space-y-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Jadwal</label>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              {selectedTime && (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                                  <div className="flex items-center gap-2 bg-orange-primary/10 px-3 py-2 rounded-xl border border-orange-primary/20">
                                    <Clock size={12} className="text-orange-primary" />
                                    <span className="text-xs font-bold text-orange-primary uppercase tracking-tighter">
                                      Selesai: {(() => {
                                        const [h, m] = selectedTime.split(':').map(Number);
                                        const totalDuration = calculateTotalDuration();
                                        const totalMins = h * 60 + m + totalDuration;
                                        const finishH = Math.floor((totalMins / 60) % 24);
                                        const finishM = totalMins % 60;
                                        return `${finishH.toString().padStart(2, '0')}:${finishM.toString().padStart(2, '0')}${totalMins >= 24 * 60 ? ' (Besok)' : ''}`;
                                      })()}
                                    </span>
                                  </div>
                                  <button 
                                    onClick={() => setSelectedTime('')}
                                    className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all shadow-sm"
                                    title="Hapus Pilihan"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-2 bg-bg-sidebar px-3 py-2 rounded-xl border border-border-main min-w-[140px]">
                                <Calendar size={14} className="text-orange-primary" />
                                <input 
                                  type="date" 
                                  value={selectedDate}
                                  min={new Date().toISOString().split('T')[0]}
                                  max={availableSlots ? new Date(new Date().getTime() + (availableSlots.pre_order_days ?? 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined}
                                  onChange={(e) => setSelectedDate(e.target.value)}
                                  className="bg-transparent text-[11px] font-bold text-text-main focus:outline-none w-full cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            {timeSlots.length === 0 && availableSlots && (
                              <div className="col-span-4 py-8 text-center bg-bg-sidebar border border-border-main rounded-xl">
                                <AlertCircle className="mx-auto text-text-muted mb-2" size={24} />
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
                                
                                if (selectedTime === slot.time) {
                                  status = 'selected';
                                } else if (slotTotal > selTotal && slotTotal < selTotal + totalDuration) {
                                  status = 'active';
                                } else if (slotTotal === selTotal + totalDuration) {
                                  status = 'break';
                                }
                                // Note: We hide 'pre' and subsequent 'break' slots for current selection per user request
                              }

                              // Use busySubType for already booked slots
                              const isBookedActive = slot.type === 'busy' && slot.busySubType === 'active';
                              const isBookedBreak = slot.type === 'busy' && slot.busySubType === 'break';
                              const isBookedPre = slot.type === 'busy' && slot.busySubType === 'pre';

                              return (
                                <button
                                  key={`${slot.time}-${slot.isNextDay}`}
                                  disabled={!slot.available}
                                  onClick={() => {
                                    setSelectedTime(slot.time);
                                    // Automatically adjust quantity if it exceeds the max possible for this slot
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
                                            : slot.available
                                              ? 'bg-bg-sidebar border-border-main text-text-main hover:border-orange-primary/50'
                                              : slot.type === 'busy'
                                                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                                                : 'bg-red-500/10 border-red-500/20 text-red-500/50'
                                  }`}
                                >
                                  {slot.time}
                                  {(status === 'active' || isBookedActive) && <span className="block text-xs font-bold uppercase">Booked</span>}
                                  {slot.type === 'busy' && status === 'none' && !slot.busySubType && <span className="block text-xs font-bold uppercase">Penuh</span>}
                                  {slot.type === 'past' && status === 'none' && <span className="block text-xs opacity-70 uppercase">Lewat</span>}
                                  {slot.isNextDay && <span className="block text-xs opacity-50 uppercase">Besok</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {selectedPackage?.package_type === 'VIP' && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Jumlah Pemain</label>
                            <div className="flex items-center gap-4 bg-bg-sidebar border border-border-main rounded-xl p-2">
                              <button 
                                onClick={() => setBookingData(prev => ({ ...prev, player_count: Math.max(selectedPackage.min_players || 2, (prev.player_count || 2) - 1) }))}
                                className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                              >
                                -
                              </button>
                              <div className="flex-1 text-center font-bold text-lg text-text-main">
                                {bookingData.player_count || selectedPackage.min_players || 2}
                              </div>
                              <button 
                                onClick={() => setBookingData(prev => {
                                  const currentCount = prev.player_count || selectedPackage.min_players || 2;
                                  const pkgMax = selectedPackage.max_players || selectedPackage.min_players || 2;
                                  const kijoMax = selectedKijo?.max_slots || 4; 
                                  const absoluteMax = Math.min(pkgMax, kijoMax);
                                  
                                  return { ...prev, player_count: Math.min(absoluteMax, currentCount + 1) };
                                })}
                                disabled={bookingData.player_count >= (selectedPackage.max_players || selectedPackage.min_players || 2)}
                                className={`w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl ${bookingData.player_count >= (selectedPackage.max_players || selectedPackage.min_players || 2) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                +
                              </button>
                            </div>
                            <p className="text-xs font-bold text-text-muted ml-1 uppercase tracking-wider">
                              Paket ini mendukung {selectedPackage.min_players}-{selectedPackage.max_players} pemain. 
                              {selectedKijo?.max_slots && ` (Limit Partner: ${selectedKijo.max_slots} Pemain)`}
                            </p>
                          </div>
                        )}

                        {selectedPackage?.is_recurring === 1 && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Kuantitas Pesanan</label>
                            <div className="flex items-center gap-4 bg-bg-sidebar border border-border-main rounded-xl p-2">
                              <button 
                                onClick={() => setBookingData(prev => ({ ...prev, quantity: Math.max(1, (prev.quantity || 1) - 1) }))}
                                className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                              >
                                -
                              </button>
                              <div className="flex-1 text-center font-bold text-lg text-text-main">
                                {bookingData.quantity || 1}
                              </div>
                              <button 
                                onClick={() => {
                                  const nextQty = (bookingData.quantity || 1) + 1;
                                  
                                  // 1. Check against Kijo's max_slots (batas maksimal pesanan)
                                  const kijoMax = selectedKijo?.max_slots || 10;
                                  if (nextQty > kijoMax) {
                                    alert(`Kuantitas tidak dapat melebihi batas maksimal pesanan Partner (${kijoMax})!`);
                                    return;
                                  }

                                  // 2. Check against remaining time in the day if a slot is selected
                                  if (selectedTime && availableSlots?.work_end) {
                                    const maxQ = getMaxPossibleQuantity(selectedTime);
                                    if (nextQty > maxQ) {
                                      alert('Kuantitas tidak dapat ditambah karena melebihi jam kerja Partner!');
                                      return;
                                    }
                                  }
                                  
                                  setBookingData(prev => ({ ...prev, quantity: nextQty }));
                                }}
                                className="w-10 h-10 rounded-lg bg-bg-main border border-border-main flex items-center justify-center text-text-main hover:border-orange-primary transition-all font-bold text-xl"
                              >
                                +
                              </button>
                            </div>
                            <p className="text-xs font-bold text-text-muted ml-1 uppercase tracking-wider">
                              Paket ini mendukung pemesanan berulang.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Akun Game</label>
                            {matchingAccounts.length > 1 ? (
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
                                      
                                      // Handle Hashtag for Valorant etc
                                      if (dynamic['Hashtag'] && !formattedId.includes('#')) {
                                        formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                                      } else if (!formattedId && dynamic['ID Game']) {
                                        formattedId = dynamic['ID Game'];
                                        if (dynamic['Hashtag']) formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                                      }
                                      
                                      if (acc.server || dynamic['Server ID'] || dynamic['Server']) {
                                        const server = acc.server || dynamic['Server ID'] || dynamic['Server'];
                                        formattedId = `${formattedId} (${server})`;
                                      }

                                      setBookingData({
                                        ...bookingData,
                                        nickname: acc.nickname || dynamic['Nickname'] || '-',
                                        gameId: formattedId || '-',
                                        dynamic_data: dynamic,
                                        gameAccountId: acc.id
                                      });
                                    } else {
                                      setBookingData({
                                        ...bookingData,
                                        nickname: '',
                                        gameId: '',
                                        dynamic_data: {},
                                        gameAccountId: null
                                      });
                                    }
                                  }}
                                >
                                  <option value="">-- Pilih Akun --</option>
                                  {matchingAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.nickname} ({acc.rank})
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={16} />
                              </div>
                            ) : matchingAccounts.length === 1 ? (
                              <div className="bg-bg-sidebar border border-orange-primary/30 rounded-xl py-3 px-4 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-text-main">{matchingAccounts[0].nickname}</p>
                                  <p className="text-xs font-bold text-text-muted">
                                    {(() => {
                                      const acc = matchingAccounts[0];
                                      const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                                      let formattedId = acc.game_id || '';
                                      
                                      if (dynamic['Hashtag'] && !formattedId.includes('#')) {
                                        formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                                      } else if (!formattedId && dynamic['ID Game']) {
                                        formattedId = dynamic['ID Game'];
                                        if (dynamic['Hashtag']) formattedId = `${formattedId}#${dynamic['Hashtag']}`;
                                      }
                                      
                                      const server = acc.server || dynamic['Server ID'] || dynamic['Server'];
                                      return `${formattedId || '-'}${server ? ` (${server})` : ''}`;
                                    })()}
                                  </p>
                                </div>
                                <div className="bg-orange-primary/10 px-2 py-1 rounded-md border border-orange-primary/20">
                                  <span className="text-[11px] font-bold text-orange-primary uppercase tracking-widest">Akun Personal</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-bg-sidebar border border-dashed border-border-main rounded-xl py-3 px-4 text-xs text-text-muted italic">
                                Tidak ada akun terdaftar untuk game ini. Silakan isi manual.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {!bookingData.gameAccountId ? (
                            <>
                              {(() => {
                                const game = availableGames.find(g => g.name === selectedGameName || g.name === selectedCategoryName || g.name === selectedKijo?.verified_game);
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
                                            const fieldName = field.name.toLowerCase();
                                            let extra = {};
                                            if (fieldName.includes('start') || fieldName.includes('awal') || fieldName.includes('current') || fieldName.includes('saat ini')) {
                                              extra = { rankStart: newValue };
                                            } else if (fieldName.includes('end') || fieldName.includes('target') || fieldName.includes('akhir') || fieldName.includes('tujuan')) {
                                              extra = { rankEnd: newValue };
                                            }
                                            
                                            setBookingData({
                                              ...bookingData,
                                              ...extra,
                                              dynamic_data: {
                                                ...(bookingData.dynamic_data || {}),
                                                [field.name]: newValue
                                              }
                                            });
                                          }}
                                        >
                                          <option value="">Pilih Rank</option>
                                          {(() => {
                                            const ranks = game?.ranks || [];
                                            return ranks.map((r: any, i: number) => (
                                              <optgroup key={i} label={r.title}>
                                                {r.tiers.map((tier: string, j: number) => (
                                                  <option key={`${i}-${j}`} value={`${r.title} - ${tier}`}>
                                                    {tier}
                                                  </option>
                                                ))}
                                              </optgroup>
                                            ));
                                          })()}
                                        </select>
                                      ) : (
                                        <input 
                                          type={field.type === 'number' ? 'number' : 'text'}
                                          required
                                          placeholder={typeof field.placeholder === 'string' ? field.placeholder : ''}
                                          className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                          value={(bookingData.dynamic_data && bookingData.dynamic_data[field.name]) || ''}
                                          onChange={(e) => {
                                            const newValue = e.target.value;
                                            setBookingData({
                                              ...bookingData,
                                              dynamic_data: {
                                                ...(bookingData.dynamic_data || {}),
                                                [field.name]: newValue
                                              },
                                              // Keep legacy fields in sync for backward compatibility
                                              nickname: field.name === 'Nickname' || field.name === 'ID' ? newValue : bookingData.nickname,
                                              gameId: field.name === 'ID Game' || field.name === 'Hashtag' || field.name === 'ID' ? newValue : bookingData.gameId
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  ));
                                }
                                
                                // Fallback to legacy fields
                                return (
                                  <>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nickname Game</label>
                                      <input 
                                        type="text" 
                                        required
                                        placeholder="Your Nickname"
                                        className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                        value={bookingData.nickname}
                                        onChange={(e) => setBookingData({...bookingData, nickname: e.target.value})}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">ID Game</label>
                                      <input 
                                        type="text" 
                                        required
                                        placeholder="12345678 (1234)"
                                        className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-sm text-text-main focus:outline-none focus:border-orange-primary"
                                        value={bookingData.gameId}
                                        onChange={(e) => setBookingData({...bookingData, gameId: e.target.value})}
                                      />
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
                              <CheckCircle2 className="text-green-500" size={20} />
                            </div>
                          )}
                        </div>

                        <div className="pt-4 space-y-2 border-t border-border-main">
                          {matchingAccounts.length === 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex items-start gap-3">
                              <AlertCircle className="text-red-500 shrink-0" size={16} />
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
                          const scheduledAt = `${selectedDate}T${selectedTime}:00`;
                          setBookingData(prev => ({ ...prev, scheduledAt }));
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
