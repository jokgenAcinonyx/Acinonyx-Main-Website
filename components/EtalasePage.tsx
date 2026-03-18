import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// lucide-react icons removed
import { RANKS } from '../constants';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { useAlert } from './AlertContext';

interface PackageData {
  id: number;
  name: string;
  price: number;
  duration: number;
  package_type: 'SOLO' | 'VIP';
  player_count: number;
  min_players: number;
  max_players: number;
  archived: number;
  deleted: number;
  rank?: string;
  is_bundle: number;
  bundle_start?: string;
  bundle_end?: string;
  is_recurring: number;
  recurring_extra_duration: number;
  recurring_every_quantity: number;
  criteria?: string;
}

interface Holiday {
  id: number;
  start_date: string;
  end_date: string;
  reason: string;
}

interface CategoryData {
  id: number;
  name: string;
  game_name: string;
  visible: number;
  packages: PackageData[];
  slot_id?: number;
  game_account_id?: number;
  rank?: string;
}

interface EtalasePageProps {
  user: any;
  onRefreshStats: () => void;
  globalGames: any[];
  subView?: string;
  onSubViewChange?: (sv: string) => void;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = (i % 2 === 0 ? '00' : '30');
  return `${h}:${m}`;
});

interface PackageItemProps {
  key?: React.Key;
  pkg: PackageData;
  onEdit: () => void;
  onArchive: (e: React.MouseEvent) => void | Promise<void>;
  onDelete: (e: React.MouseEvent) => void | Promise<void>;
  overtimeWarning?: boolean;
}

function PackageItem({ pkg, onEdit, onArchive, onDelete, overtimeWarning }: PackageItemProps) {
  return (
    <div className={`bg-bg-main border rounded-xl p-4 flex flex-col group hover:border-orange-primary/30 transition-all ${pkg.archived === 1 ? 'opacity-50 grayscale' : ''} ${overtimeWarning ? 'border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : 'border-border-main'}`}>
      <div className="flex items-center justify-between flex-1">
        <div className="space-y-1 flex-1 min-w-0 mr-2">
        <div className="flex flex-col mb-1">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
            {pkg.package_type} {pkg.package_type === 'VIP' && `• ${pkg.min_players}-${pkg.max_players} PEMAIN`} {pkg.rank && `• ${pkg.rank}`}
          </span>
          <div className="flex items-center gap-2">
            <h4 className="text-text-main font-bold text-[11px] md:text-sm truncate">{pkg.name}</h4>
            {pkg.archived === 1 && (
              <span className="text-[11px] bg-bg-sidebar text-text-muted px-1.5 py-0.5 rounded uppercase font-bold border border-border-main">Arsip</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-orange-primary font-mono text-xs font-bold">Rp {pkg.price?.toLocaleString() || '0'}</span>
          <span className="text-text-muted text-xs flex items-center gap-1">
            {pkg.duration >= 60 ? `${Math.floor(pkg.duration / 60)} Jam ${pkg.duration % 60 > 0 ? `${pkg.duration % 60} Menit` : ''}` : `${pkg.duration} Menit`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit Paket"
          className="text-text-muted hover:text-orange-primary transition-colors p-1"
        >
          ⚙
        </button>
        <button 
          onClick={onArchive}
          title={pkg.archived === 1 ? 'Keluarkan dari Arsip' : 'Arsipkan Paket'}
          className="text-text-muted hover:text-orange-primary transition-colors p-1"
        >
          {pkg.archived === 1 ? '↩' : '↓'}
        </button>
        <button 
          onClick={onDelete}
          title="Hapus Paket"
          className="text-text-muted hover:text-red-500 transition-colors p-1"
        >
          ×
        </button>
      </div>
      </div>
      {overtimeWarning && (
        <div className="mt-2 pt-2 border-t border-red-500/20">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
            ⚠ Durasi paket melebihi jam aktif + istirahat
          </span>
        </div>
      )}
    </div>
  );
}

export default function EtalasePage({ user, onRefreshStats, subView, onSubViewChange }: EtalasePageProps) {
  const { showAlert } = useAlert();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedRank, setSelectedRank] = useState('');
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<number | ''>('');
  const [selectedGame, setSelectedGame] = useState(user?.verified_game || 'Mobile Legends');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchGames = async () => {
      if (!user?.id) return;
      try {
        const res = await fetchWithAuth(`/api/kijo/available-games?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          
          // If user has a verified game, restrict available games to that specialization for etalase management
          if (user.verified_game) {
            const filtered = data.filter((g: any) => g.name === user.verified_game);
            setAvailableGames(filtered.length > 0 ? filtered : data);
            setSelectedGame(user.verified_game);
          } else {
            setAvailableGames(data);
            if (data.length > 0) {
              setSelectedGame(data[0].name);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch available games');
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [user?.id]);
  
  // Operational Settings State
  const [operational, setOperational] = useState({
    work_start: '08:00',
    work_end: '22:00',
    break_start: '12:00',
    break_end: '13:00',
    weekly_days: DAYS,
    off_days: [],
    max_slots: 3,
    break_time: 1,
    pre_order_days: 0
  });

  const [manualStatus, setManualStatus] = useState('online');
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('Semua');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<number | 'Semua'>('Semua');
  const [isOperationalOpen, setIsOperationalOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ start_date: '', start_time: '00:00', end_date: '', end_time: '', reason: '' });

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageData | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
  const [newPackage, setNewPackage] = useState({
    name: '',
    price: '',
    duration: '',
    package_type: 'SOLO' as 'SOLO' | 'VIP',
    player_count: '1',
    min_players: '1',
    max_players: '1',
    is_bundle: 0,
    bundle_start: '',
    bundle_end: '',
    rank: '',
    is_recurring: 0,
    recurring_extra_duration: 0,
    recurring_every_quantity: 1,
    duration_hours: '1',
    duration_minutes: '0',
    extra_duration_hours: '0',
    extra_duration_minutes: '0',
    criteria: ''
  });

  const [gameAccounts, setGameAccounts] = useState<any[]>([]);
  
  const fetchData = async () => {
    if (!user?.id) {
      console.error('EtalasePage: user.id is missing', user);
      return;
    }
    try {
      const [etalaseRes, statsRes, holidaysRes, accountsRes] = await Promise.all([
        fetchWithAuth(`/api/kijo/etalase/${user.id}`),
        fetchWithAuth(`/api/kijo/stats/${user.id}`),
        fetchWithAuth(`/api/kijo/holidays/${user.id}`),
        fetchWithAuth(`/api/kijo/game-accounts/${user.id}`)
      ]);
      
      const etalaseType = etalaseRes.headers.get('content-type');
      const statsType = statsRes.headers.get('content-type');

      if (statsRes.status === 404) {
        console.warn('User not found in EtalasePage, likely stale session');
        return;
      }

      if (!etalaseRes.ok || !statsRes.ok || !holidaysRes.ok || !accountsRes.ok) {
        throw new Error(`Fetch failed: Etalase ${etalaseRes.status}, Stats ${statsRes.status}, Holidays ${holidaysRes.status}, Accounts ${accountsRes.status}`);
      }

      if (!etalaseType?.includes('application/json') || !statsType?.includes('application/json')) {
        throw new Error('Server returned non-JSON response (likely HTML fallback)');
      }

      const etalaseData = await etalaseRes.json();
      const statsData = await statsRes.json();
      const holidaysData = await holidaysRes.json();
      const accountsData = await accountsRes.json();
      
      setCategories(etalaseData);
      setHolidays(holidaysData);
      setGameAccounts(accountsData);
      
      if (statsData && statsData.work_start) {
        setOperational({
          work_start: statsData.work_start,
          work_end: statsData.work_end,
          break_start: statsData.break_start,
          break_end: statsData.break_end,
          weekly_days: statsData.weekly_days ? statsData.weekly_days.split(',') : DAYS,
          off_days: statsData.off_days ? JSON.parse(statsData.off_days) : [],
          max_slots: statsData.max_slots !== null ? statsData.max_slots : 3,
          break_time: statsData.break_time !== null ? statsData.break_time : 1,
          pre_order_days: statsData.pre_order_days !== null ? statsData.pre_order_days : 0
        });
        setManualStatus(statsData.manual_status || 'online');
      }
    } catch (err) {
      console.error('Failed to fetch etalase data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  useEffect(() => {
    if (user.verified_game) {
      setSelectedGame(user.verified_game);
    }
  }, [user.verified_game]);

  // Sync with props if they change (e.g. after App.tsx refreshes stats)
  useEffect(() => {
    if (user && user.work_start) {
      setOperational({
        work_start: user.work_start,
        work_end: user.work_end,
        break_start: user.break_start,
        break_end: user.break_end,
        weekly_days: user.weekly_days ? user.weekly_days.split(',') : DAYS,
        off_days: user.off_days ? JSON.parse(user.off_days) : [],
        max_slots: user.max_slots,
        break_time: user.break_time || 1,
        pre_order_days: user.pre_order_days || 0
      });
      setManualStatus(user.manual_status);
    }
  }, [user]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gameAccounts.length === 0) {
      showAlert('ANDA HARUS MENDAFTARKAN AKUN GAME TERLEBIH DAHULU DI MENU AKUN SEBELUM MEMBUAT ETALASE!', 'warning');
      return;
    }
    if (!newCategoryName.trim()) {
      showAlert('Nama kategori tidak boleh kosong!', 'warning');
      return;
    }

    try {
      const boostingAccounts = gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo' && acc.game_name === selectedGame);
      const finalAccountId = boostingAccounts.length === 1 ? boostingAccounts[0].id : selectedGameAccountId;

      if (boostingAccounts.length > 1 && !finalAccountId) {
        showAlert('Pilih akun boosting untuk kategori ini!', 'warning');
        return;
      }

      const url = editingCategory ? `/api/kijo/categories/${editingCategory.id}` : '/api/kijo/categories';
      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ 
          userId: user.id, 
          name: newCategoryName,
          game_name: selectedGame,
          game_account_id: finalAccountId || null,
          rank: selectedRank || null
        })
      });
      if (res.ok) {
        setNewCategoryName('');
        setSelectedRank('');
        setSelectedGameAccountId('');
        setShowAddCategory(false);
        setEditingCategory(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add/update category');
    }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gameAccounts.length === 0) {
      showAlert('ANDA HARUS MENDAFTARKAN AKUN GAME TERLEBIH DAHULU DI MENU AKUN SEBELUM MEMBUAT PAKET!', 'warning');
      return;
    }
    if (!activeCategoryId || !newPackage.name.trim() || !newPackage.price) {
      showAlert('Semua field paket harus diisi dengan benar!', 'warning');
      return;
    }

    const priceNum = parseInt(newPackage.price);
    const durationMins = (parseInt(newPackage.duration_hours) || 0) * 60 + (parseInt(newPackage.duration_minutes) || 0);
    const extraDurationMins = (parseInt(newPackage.extra_duration_hours) || 0) * 60 + (parseInt(newPackage.extra_duration_minutes) || 0);

    if (priceNum <= 0) {
      showAlert('Harga paket harus lebih dari 0!', 'warning');
      return;
    }

    if (durationMins <= 0) {
      showAlert('Durasi paket harus lebih dari 0 menit!', 'warning');
      return;
    }

    try {
      const url = editingPackage ? `/api/kijo/packages/${editingPackage.id}` : '/api/kijo/packages';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          categoryId: activeCategoryId, 
          ...newPackage,
          price: priceNum,
          duration: durationMins,
          recurring_extra_duration: 0,
          recurring_every_quantity: 1,
          player_count: parseInt(newPackage.player_count) || 2,
          min_players: parseInt(newPackage.min_players) || 2,
          max_players: parseInt(newPackage.max_players) || 4,
          is_bundle: newPackage.is_bundle,
          bundle_start: newPackage.bundle_start,
          bundle_end: newPackage.bundle_end,
          rank: newPackage.rank,
          criteria: newPackage.criteria
        })
      });
      if (res.ok) {
        // Check overtime: compare only against active work window
        const [wsh, wsm] = (operational.work_start || '08:00').split(':').map(Number);
        const [weh, wem] = (operational.work_end || '22:00').split(':').map(Number);
        let workMins = (weh * 60 + wem) - (wsh * 60 + wsm);
        if (workMins <= 0) workMins += 24 * 60;
        if (durationMins > workMins) {
          const dh = Math.floor(durationMins / 60), dm = durationMins % 60;
          const ah = Math.floor(workMins / 60), am = workMins % 60;
          showAlert(`Paket disimpan, tapi durasi (${dh}j ${dm}m) melebihi jam aktif (${ah}j ${am}m). Paket ini ditandai overtime.`, 'warning');
        }
        setNewPackage({ 
          name: '', 
          price: '', 
          duration: '', 
          package_type: 'SOLO', 
          player_count: '2',
          min_players: '2',
          max_players: '4',
          is_bundle: 0,
          bundle_start: '',
          bundle_end: '',
          rank: '',
          is_recurring: 0,
          recurring_extra_duration: 0,
          recurring_every_quantity: 1,
          duration_hours: '1',
          duration_minutes: '0',
          extra_duration_hours: '0',
          extra_duration_minutes: '0',
          criteria: ''
        });
        setShowAddPackage(false);
        setEditingPackage(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add/update package');
    }
  };

  const handleDeletePackage = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    console.log('[CLIENT] handleDeletePackage called for ID:', id);
    if (!confirm('Hapus paket ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/packages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      console.log('[CLIENT] Delete package response:', data);
      if (res.ok && data.success) {
        console.log('[CLIENT] Package deleted successfully');
        showAlert('Paket berhasil dihapus (Smart Delete).', 'success');
        await fetchData();
      } else {
        console.error('[CLIENT] Delete package failed:', data);
        showAlert(`Gagal menghapus paket: ${data.message || 'Terjadi kesalahan server'}`, 'error');
      }
    } catch (err) {
      console.error('[CLIENT] Failed to delete package:', err);
      showAlert('Gagal menghubungi server untuk menghapus paket', 'error');
    }
  };

  const handleArchivePackage = async (e: React.MouseEvent, id: number, currentArchived: number) => {
    e.stopPropagation();
    const newArchived = currentArchived === 1 ? 0 : 1;
    try {
      const res = await fetchWithAuth(`/api/kijo/packages/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: newArchived })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle archive status:', err);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    console.log('[CLIENT] handleDeleteCategory called for ID:', id, 'Name:', name);
    if (!confirm(`Hapus kategori "${name}"? Seluruh paket di dalamnya juga akan terhapus (Smart Delete).`)) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      console.log('[CLIENT] Delete category response:', data);
      if (res.ok && data.success) {
        console.log('[CLIENT] Category deleted successfully');
        showAlert('Kategori dan paket di dalamnya berhasil dihapus (Smart Delete).', 'success');
        await fetchData();
      } else {
        console.error('[CLIENT] Delete category failed:', data);
        showAlert(`Gagal menghapus kategori: ${data.message || 'Terjadi kesalahan server'}`, 'error');
      }
    } catch (err) {
      console.error('[CLIENT] Failed to delete category:', err);
      showAlert('Gagal menghubungi server untuk menghapus kategori', 'error');
    }
  };

  const handleClearPackages = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    console.log('[CLIENT] handleClearPackages called for ID:', id, 'Name:', name);
    if (!confirm(`Kosongkan seluruh paket dalam kategori "${name}"? Wadah kategori akan tetap ada.`)) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/categories/${id}/packages`, { method: 'DELETE' });
      console.log('[CLIENT] Clear packages response status:', res.status);
      if (res.ok) {
        console.log('[CLIENT] Packages cleared successfully');
        await fetchData();
      } else {
        const data = await res.json();
        console.error('[CLIENT] Clear packages failed:', data);
        showAlert(`Gagal mengosongkan paket: ${data.message || 'Terjadi kesalahan server'}`, 'error');
      }
    } catch (err) {
      console.error('[CLIENT] Failed to clear packages:', err);
      showAlert('Gagal menghubungi server untuk mengosongkan paket', 'error');
    }
  };

  const toggleCategoryVisibility = async (e: React.MouseEvent, id: number, currentVisible: number) => {
    e.stopPropagation();
    const newVisible = currentVisible === 1 ? 0 : 1;
    try {
      const res = await fetchWithAuth(`/api/kijo/categories/${id}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: newVisible })
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Failed to toggle visibility');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.start_date) {
      showAlert('Tanggal mulai libur wajib diisi!', 'warning');
      return;
    }
    const startDatetime = `${newHoliday.start_date} ${newHoliday.start_time || '00:00'}:00`;
    const endDatetime = newHoliday.end_date
      ? `${newHoliday.end_date} ${newHoliday.end_time || '23:59'}:59`
      : null;
    try {
      const res = await fetchWithAuth('/api/kijo/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, start_date: startDatetime, end_date: endDatetime, reason: newHoliday.reason })
      });
      if (res.ok) {
        setShowAddHoliday(false);
        setNewHoliday({ start_date: '', start_time: '00:00', end_date: '', end_time: '', reason: '' });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Batalkan jadwal libur ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
        showAlert('Jadwal libur berhasil dibatalkan.', 'success');
      } else {
        showAlert('Gagal membatalkan jadwal libur.', 'error');
      }
    } catch (err) {
      console.error('Failed to delete holiday');
      showAlert('Terjadi kesalahan saat menghubungi server.', 'error');
    }
  };

  const handleUpdateOperational = async () => {
    const workStart = operational.work_start;
    const workEnd = operational.work_end;

    if (workStart === workEnd) {
      showAlert('KRITERIA TIDAK TERPENUHI: Jam mulai dan jam selesai kerja tidak boleh sama.', 'warning');
      return;
    }

    setSaveStatus('saving');
    try {
      const res = await fetchWithAuth('/api/kijo/settings/operational', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          ...operational,
          weekly_days: operational.weekly_days.join(',')
        })
      });
      if (res.ok) {
        onRefreshStats();
        setSaveStatus('success'); // The UI will show a success message
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Failed to update operational settings');
      setSaveStatus('error');
      showAlert('Terjadi kesalahan koneksi saat memperbarui pengaturan.', 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const toggleManualStatus = async () => {
    const newStatus = manualStatus === 'online' ? 'offline' : 'online';
    try {
      const res = await fetchWithAuth('/api/kijo/settings/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status: newStatus })
      });
      if (res.ok) {
        setManualStatus(newStatus);
        onRefreshStats();
      }
    } catch (err) {
      console.error('Failed to toggle status');
    }
  };

  const toggleDay = (day: string) => {
    setOperational(prev => ({
      ...prev,
      weekly_days: prev.weekly_days.includes(day)
        ? prev.weekly_days.filter(d => d !== day)
        : [...prev.weekly_days, day]
    }));
  };

  const uniqueGames = ['Semua', ...Array.from(new Set(categories.map(c => c.game_name)))];
  const filteredCategories = selectedGameFilter === 'Semua' 
    ? categories 
    : categories.filter(c => c.game_name === selectedGameFilter);

  const filteredGameNames = Array.from(new Set(filteredCategories.map(c => c.game_name)));

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 px-4 md:px-0">
      {/* Sub-view: Waktu Operasional */}
      {(!subView || subView === 'operasional') && (
      <>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Waktu <span className="text-orange-primary">Operasional.</span></h2>
          <p className="text-text-muted text-xs md:text-sm mt-1">Kelola jadwal dan ketersediaan joki Anda.</p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={toggleManualStatus}
            className={`px-3 md:px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all border ${
              manualStatus === 'online' 
                ? 'bg-green-500/10 border-green-500/50 text-green-500 hover:bg-green-500/20' 
                : 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
            }`}
          >
            <span className="hidden md:inline">{manualStatus === 'online' ? 'ON' : 'OFF'}</span>
            <span className="md:hidden text-xs">{manualStatus === 'online' ? 'ON' : 'OFF'}</span>
          </button>
          <button 
            onClick={() => {
              const realBoostingAccounts = gameAccounts && Array.isArray(gameAccounts) 
                ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo') 
                : [];
              const boostingCount = realBoostingAccounts.length;
              if (boostingCount === 0) {
                showAlert('ANDA HARUS MENDAFTARKAN AKUN BOOSTING TERLEBIH DAHULU DI MENU AKUN SEBELUM MEMBUAT KATEGORI!', 'warning');
                return;
              }
              if (boostingCount === 1) {
                setSelectedGameAccountId(realBoostingAccounts[0].id);
              }
              setShowAddCategory(true);
            }}
            className={`font-bold px-3 md:px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,159,28,0.2)] ${
              (gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0) === 0
                ? 'bg-text-muted/20 text-text-muted cursor-not-allowed grayscale'
                : 'bg-orange-primary text-black hover:scale-105'
            }`}
          >
            <span className="hidden md:inline uppercase">Kategori Baru</span>
            <span className="md:hidden text-xs uppercase">Kategori</span>
          </button>
        </div>
      </div>

      {/* Operasional Content - reorganized into boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: Hari Aktif, Jam Aktif, Lama Pre-Order */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-8">
          {/* Weekly Schedule */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-main/70">
              <span className="text-xs font-bold uppercase tracking-wider">Hari Aktif</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-1 py-2 rounded-lg text-[11px] font-bold transition-all border text-center ${
                    operational.weekly_days.includes(day)
                      ? 'bg-orange-primary border-orange-primary text-black'
                      : 'bg-bg-main border-border-main text-text-muted hover:border-text-muted/50'
                  }`}
                >
                  {day.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Active Hours */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-main/70">
              <span className="text-xs font-bold uppercase tracking-wider">Jam Aktif</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Mulai</label>
                <div className="relative">
                  <select 
                    className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm appearance-none cursor-pointer font-bold"
                    value={operational.work_start}
                    onChange={(e) => setOperational({...operational, work_start: e.target.value})}
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time} className="bg-bg-sidebar text-text-main">{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Selesai</label>
                <div className="relative">
                  <select 
                    className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm appearance-none cursor-pointer font-bold"
                    value={operational.work_end}
                    onChange={(e) => setOperational({...operational, work_end: e.target.value})}
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time} className="bg-bg-sidebar text-text-main">{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-order Duration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-main/70">
              <span className="text-xs font-bold uppercase tracking-wider">Lama Pre-Order</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  inputMode="numeric"
                  max="7"
                  placeholder="0"
                  className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold pr-12"
                  value={operational.pre_order_days === 0 ? '' : operational.pre_order_days}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    let val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    if (isNaN(val)) val = 0;
                    if (val > 7) val = 7;
                    setOperational({...operational, pre_order_days: val});
                  }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">HARI</span>
              </div>
            </div>
            <p className="text-xs text-text-muted italic">Set "0" untuk pemesanan hari yang sama. Maksimal 7 hari.</p>
          </div>
        </div>

        {/* Box 2: Jam Istirahat & Batas Maks Pesanan */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-8">
          {/* Jam Istirahat */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-main/70">
              <span className="text-xs font-bold uppercase tracking-wider">Jam Istirahat (Setelah Pesanan)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold pr-12"
                  value={operational.break_time === 0 ? '' : operational.break_time}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    if (raw === '') {
                      setOperational({...operational, break_time: 0});
                      return;
                    }
                    const val = parseInt(raw, 10);
                    if (val === 0) {
                      showAlert('Jam istirahat tidak boleh 0!', 'warning');
                      return;
                    }
                    setOperational({...operational, break_time: val});
                  }}
                  onBlur={() => {
                    if (!operational.break_time || operational.break_time < 1) {
                      setOperational({...operational, break_time: 1});
                    }
                  }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">JAM</span>
              </div>
            </div>
            <p className="text-xs text-text-muted italic">Minimal 1 jam istirahat wajib setelah setiap pesanan selesai.</p>
          </div>

          {/* Slot Limit */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-main/70">
              <span className="text-xs font-bold uppercase tracking-wider">Batas Maksimal Pesanan</span>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                inputMode="numeric"
                max="10"
                placeholder="0"
                className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                value={operational.max_slots === 0 ? '' : operational.max_slots}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  let val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  if (val > 10) val = 10;
                  setOperational({...operational, max_slots: val});
                }}
              />
            </div>
            <p className="text-xs text-text-muted italic">Set "0" untuk tanpa batas. Maksimal 10 slot.</p>
          </div>
        </div>
      </div>

      {/* Box 3: Waktu Libur */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-main/70">
            <span className="text-xs font-bold uppercase tracking-wider">Waktu Libur</span>
          </div>
          <button
            onClick={() => setShowAddHoliday(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-orange-primary hover:text-orange-primary/80 transition-all border border-orange-primary/30 rounded-lg px-3 py-1.5 hover:bg-orange-primary/5"
          >
            + Tambah
          </button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-xs text-text-muted italic px-1">Tidak ada jadwal libur.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.id} className="flex items-start justify-between gap-3 bg-bg-main border border-blue-500/20 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-main truncate">{h.reason || 'Libur'}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {new Date(h.start_date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {h.end_date
                      ? ` → ${new Date(h.end_date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : ' → Sampai online'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="text-text-muted hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <button 
        onClick={handleUpdateOperational}
        disabled={saveStatus === 'saving'}
        className={`w-full font-bold py-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs ${
          saveStatus === 'success' 
            ? 'bg-green-500/20 border-green-500 text-green-500' 
            : saveStatus === 'error'
            ? 'bg-red-500/20 border-red-500 text-red-500'
            : 'bg-orange-primary text-black border-orange-primary shadow-lg shadow-orange-primary/10'
        }`}
      >
        {saveStatus === 'saving' ? (
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : saveStatus === 'success' ? (
          <>
            JADWAL TERUPDATE
          </>
        ) : (
          <>
            SIMPAN PENGATURAN
          </>
        )}
      </button>
      </>
      )}

      {/* Sub-view: Paket Saya */}
      {subView === 'paket' && (
      <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Paket <span className="text-orange-primary">Saya.</span></h2>
          <p className="text-text-muted text-xs md:text-sm mt-1">Kelola kategori dan paket layanan Anda.</p>
        </div>
        <button 
          onClick={() => {
            const realBoostingAccounts = gameAccounts && Array.isArray(gameAccounts) 
              ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo') 
              : [];
            const boostingCount = realBoostingAccounts.length;
            if (boostingCount === 0) {
              showAlert('ANDA HARUS MENDAFTARKAN AKUN BOOSTING TERLEBIH DAHULU DI MENU AKUN SEBELUM MEMBUAT KATEGORI!', 'warning');
              return;
            }
            if (boostingCount === 1) {
              setSelectedGameAccountId(realBoostingAccounts[0].id);
            }
            setShowAddCategory(true);
          }}
          className={`font-bold px-3 md:px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,159,28,0.2)] ${
            (gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0) === 0
              ? 'bg-text-muted/20 text-text-muted cursor-not-allowed grayscale'
              : 'bg-orange-primary text-black hover:scale-105'
          }`}
        >
          <span className="uppercase text-xs">Tambah Kategori</span>
        </button>
      </div>

      {/* Game Filter */}
      {uniqueGames.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 bg-bg-sidebar p-1.5 rounded-2xl border border-border-main shadow-sm">
            {uniqueGames.map((game) => (
              <button
                key={game as string}
                onClick={() => setSelectedGameFilter(game as string)}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  selectedGameFilter === game 
                    ? 'bg-orange-primary border-orange-primary text-black shadow-lg shadow-orange-primary/20' 
                    : 'bg-bg-main border-border-main text-text-muted hover:text-text-main hover:border-text-muted/30'
                }`}
              >
                {(game as string).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Boosting Account Filter */}
      {gameAccounts && Array.isArray(gameAccounts) && gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 bg-bg-sidebar p-1.5 rounded-2xl border border-border-main shadow-sm">
            <button
              onClick={() => setSelectedAccountFilter('Semua')}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                selectedAccountFilter === 'Semua'
                  ? 'bg-orange-primary border-orange-primary text-black shadow-lg shadow-orange-primary/20'
                  : 'bg-bg-main border-border-main text-text-muted hover:text-text-main hover:border-text-muted/30'
              }`}
            >
              SEMUA AKUN
            </button>
            {gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountFilter(acc.id)}
                className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  selectedAccountFilter === acc.id
                    ? 'bg-orange-primary border-orange-primary text-black shadow-lg shadow-orange-primary/20'
                    : 'bg-bg-main border-border-main text-text-muted hover:text-text-main hover:border-text-muted/30'
                }`}
              >
                {acc.nickname.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* Sub-view: Pesan */}
      {subView === 'pesan' && (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Pesan <span className="text-orange-primary">& Chat.</span></h2>
          <p className="text-text-muted text-xs md:text-sm mt-1">Lihat statistik dan kelola pesan pesanan Anda.</p>
        </div>

        {/* Chat Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6">
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-2">Chat Dibalas</p>
            <p className="text-3xl font-bold text-text-main">—</p>
            <p className="text-xs text-text-muted mt-1">Persentase chat yang Anda balas</p>
          </div>
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6">
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-2">Chat Terbalas</p>
            <p className="text-3xl font-bold text-text-main">—</p>
            <p className="text-xs text-text-muted mt-1">Persentase chat yang dibalas ke Anda</p>
          </div>
        </div>

        {/* Chat List with tabs */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border-main">
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-primary text-black">Chat Aktif</button>
              <button className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main">Chat Selesai</button>
            </div>
          </div>
          <div className="divide-y divide-border-main">
            <div className="p-12 text-center">
              <p className="text-text-muted text-sm">Tidak ada chat aktif saat ini.</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Categories & Packages - only show when paket subView */}
      {subView === 'paket' && (
      <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-12">
              {(() => {
                const finalFiltered = filteredCategories.filter(c => 
                  selectedAccountFilter === 'Semua' || c.game_account_id === selectedAccountFilter
                );
                
                if (finalFiltered.length === 0) {
                  return (
                    <div className="bg-bg-sidebar border border-dashed border-border-main rounded-2xl p-20 text-center shadow-sm">
                      <h3 className="text-text-main font-bold text-lg mb-2">Belum Ada Kategori</h3>
                      <p className="text-text-muted text-sm max-w-xs mx-auto mb-8">Mulai dengan membuat kategori layanan berdasarkan game (misal: Mobile Legends - Rank Push).</p>
                      <button 
                        onClick={() => {
                          const realBoostingAccounts = gameAccounts && Array.isArray(gameAccounts) 
                            ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo') 
                            : [];
                          const boostingCount = realBoostingAccounts.length;
                          if (boostingCount === 0) {
                            showAlert('ANDA HARUS MENDAFTARKAN AKUN BOOSTING TERLEBIH DAHULU DI MENU AKUN SEBELUM MEMBUAT KATEGORI!', 'warning');
                            return;
                          }
                          if (boostingCount === 1) {
                            setSelectedGameAccountId(realBoostingAccounts[0].id);
                          }
                          setShowAddCategory(true);
                        }}
                        disabled={(gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0) === 0}
                        className={`font-bold text-sm transition-all ${
                          (gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0) === 0
                            ? 'text-text-muted cursor-not-allowed opacity-50'
                            : 'text-orange-primary hover:underline'
                        }`}
                      >
                        {(gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0) === 0
                          ? 'Tambahkan Akun Boosting Terlebih Dahulu'
                          : 'Buat Kategori Sekarang'}
                      </button>
                    </div>
                  );
                }

                const finalGameNames = Array.from(new Set(finalFiltered.map(c => c.game_name)));

                return finalGameNames.map(gameName => {
                  const gameCategories = finalFiltered.filter(c => c.game_name === gameName);
                  const accountIds = Array.from(new Set(gameCategories.map(c => c.game_account_id)));

                  return (
                    <div key={gameName} className="space-y-8">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-1.5 h-6 bg-orange-primary rounded-full" />
                        <h3 className="text-lg font-bold text-text-main uppercase tracking-wider">{gameName}</h3>
                      </div>
                      
                      <div className="space-y-10">
                        {accountIds.map(accId => {
                          const accCategories = gameCategories.filter(c => c.game_account_id === accId);
                          const account = gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.find(a => a.id === accId) : null;
                          const boostingCount = gameAccounts && Array.isArray(gameAccounts) ? gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo').length : 0;

                          return (
                            <div key={accId || 'no-account'} className="space-y-4">
                              {!account && accId && (
                                <div className="flex flex-col gap-1.5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl ml-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                                      Akun Boosting Dihapus — Kategori Tersembunyi dari Marketplace
                                    </span>
                                  </div>
                                  <span className="text-xs text-red-400/70 ml-[22px]">
                                    Klik <span className="font-bold">⚙</span> pada tiap kategori di bawah untuk menautkan ulang ke akun aktif.
                                  </span>
                                </div>
                              )}
                              {account && boostingCount > 1 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-bg-sidebar/50 border border-border-main rounded-xl w-fit ml-2">
                                  <span className="text-xs font-bold text-text-main uppercase tracking-widest">
                                    Akun: {(() => {
                                      let nickname = account.nickname;
                                      let gameId = account.game_id;
                                      
                                      try {
                                        const dynamic = account.dynamic_data ? JSON.parse(account.dynamic_data) : {};
                                        nickname = nickname || dynamic['Nickname'] || dynamic['ID'] || '';
                                        
                                        // Handle Game ID and Hashtag for Valorant/others
                                        // Valorant usually uses Nickname#Hashtag
                                        const idPart = account.game_id || dynamic['ID Game'] || dynamic['ID'] || '';
                                        const hashtagPart = dynamic['Hashtag'] || '';
                                        
                                        if (idPart && hashtagPart) {
                                          gameId = `${idPart}#${hashtagPart}`;
                                        } else if (hashtagPart) {
                                          // If only hashtag is present (common for Valorant if Nickname is stored separately)
                                          // We can use the nickname as the idPart if idPart is empty
                                          if (!idPart && nickname) {
                                            gameId = `${nickname}#${hashtagPart}`;
                                          } else {
                                            gameId = hashtagPart;
                                          }
                                        } else {
                                          gameId = idPart || '-';
                                        }

                                        if (dynamic['Server ID'] || dynamic['Server']) {
                                          const server = dynamic['Server ID'] || dynamic['Server'];
                                          gameId = `${gameId} (${server})`;
                                        }
                                      } catch (e) {
                                        nickname = nickname || '-';
                                        gameId = gameId || '-';
                                      }
                                      
                                      return `${nickname || '-'} (${gameId || '-'})`;
                                    })()}
                                  </span>
                                </div>
                              )}
                              <div className="space-y-6">
                                {accCategories.map((category) => (
                                  <motion.div 
                                    key={category.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm"
                                  >
                                    <div className="p-4 md:p-6 border-b border-border-main flex items-center justify-between gap-2 bg-gradient-to-r from-orange-primary/5 to-transparent">
                                      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                                          category.visible === 1 
                                            ? 'bg-orange-primary/10 border-orange-primary/20 text-orange-primary' 
                                            : 'bg-text-muted/10 border-text-muted/20 text-text-muted'
                                        }`}>
                                          <span className="text-sm">●</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[11px] font-bold text-orange-primary uppercase tracking-widest mb-0.5">Kategori #{category.slot_id}</div>
                                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <h3 className={`font-bold text-sm md:text-lg transition-colors truncate ${category.visible === 1 ? 'text-text-main' : 'text-text-muted'}`}>
                                              {category.name}
                                            </h3>
                                            <div className="flex flex-wrap gap-1 md:gap-2">
                                              {category.rank && (
                                                <span className="text-[11px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded uppercase tracking-wider shrink-0 bg-orange-primary/10 text-orange-primary border border-orange-primary/20">
                                                  {category.rank}
                                                </span>
                                              )}
                                              <span className={`text-[11px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                                category.visible === 1 
                                                  ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                              }`}>
                                                {category.visible === 1 ? 'Tampil' : 'Tersembunyi'}
                                              </span>
                                            </div>
                                          </div>
                                          <p className="text-xs text-text-muted font-medium mt-0.5">{category.packages.length} Paket Layanan</p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                                        <div className="grid grid-cols-2 gap-1 md:flex md:items-center md:gap-2">
                                          <button 
                                            onClick={(e) => {
                                              if (!account && category.game_account_id) {
                                                showAlert('Tidak dapat menampilkan kategori. Tautkan ke akun boosting aktif terlebih dahulu.', 'warning');
                                                return;
                                              }
                                              if (!category.game_account_id) {
                                                showAlert('Tidak dapat menampilkan kategori. Tambahkan akun boosting ke kategori ini terlebih dahulu.', 'warning');
                                                return;
                                              }
                                              toggleCategoryVisibility(e, category.id, category.visible);
                                            }}
                                            title={!account && category.game_account_id ? 'Akun dihapus — tautkan ulang terlebih dahulu' : !category.game_account_id ? 'Tambahkan akun ke kategori terlebih dahulu' : category.visible === 1 ? 'Sembunyikan Kategori' : 'Tampilkan Kategori'}
                                            className={`p-1.5 md:p-2 rounded-lg border transition-all ${
                                              (!account && category.game_account_id) || !category.game_account_id
                                                ? 'text-text-muted/40 border-border-main/50 cursor-not-allowed opacity-50'
                                                : category.visible === 1 
                                                  ? 'text-text-muted border-border-main hover:text-text-main hover:bg-bg-main' 
                                                  : 'text-orange-primary border-orange-primary/30 bg-orange-primary/5 hover:bg-orange-primary/10'
                                            }`}
                                          >
                                            {category.visible === 1 ? '○' : '●'}
                                          </button>

                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingCategory(category);
                                              setNewCategoryName(category.name);
                                              setSelectedGame(category.game_name);
                                              setSelectedGameAccountId(account ? (category.game_account_id || '') : '');
                                              setSelectedRank(category.rank || '');
                                              setShowAddCategory(true);
                                            }}
                                            title="Edit Kategori"
                                            className="p-1.5 md:p-2 text-text-muted border border-border-main rounded-lg hover:text-orange-primary hover:bg-orange-primary/5 transition-all"
                                          >
                                            ⚙
                                          </button>

                                          <button 
                                            onClick={(e) => handleClearPackages(e, category.id, category.name)}
                                            title="Kosongkan Seluruh Paket"
                                            className="p-1.5 md:p-2 text-text-muted border border-border-main rounded-lg hover:text-orange-primary hover:bg-orange-primary/5 transition-all"
                                          >
                                            ∅
                                          </button>

                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const res = await fetchWithAuth(`/api/kijo/categories/${category.id}/duplicate`, { method: 'POST' });
                                                if (res.ok) {
                                                  showAlert('Kategori berhasil diduplikasi!', 'success');
                                                  fetchData();
                                                } else {
                                                  const data = await res.json();
                                                  showAlert(data.message || 'Gagal menduplikasi kategori', 'error');
                                                }
                                              } catch (err) {
                                                showAlert('Gagal menghubungi server', 'error');
                                              }
                                            }}
                                            title="Duplikasi Kategori"
                                            className="p-1.5 md:p-2 text-text-muted border border-border-main rounded-lg hover:text-orange-primary hover:bg-orange-primary/5 transition-all"
                                          >
                                            ⎘
                                          </button>

                                          <button 
                                            onClick={(e) => handleDeleteCategory(e, category.id, category.name)}
                                            title="Hapus Kategori"
                                            className="p-1.5 md:p-2 text-text-muted border border-border-main rounded-lg hover:text-red-500 hover:bg-red-500/5 transition-all"
                                          >
                                            ×
                                          </button>
                                        </div>

                                        <div className="hidden sm:block w-px h-6 bg-border-main mx-1" />

                                        <button 
                                          onClick={() => {
                                            setActiveCategoryId(category.id);
                                            setShowAddPackage(true);
                                          }}
                                          className="bg-orange-primary text-black md:bg-orange-primary/10 md:text-orange-primary text-xs md:text-[11px] font-bold flex items-center justify-center w-7 h-7 md:w-auto md:h-7 md:px-2.5 rounded-lg border border-orange-primary/20 transition-all shrink-0 hover:bg-orange-primary hover:text-black"
                                        >
                                          <span className="hidden md:inline ml-1 uppercase">Tambah Paket</span>
                                        </button>
                                      </div>
                                    </div>

                                    <div className={`p-6 transition-opacity ${category.visible === 1 ? 'opacity-100' : 'opacity-40'}`}>
                                      {(() => {
                                        // Overtime check: only compare against active work window
                                        const [wsh, wsm] = (operational.work_start || '08:00').split(':').map(Number);
                                        const [weh, wem] = (operational.work_end || '22:00').split(':').map(Number);
                                        let workMins = (weh * 60 + wem) - (wsh * 60 + wsm);
                                        if (workMins <= 0) workMins += 24 * 60; // overnight
                                        const isOvertime = (pkg: PackageData) => pkg.duration > workMins && pkg.archived !== 1;
                                        
                                        const overtimePkgs = category.packages.filter(p => isOvertime(p));
                                        
                                        return (
                                          <>
                                            {overtimePkgs.length > 0 && (
                                              <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                                                <span className="text-xs text-red-400">
                                                  <strong className="uppercase tracking-wider">Peringatan:</strong> {overtimePkgs.map(p => `"${p.name}"`).join(', ')} memiliki durasi melebihi jam aktif ({Math.floor(workMins / 60)}j{workMins % 60 > 0 ? `${workMins % 60}m` : ''}).
                                                </span>
                                              </div>
                                            )}
                                            {category.packages.length === 0 ? (
                                              <p className="text-text-muted text-xs italic text-center py-4">Belum ada paket di kategori ini.</p>
                                            ) : (
                                        <>
                                          {category.packages.filter(p => p.package_type === 'SOLO').length > 0 && (
                                            <div className="space-y-4">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Opsi Solo</span>
                                                <div className="h-[1px] flex-1 bg-border-main/50"></div>
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {category.packages.filter(p => p.package_type === 'SOLO').map((pkg) => (
                                                  <PackageItem 
                                                    key={pkg.id} 
                                                    pkg={pkg}
                                                    overtimeWarning={isOvertime(pkg)} 
                                                    onEdit={() => {
                                                      setEditingPackage(pkg);
                                                      const h = Math.floor(pkg.duration / 60);
                                                      const m = pkg.duration % 60;
                                                      const eh = Math.floor((pkg.recurring_extra_duration || 0) / 60);
                                                      const em = (pkg.recurring_extra_duration || 0) % 60;
                                                      setNewPackage({
                                                        name: pkg.name,
                                                        price: pkg.price.toString(),
                                                        duration: pkg.duration.toString(),
                                                        duration_hours: h.toString(),
                                                        duration_minutes: m.toString(),
                                                        package_type: pkg.package_type,
                                                        player_count: (pkg.player_count || 2).toString(),
                                                        min_players: (pkg.min_players || 2).toString(),
                                                        max_players: (pkg.max_players || 4).toString(),
                                                        is_bundle: pkg.is_bundle || 0,
                                                        bundle_start: pkg.bundle_start || '',
                                                        bundle_end: pkg.bundle_end || '',
                                                        rank: pkg.rank || '',
                                                        is_recurring: pkg.is_recurring || 0,
                                                        recurring_extra_duration: pkg.recurring_extra_duration || 0,
                                                        recurring_every_quantity: pkg.recurring_every_quantity || 1,
                                                        extra_duration_hours: eh.toString(),
                                                        extra_duration_minutes: em.toString(),
                                                        criteria: pkg.criteria || ''
                                                      });
                                                      setActiveCategoryId(category.id);
                                                      setShowAddPackage(true);
                                                    }}
                                                    onArchive={(e) => handleArchivePackage(e, pkg.id, pkg.archived)}
                                                    onDelete={(e) => handleDeletePackage(e, pkg.id)}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {category.packages.filter(p => p.package_type === 'SOLO').length > 0 && category.packages.filter(p => p.package_type === 'VIP').length > 0 && (
                                            <div className="my-6 border-t border-dashed border-border-main"></div>
                                          )}

                                          {category.packages.filter(p => p.package_type === 'VIP').length > 0 && (
                                            <div className="space-y-4">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Opsi VIP</span>
                                                <div className="h-[1px] flex-1 bg-border-main/50"></div>
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {category.packages.filter(p => p.package_type === 'VIP').map((pkg) => (
                                                  <PackageItem 
                                                    key={pkg.id} 
                                                    pkg={pkg}
                                                    overtimeWarning={isOvertime(pkg)} 
                                                    onEdit={() => {
                                                      setEditingPackage(pkg);
                                                      const h = Math.floor(pkg.duration / 60);
                                                      const m = pkg.duration % 60;
                                                      const eh = Math.floor((pkg.recurring_extra_duration || 0) / 60);
                                                      const em = (pkg.recurring_extra_duration || 0) % 60;
                                                      setNewPackage({
                                                        name: pkg.name,
                                                        price: pkg.price.toString(),
                                                        duration: pkg.duration.toString(),
                                                        duration_hours: h.toString(),
                                                        duration_minutes: m.toString(),
                                                        package_type: pkg.package_type,
                                                        player_count: (pkg.player_count || 2).toString(),
                                                        min_players: (pkg.min_players || 2).toString(),
                                                        max_players: (pkg.max_players || 4).toString(),
                                                        is_bundle: pkg.is_bundle || 0,
                                                        bundle_start: pkg.bundle_start || '',
                                                        bundle_end: pkg.bundle_end || '',
                                                        rank: pkg.rank || '',
                                                        is_recurring: pkg.is_recurring || 0,
                                                        recurring_extra_duration: pkg.recurring_extra_duration || 0,
                                                        recurring_every_quantity: pkg.recurring_every_quantity || 1,
                                                        extra_duration_hours: eh.toString(),
                                                        extra_duration_minutes: em.toString(),
                                                        criteria: pkg.criteria || ''
                                                      });
                                                      setActiveCategoryId(category.id);
                                                      setShowAddPackage(true);
                                                    }}
                                                    onArchive={(e) => handleArchivePackage(e, pkg.id, pkg.archived)}
                                                    onDelete={(e) => handleDeletePackage(e, pkg.id)}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAddCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddCategory(false); setEditingCategory(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto allow-scrollbar"
            >
              <h3 className="text-xl md:text-2xl font-bold text-text-main mb-6">{editingCategory ? 'Edit' : 'Kategori'} <span className="text-orange-primary">{editingCategory ? 'Kategori.' : 'Baru.'}</span></h3>
              <form onSubmit={handleAddCategory} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">GAME</label>
                  {availableGames.length <= 1 ? (
                    <div className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main font-bold">
                      {availableGames[0]?.name || selectedGame}
                    </div>
                  ) : (
                    <div className="relative">
                      <select 
                        required
                        className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold"
                        value={selectedGame}
                        onChange={(e) => setSelectedGame(e.target.value)}
                      >
                        {availableGames.map(game => (
                          <option key={game.name} value={game.name}>{game.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">NAMA KATEGORI</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="Nama Kategori"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>

                {(() => {
                  if (!gameAccounts || !Array.isArray(gameAccounts)) return null;
                  const boostingAccounts = gameAccounts.filter(acc => acc.account_type === 'boosting' && acc.nickname !== 'New Kijo' && acc.game_name === selectedGame);
                  if (boostingAccounts.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">AKUN BOOSTING</label>
                      {boostingAccounts.length === 1 ? (
                        <div className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main font-bold">
                          {(() => {
                            const acc = boostingAccounts[0];
                            let nickname = acc.nickname;
                            let gameId = acc.game_id;
                            
                            if (!nickname || !gameId) {
                              try {
                                const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                                nickname = nickname || dynamic['Nickname'] || '';
                                gameId = gameId || dynamic['ID Game'] || '';
                                if (dynamic['Server ID']) {
                                  gameId = `${gameId} (${dynamic['Server ID']})`;
                                }
                              } catch (e) {}
                            }
                            return `${nickname || '-'} (${gameId || '-'})`;
                          })()}
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            required
                            className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold"
                            value={selectedGameAccountId}
                            onChange={(e) => setSelectedGameAccountId(e.target.value === '' ? '' : Number(e.target.value))}
                          >
                            <option value="">-- Pilih Akun --</option>
                            {boostingAccounts.map(acc => {
                              let nickname = acc.nickname;
                              let gameId = acc.game_id;
                              
                              if (!nickname || !gameId) {
                                try {
                                  const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                                  nickname = nickname || dynamic['Nickname'] || '';
                                  gameId = gameId || dynamic['ID Game'] || '';
                                  if (dynamic['Server ID']) {
                                    gameId = `${gameId} (${dynamic['Server ID']})`;
                                  }
                                } catch (e) {}
                              }
                              return (
                                <option key={acc.id} value={acc.id}>
                                  {nickname || '-'} ({gameId || '-'})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const game = availableGames.find(g => g.name === selectedGame);
                  if (!game || !game.ranks || !Array.isArray(game.ranks)) return null;
                  return (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">RANK TITLE (CATEGORY)</label>
                      <div className="relative">
                        <select
                          className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold"
                          value={selectedRank}
                          onChange={(e) => setSelectedRank(e.target.value)}
                        >
                          <option value="">-- Tanpa Rank --</option>
                          {game.ranks.map((r: any, idx: number) => (
                            <option key={idx} value={r.title}>{r.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setShowAddCategory(false); setEditingCategory(null); }}
                    className="flex-1 bg-text-muted/10 text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-text-muted/20 transition-all"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all"
                  >
                    SIMPAN
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddPackage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddPackage(false); setEditingPackage(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar pb-24 md:pb-8"
              >
                <h3 className="text-xl md:text-2xl font-bold text-text-main mb-6">{editingPackage ? 'Edit' : 'Paket'} <span className="text-orange-primary">{editingPackage ? 'Paket.' : 'Baru.'}</span></h3>
              <form onSubmit={handleAddPackage} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Tipe Paket</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPackage({...newPackage, package_type: 'SOLO'})}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newPackage.package_type === 'SOLO' ? 'bg-orange-primary text-black border-orange-primary' : 'bg-bg-main text-text-muted border-border-main'}`}
                    >
                      SOLO
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPackage({...newPackage, package_type: 'VIP'})}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newPackage.package_type === 'VIP' ? 'bg-orange-primary text-black border-orange-primary' : 'bg-bg-main text-text-muted border-border-main'}`}
                    >
                      VIP
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Kriteria Paket</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPackage({...newPackage, is_bundle: 0})}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newPackage.is_bundle === 0 ? 'bg-orange-primary text-black border-orange-primary' : 'bg-bg-main text-text-muted border-border-main'}`}
                    >
                      SATUAN
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPackage({...newPackage, is_bundle: 1, is_recurring: 0})}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newPackage.is_bundle === 1 ? 'bg-orange-primary text-black border-orange-primary' : 'bg-bg-main text-text-muted border-border-main'}`}
                    >
                      PAKETAN
                    </button>
                  </div>
                </div>

                {newPackage.is_bundle === 0 && (
                  <div className="flex items-center gap-3 bg-bg-main border border-border-main rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-text-main uppercase tracking-widest">Pemesanan Berulang</h4>
                      <p className="text-xs text-text-muted mt-0.5">Izinkan pembeli memesan lebih dari 1 kuantitas.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewPackage({...newPackage, is_recurring: newPackage.is_recurring === 1 ? 0 : 1})}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${newPackage.is_recurring === 1 ? 'bg-orange-primary' : 'bg-bg-sidebar border border-border-main'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${newPackage.is_recurring === 1 ? 'right-1 bg-black' : 'left-1 bg-text-muted'}`} />
                    </button>
                  </div>
                )}

                {newPackage.package_type === 'VIP' && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Minimum Pemain</label>
                      <input 
                        type="number" 
                        required
                        min="2"
                        placeholder="2"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                        value={newPackage.min_players}
                        onChange={(e) => setNewPackage({...newPackage, min_players: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Maksimum Pemain</label>
                      <input 
                        type="number" 
                        required
                        min="2"
                        placeholder="4"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                        value={newPackage.max_players}
                        onChange={(e) => setNewPackage({...newPackage, max_players: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Rank</label>
                  <div className="relative">
                    <select
                      className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold text-sm"
                      value={newPackage.rank}
                      onChange={(e) => setNewPackage({...newPackage, rank: e.target.value})}
                    >
                      <option value="">-- Tanpa Rank --</option>
                      {(() => {
                        const category = categories.find(c => c.id === activeCategoryId);
                        if (!category) return null;
                        const game = availableGames.find(g => g.name === category.game_name);
                        if (!game || !game.ranks || !Array.isArray(game.ranks)) return null;
                        
                        // Filter ranks if category has a specific rank assigned
                        const filteredRanks = category.rank 
                          ? game.ranks.filter((r: any) => r.title === category.rank)
                          : game.ranks;

                        return filteredRanks.map((r: any, idx: number) => (
                          <optgroup key={idx} label={r.title}>
                            {(r.tiers || []).map((tier: string, tIdx: number) => (
                              <option key={`${idx}-${tIdx}`} value={tier}>{tier}</option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nama Paket</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nama Paket"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                    value={newPackage.name}
                    onChange={(e) => setNewPackage({...newPackage, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Kriteria</label>
                  <input 
                    type="text" 
                    placeholder="Kriteria Tambahan"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                    value={newPackage.criteria}
                    onChange={(e) => setNewPackage({...newPackage, criteria: e.target.value})}
                  />
                </div>

                {newPackage.is_bundle === 1 && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Awal</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Rank Awal"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                        value={newPackage.bundle_start}
                        onChange={(e) => setNewPackage({...newPackage, bundle_start: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Akhir</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Rank Akhir"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                        value={newPackage.bundle_end}
                        onChange={(e) => setNewPackage({...newPackage, bundle_end: e.target.value})}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Harga (Rp)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="0"
                      className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                      value={newPackage.price}
                      onChange={(e) => setNewPackage({...newPackage, price: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Durasi</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-3 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold text-xs"
                          value={newPackage.duration_hours}
                          onChange={(e) => setNewPackage({...newPackage, duration_hours: e.target.value})}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i} Jam</option>
                          ))}
                        </select>
                      </div>
                      <div className="relative flex-1">
                        <select
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-3 text-text-main focus:outline-none focus:border-orange-primary transition-all appearance-none font-bold text-xs"
                          value={newPackage.duration_minutes}
                          onChange={(e) => setNewPackage({...newPackage, duration_minutes: e.target.value})}
                        >
                          <option value="0">0 Menit</option>
                          <option value="30">30 Menit</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowAddPackage(false)}
                    className="flex-1 bg-text-muted/10 text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-text-muted/20 transition-all text-sm"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-sm"
                  >
                    SIMPAN PAKET
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {showAddHoliday && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddHoliday(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto allow-scrollbar"
            >
              <h3 className="text-xl md:text-2xl font-bold text-text-main mb-6">Jadwal <span className="text-orange-primary">Libur.</span></h3>
              <form onSubmit={handleAddHoliday} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Alasan Libur</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Sakit, Perjalanan, Libur Nasional..."
                    className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                    value={newHoliday.reason}
                    onChange={(e) => setNewHoliday({...newHoliday, reason: e.target.value})}
                  />
                </div>

                {/* Start datetime */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Mulai <span className="text-orange-primary">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="date" 
                      required
                      className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                      value={newHoliday.start_date}
                      onChange={(e) => setNewHoliday({...newHoliday, start_date: e.target.value})}
                    />
                    <div className="relative">
                      <select
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm appearance-none cursor-pointer font-bold"
                        value={newHoliday.start_time}
                        onChange={(e) => setNewHoliday({...newHoliday, start_time: e.target.value})}
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={t} value={t} className="bg-bg-sidebar text-text-main">{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* End datetime (optional) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Selesai <span className="text-text-muted/60 normal-case font-normal">(opsional)</span></label>
                    {newHoliday.end_date && (
                      <button type="button" onClick={() => setNewHoliday({...newHoliday, end_date: '', end_time: ''})} className="text-xs text-text-muted hover:text-red-400 transition-colors">Hapus</button>
                    )}
                  </div>
                  {!newHoliday.end_date ? (
                    <div
                      onClick={() => setNewHoliday({...newHoliday, end_date: newHoliday.start_date || new Date().toISOString().split('T')[0], end_time: '23:59'})}
                      className="w-full bg-bg-main border border-dashed border-border-main rounded-xl py-3 px-4 text-text-muted text-sm cursor-pointer hover:border-orange-primary/50 transition-all text-center"
                    >
                      Sampai online — klik untuk set waktu selesai
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="date"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm"
                        value={newHoliday.end_date}
                        onChange={(e) => setNewHoliday({...newHoliday, end_date: e.target.value})}
                      />
                      <div className="relative">
                        <select
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm appearance-none cursor-pointer font-bold"
                          value={newHoliday.end_time}
                          onChange={(e) => setNewHoliday({...newHoliday, end_time: e.target.value})}
                        >
                          {TIME_OPTIONS.map(t => (
                            <option key={t} value={t} className="bg-bg-sidebar text-text-main">{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-text-muted italic px-1">Jika tidak diisi, kijo tetap libur sampai menekan tombol ON secara manual.</p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowAddHoliday(false)}
                    className="flex-1 bg-text-muted/10 text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-text-muted/20 transition-all text-sm"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-sm"
                  >
                    SIMPAN JADWAL
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
