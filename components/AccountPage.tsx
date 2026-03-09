import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  Star, 
  Wallet, 
  ArrowUpRight, 
  History, 
  Gamepad2, 
  ShieldCheck, 
  LogOut, 
  KeyRound, 
  MessageSquare, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Award,
  CreditCard,
  Plus,
  Package,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface AccountPageProps {
  user: any;
  onLogout: () => void;
  onStartVerification?: () => void;
  setView?: (view: any) => void;
}

interface AccountData {
  user: any;
  ratings: any[];
  gameAccounts: any[];
  transactions: any[];
  withdrawals: any[];
  activeGames: string[];
  stats: {
    monthlyOrders: number;
    totalBooked: number;
  };
}

export default function AccountPage({ user, onLogout, onStartVerification, setView }: AccountPageProps) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const otpRefs = [
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
  ];
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<{ status: string, created_at: string, desired_game?: string, reason?: string } | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState<any>(null);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [gameFormData, setGameFormData] = useState<any>({
    game_name: '',
    nickname: '',
    game_id: '',
    rank: '',
    server: '',
    dynamic_data: {},
    account_type: 'personal' as 'personal' | 'boosting'
  });
  const [motto, setMotto] = useState(user.motto || '');
  const [isSavingMotto, setIsSavingMotto] = useState(false);

  const isKijo = data?.user.role === 'kijo' || user.role === 'kijo';

  const fetchData = async () => {
    try {
      const [accountRes, gamesRes, appStatusRes] = await Promise.all([
        fetchWithAuth(`/api/kijo/account/${user.id}`),
        fetchWithAuth('/api/kijo/available-games'),
        fetchWithAuth(`/api/kijo/application-status/${user.id}`)
      ]);
      
      if (accountRes.ok) {
        const accountData = await accountRes.json();
        setData(accountData);
        
        // Automatically set game_name for boosting account form if not set
        if (accountData.user.verified_game) {
          setGameFormData(prev => ({
            ...prev,
            game_name: accountData.user.verified_game
          }));
        }
      }
      
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        setAvailableGames(gamesData);
      }

      if (appStatusRes.ok) {
        const appData = await appStatusRes.json();
        setApplicationStatus(appData);
      }
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const handleSendOtp = async () => {
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/update-phone-2sv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setOtpSent(true);
        alert('OTP verifikasi telah dikirim ke email bisnis Anda');
      } else {
        const data = await res.json();
        alert(data.message || 'Gagal mengirim OTP');
      }
    } catch (error) {
      alert('Kesalahan server saat mengirim OTP');
    }
  };

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length < 6) {
      alert('Masukkan 6 digit kode OTP');
      return;
    }
    if (!newPhone || newPhone.length < 10) {
      alert('Nomor telepon baru tidak valid');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/verify-phone-2sv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: fullOtp, newPhone })
      });
      
      if (res.ok) {
        alert('Data berhasil diperbarui, silakan login kembali dengan kredensial baru Anda.');
        onLogout();
      } else {
        const data = await res.json();
        alert(data.message || 'Verifikasi gagal');
      }
    } catch (error) {
      alert('Kesalahan server saat memperbarui nomor telepon');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedData = value.slice(0, 6).split('');
      const newValues = [...otpValues];
      pastedData.forEach((char, i) => {
        if (index + i < 6) newValues[index + i] = char;
      });
      setOtpValues(newValues);
      const nextIndex = Math.min(index + pastedData.length, 5);
      otpRefs[nextIndex].current?.focus();
      return;
    }

    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);

    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleWithdrawAmountChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '').replace(/^0+/, '');
    setWithdrawAmount(numeric || '0');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(withdrawAmount);
    if (!withdrawAmount || numAmount < 20000) {
      alert('Minimal penarikan Rp 20.000');
      return;
    }

    setWithdrawStatus('loading');
    try {
      const res = await fetchWithAuth('/api/kijo/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          amount: parseInt(withdrawAmount),
          destination: data?.user.phone || data?.user.email
        })
      });
      if (res.ok) {
        setWithdrawStatus('success');
        setWithdrawAmount('');
        fetchData();
        setTimeout(() => setWithdrawStatus('idle'), 3000);
      } else {
        setWithdrawStatus('error');
      }
    } catch (error) {
      setWithdrawStatus('error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (newPassword.length < 8) {
      alert('Password minimal 8 karakter');
      return;
    }
    if (emojiRegex.test(newPassword)) {
      alert('Password tidak boleh mengandung emoji');
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      if (res.ok) {
        alert('Data berhasil diperbarui, silakan login kembali dengan kredensial baru Anda.');
        onLogout();
      } else {
        const data = await res.json();
        alert(data.message || 'Gagal mereset password');
      }
    } catch (error) {
      alert('Gagal mereset password');
    }
  };

  const handleSaveGameAccount = async (e: React.FormEvent, overrideData?: any) => {
    e.preventDefault();
    try {
      const payload = {
        ...(overrideData || gameFormData),
        userId: user.id,
      };
      
      // If no ID in payload but editingGame exists, use it
      if (!payload.id && editingGame?.id) {
        payload.id = editingGame.id;
      }
      
      console.log('[AccountPage] Saving game account:', payload);
      
      const res = await fetchWithAuth('/api/kijo/game-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert(editingGame ? 'Akun game diperbarui' : 'Akun game ditambahkan');
        setShowGameModal(false);
        setEditingGame(null);
        fetchData();
        
        // Reset form data
        setGameFormData({
          game_name: data.user.verified_game || 'Mobile Legends',
          nickname: '',
          game_id: '',
          rank: '',
          server: '',
          dynamic_data: {},
          account_type: 'personal'
        });
      } else {
        const errorData = await res.json();
        alert(`Gagal menyimpan akun game: ${errorData.message || 'Terjadi kesalahan server'}`);
      }
    } catch (error) {
      console.error('[AccountPage] Save Game Account Error:', error);
      alert('Gagal menyimpan akun game. Silakan periksa koneksi Anda.');
    }
  };

  const handleSaveMotto = async () => {
    setIsSavingMotto(true);
    try {
      const res = await fetchWithAuth('/api/kijo/update-motto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, motto })
      });
      if (res.ok) {
        alert('Motto berhasil diperbarui');
        // Update local user state if needed, but App.tsx usually handles sync
        try {
          window.dispatchEvent(new CustomEvent('refreshStats'));
        } catch (e) {
          console.warn('Failed to dispatch refreshStats event:', e);
        }
      }
    } catch (error) {
      alert('Gagal memperbarui motto');
    } finally {
      setIsSavingMotto(false);
    }
  };

  const openAddGame = () => {
    setEditingGame(null);
    const firstGame = availableGames[0];
    setGameFormData({
      game_name: firstGame?.name || '',
      nickname: '',
      game_id: '',
      rank: '',
      server: '',
      dynamic_data: {},
      account_type: 'personal'
    });
    setShowGameModal(true);
  };

  const openEditGame = (acc: any) => {
    setEditingGame(acc);
    setGameFormData({
      game_name: acc.game_name,
      nickname: acc.nickname,
      game_id: acc.game_id,
      rank: acc.rank,
      server: acc.server,
      dynamic_data: acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {},
      account_type: acc.account_type || 'personal'
    });
    setShowGameModal(true);
  };

  const handleDeleteGameAccount = async (id: number) => {
    if (!confirm('Hapus akun game ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/game-accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Akun game dihapus');
        fetchData();
      }
    } catch (error) {
      alert('Gagal menghapus akun game');
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Sinkronisasi Akun...</p>
      </div>
    );
  }

  const averageRating = data.ratings.length > 0 
    ? (data.ratings.reduce((acc, r) => acc + r.stars, 0) / data.ratings.length).toFixed(1)
    : '0.0';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Profile Summary Widget (Top) */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-10 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-primary/5 blur-[80px] -ml-24 -mb-24 rounded-full" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="relative shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-orange-primary to-orange-600 p-1 shadow-xl shadow-orange-primary/20">
                <div className="w-full h-full rounded-xl bg-bg-main flex items-center justify-center overflow-hidden">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-bg-sidebar shadow-lg" />
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <h2 className="text-2xl md:text-4xl font-bold text-text-main tracking-tighter">{user.full_name}</h2>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="bg-orange-primary/10 text-orange-primary text-xs font-bold px-3 py-1 rounded-full border border-orange-primary/20 uppercase tracking-widest">
                    {user.role}
                  </span>
                  <span className="bg-bg-main text-text-muted text-xs font-bold px-3 py-1 rounded-full border border-border-main uppercase tracking-widest">
                    Level 1 Member
                  </span>
                </div>
              </div>
              <p className="text-text-muted text-xs md:text-sm font-medium">
                Bergabung sejak {new Date(data.user.created_at || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                <div className="flex items-center gap-2 text-text-muted">
                  <Mail size={14} className="text-orange-primary" />
                  <span className="text-xs font-bold">{data.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Phone size={14} className="text-orange-primary" />
                  <span className="text-xs font-bold">{data.user.phone}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3 w-full">
            <div className="bg-bg-main/50 backdrop-blur-sm border border-border-main rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Saldo Aktif</p>
                <p className="text-lg font-bold text-text-main font-mono">Rp {(isKijo ? data.user.balance_active : data.user.wallet_jokies).toLocaleString()}</p>
              </div>
            </div>
            {!isKijo && (
              applicationStatus?.status === 'pending' ? (
                <div className="bg-orange-primary/10 border border-orange-primary/30 px-4 py-3 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-primary rounded-full animate-pulse" />
                    <span className="text-[11px] font-bold text-orange-primary uppercase tracking-widest">Verifikasi Diproses</span>
                  </div>
                  <p className="text-[11px] text-text-muted font-bold uppercase tracking-tight">Game: {applicationStatus.desired_game}</p>
                </div>
              ) : applicationStatus?.status === 'rejected' ? (
                <div className="space-y-2">
                  <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={10} className="text-red-500" />
                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest">Verifikasi Ditolak</span>
                    </div>
                    {applicationStatus.reason && (
                      <p className="text-[11px] text-text-muted font-bold leading-tight italic">"{applicationStatus.reason}"</p>
                    )}
                  </div>
                  <button 
                    onClick={onStartVerification}
                    className="w-full bg-orange-primary text-black font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={14} />
                    RE-VERIFY KIJO
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onStartVerification}
                  className="w-full bg-orange-primary text-black font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={14} />
                  BE A KIJO
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* Left Column: Wallet, Stats, Accounts (8/12) */}
        <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-10">
          {/* Riwayat Transaksi */}
          <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <History className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Riwayat Transaksi & Penarikan</h3>
              </div>
              <button className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline">Lihat Semua</button>
            </div>

            <div className="space-y-3">
              {data.withdrawals.length === 0 && data.transactions.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border-main rounded-2xl bg-bg-main/30">
                  <p className="text-text-muted text-xs font-medium italic">Belum ada riwayat transaksi.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show Withdrawals first for Kijo */}
                  {data.withdrawals.slice(0, 5).map((w) => (
                    <div key={`w-${w.id}`} className="bg-bg-main border border-border-main rounded-xl p-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/20">
                          <ArrowUpRight size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-text-main uppercase tracking-tight">Penarikan Saldo</div>
                          <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{new Date(w.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-500 font-mono">- Rp {w.amount.toLocaleString()}</div>
                        <div className={`text-[11px] font-semibold uppercase tracking-wide ${
                          w.status === 'completed' ? 'text-green-500' : w.status === 'rejected' ? 'text-red-500' : 'text-orange-primary'
                        }`}>
                          {w.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Show Transactions */}
                  {data.transactions.slice(0, 5).map((t) => (
                    <div key={`t-${t.id}`} className="bg-bg-main border border-border-main rounded-xl p-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          t.type === 'income' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {t.type === 'income' ? <Plus size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-text-main uppercase tracking-tight">{t.description}</div>
                          <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{new Date(t.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold font-mono ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {t.type === 'income' ? '+' : '-'} Rp {t.amount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Selesai</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Wallet Card */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 md:space-y-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <Wallet className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Dompet {isKijo ? 'Pendapatan' : 'Refund'}</h3>
                </div>
                <CreditCard size={16} className="text-text-muted" />
              </div>

              <div className="space-y-3 md:space-y-4">
                <div className="bg-gradient-to-br from-orange-primary to-orange-600 rounded-xl md:rounded-2xl p-4 md:p-6 text-black relative overflow-hidden group shadow-lg shadow-orange-primary/10">
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
                    <TrendingUp size={24} />
                  </div>
                  <div className="relative z-10">
                    <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Saldo {isKijo ? 'Aktif' : 'Refund'}</div>
                    <div className="text-xl md:text-3xl font-bold font-mono">
                      Rp {isKijo ? data.user.balance_active?.toLocaleString() || '0' : data.user.wallet_jokies?.toLocaleString() || '0'}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] md:text-xs font-bold bg-black/10 px-2 py-1 rounded-lg w-fit uppercase tracking-widest">
                      <ShieldCheck size={10} /> {isKijo ? 'Siap ditarik' : 'Gunakan untuk joki'}
                    </div>
                  </div>
                </div>

                {isKijo && (
                  <div className="bg-bg-main border border-border-main rounded-xl p-3 md:p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">Saldo Tertahan</div>
                      <div className="text-sm md:text-lg font-bold text-text-main font-mono">Rp {data.user.balance_held?.toLocaleString() || '0'}</div>
                    </div>
                    <Clock size={14} className="text-text-muted" />
                  </div>
                )}
              </div>

              {isKijo && (
                <form onSubmit={handleWithdraw} className="space-y-3 pt-4 border-t border-border-main mt-auto">
                  <div className="space-y-1.5">
                    <label className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nominal Penarikan</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">Rp</span>
                      <input 
                        type="text" 
                        placeholder="Min. 20.000"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-3 pl-10 pr-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs font-bold shadow-inner"
                        value={withdrawAmount}
                        onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={withdrawStatus === 'loading'}
                    className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
                      withdrawStatus === 'success' ? 'bg-green-500 text-black' : 'bg-orange-primary text-black hover:scale-[1.02] shadow-orange-primary/20'
                    }`}
                  >
                    {withdrawStatus === 'loading' ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : withdrawStatus === 'success' ? (
                      <>
                        <CheckCircle2 size={14} />
                        BERHASIL
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={14} />
                        TARIK SALDO
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Stats & Game Selection Column */}
            <div className="space-y-6 flex flex-col">
              {/* Monthly Stats */}
              <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm flex-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <TrendingUp className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Statistik Bulan Ini</h3>
                </div>
                
                <div className="bg-bg-main border border-border-main rounded-xl md:rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-primary/10 rounded-xl flex items-center justify-center border border-orange-primary/20">
                    <Package className="text-orange-primary" size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">{isKijo ? 'Pesanan Selesai' : 'Total Belanja'}</div>
                    <div className="text-xl md:text-2xl font-bold text-text-main">{data.stats?.monthlyOrders || 0}</div>
                  </div>
                </div>
              </div>

              {/* Game Selection Box */}
              {(isKijo || applicationStatus?.status === 'pending') && (
                <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm flex-1">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Gamepad2 className="text-orange-primary" size={16} />
                    <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Pilihan Game Menjoki</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data?.activeGames && data.activeGames.length > 0 ? (
                      data.activeGames.map((game) => (
                        <div key={game} className="flex items-center gap-2 bg-bg-main border border-border-main px-4 py-2 rounded-xl text-xs font-bold text-text-main hover:border-orange-primary/50 transition-all cursor-pointer shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-orange-primary shadow-[0_0_8px_rgba(255,159,28,0.5)]" />
                          {game}
                        </div>
                      ))
                    ) : (data.user.verified_game || applicationStatus?.desired_game) ? (
                      <div className="flex items-center gap-2 bg-bg-main border border-orange-primary/30 px-4 py-2 rounded-xl text-xs font-bold text-text-main shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-orange-primary animate-pulse" />
                        {data.user.verified_game || applicationStatus?.desired_game} {isKijo ? '(Siap Dikonfigurasi)' : '(Menunggu Persetujuan)'}
                      </div>
                    ) : (
                      <p className="text-text-muted text-xs italic p-4 border border-dashed border-border-main rounded-xl w-full text-center">Belum ada game yang dikonfigurasi</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Motto Box (Kijo Only) */}
          {isKijo && (
            <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-6 shadow-sm">
              <div className="flex items-center gap-2 md:gap-3">
                <MessageSquare className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Motto Kijo</h3>
              </div>
              <div className="space-y-4">
                <textarea 
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="Tulis motto Anda di sini... (Contoh: Siap menggendong Anda sampai rank impian!)"
                  className="w-full bg-bg-main border border-border-main rounded-2xl p-4 text-xs md:text-sm font-medium text-text-main focus:outline-none focus:border-orange-primary transition-all min-h-[100px] resize-none"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveMotto}
                    disabled={isSavingMotto}
                    className="bg-orange-primary text-black font-bold px-8 py-3 rounded-xl text-xs uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {isSavingMotto ? 'Menyimpan...' : 'Simpan Motto'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Boosting Account Details (Kijo Only) */}
          {isKijo && (
            <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <Award className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Boosting Account Details</h3>
                </div>
                <button 
                  onClick={() => {
                    setEditingGame(null);
                    const verifiedGame = availableGames.find(g => g.name === (data.user.verified_game || 'Mobile Legends'));
                    setGameFormData({
                      game_name: data.user.verified_game || 'Mobile Legends',
                      nickname: '',
                      rank: '',
                      game_id: '',
                      server: '',
                      dynamic_data: {},
                      account_type: 'boosting'
                    });
                    setShowGameModal(true);
                  }}
                  className="bg-orange-primary/10 text-orange-primary border border-orange-primary/20 p-2 rounded-xl hover:bg-orange-primary/20 transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
                {(() => {
                  const boostingAccounts = data.gameAccounts.filter(a => a.account_type === 'boosting');
                  const hasRealBoostingAccount = boostingAccounts.some(acc => acc.nickname !== 'New Kijo');
                  const placeholder = boostingAccounts.find(acc => acc.nickname === 'New Kijo');
                  
                  if (!hasRealBoostingAccount) {
                    return (
                      <div className="col-span-1 md:col-span-2 bg-bg-main border border-border-main rounded-xl md:rounded-2xl p-6 md:p-10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center border border-orange-primary/20">
                            <Gamepad2 className="text-orange-primary" size={20} />
                          </div>
                          <div>
                            <h4 className="text-text-main font-bold text-sm md:text-lg uppercase tracking-tighter">Lengkapi <span className="text-orange-primary">Data Akun Boosting.</span></h4>
                            <p className="text-text-muted text-[11px] md:text-xs font-bold uppercase tracking-widest">Game: {data.user.verified_game || 'Mobile Legends'}</p>
                          </div>
                        </div>
                        
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const finalData = {
                            ...gameFormData,
                            game_name: data.user.verified_game || 'Mobile Legends',
                            account_type: 'boosting',
                            id: placeholder?.id
                          };
                          handleSaveGameAccount(e, finalData);
                        }} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {(() => {
                              const selectedGame = availableGames.find(g => g.name === (data.user.verified_game || 'Mobile Legends'));
                              const schema = selectedGame?.schema || [];
                              const gameRanks = selectedGame?.ranks || [];
                              
                              if (schema.length > 0) {
                                return schema.map((field: any, index: number) => (
                                  <div key={index} className="space-y-1.5">
                                    <label className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest ml-1">{field.name}</label>
                                    {field.name.toLowerCase().includes('rank') ? (
                                      <div className="relative">
                                        <select
                                          required
                                          className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs md:text-sm font-bold appearance-none"
                                          value={(gameFormData.dynamic_data && gameFormData.dynamic_data[field.name]) || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const lowerName = field.name.toLowerCase();
                                            let extraFields: any = {};
                                            if (lowerName.includes('rank')) extraFields.rank = val;
                                            if (lowerName.includes('nickname')) extraFields.nickname = val;
                                            if (lowerName.includes('id game') || lowerName.includes('game id') || lowerName === 'id') extraFields.game_id = val;
                                            if (lowerName.includes('server')) extraFields.server = val;
                                            if (lowerName.includes('hashtag')) {
                                              // If it's a hashtag, we might want to append it to game_id or just keep it in dynamic_data
                                              // For now, let's ensure game_id is set if it's the only ID field
                                              if (!gameFormData.game_id) extraFields.game_id = val;
                                            }

                                            setGameFormData((prev: any) => ({
                                              ...prev,
                                              ...extraFields,
                                              dynamic_data: {
                                                ...(prev.dynamic_data || {}),
                                                [field.name]: val
                                              }
                                            }));
                                          }}
                                        >
                                          <option value="">{field.placeholder || 'Pilih Rank'}</option>
                                          {gameRanks.map((r: any) => (
                                            <option key={typeof r === 'string' ? r : r.title} value={typeof r === 'string' ? r : r.title}>
                                              {typeof r === 'string' ? r : r.title}
                                            </option>
                                          ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
                                      </div>
                                    ) : (
                                      <input 
                                        type={field.type === 'number' ? 'number' : 'text'}
                                        required
                                        placeholder={field.placeholder}
                                        className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs md:text-sm font-bold"
                                        value={(gameFormData.dynamic_data && gameFormData.dynamic_data[field.name]) || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const lowerName = field.name.toLowerCase();
                                          let extraFields: any = {};
                                          if (lowerName.includes('rank')) extraFields.rank = val;
                                          if (lowerName.includes('nickname')) extraFields.nickname = val;
                                          if (lowerName.includes('id game') || lowerName.includes('game id') || lowerName === 'id') extraFields.game_id = val;
                                          if (lowerName.includes('server')) extraFields.server = val;
                                          if (lowerName.includes('hashtag')) {
                                            if (!gameFormData.game_id) extraFields.game_id = val;
                                          }

                                          setGameFormData((prev: any) => ({
                                            ...prev,
                                            ...extraFields,
                                            dynamic_data: {
                                              ...(prev.dynamic_data || {}),
                                              [field.name]: val
                                            }
                                          }));
                                        }}
                                      />
                                    )}
                                  </div>
                                ));
                              }
                              
                              // Fallback if no schema found
                              return (
                                <>
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nickname</label>
                                    <input 
                                      type="text" 
                                      required
                                      placeholder="Contoh: ProPlayer99"
                                      className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs md:text-sm font-bold"
                                      value={gameFormData.nickname}
                                      onChange={(e) => setGameFormData({...gameFormData, nickname: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest ml-1">ID Game</label>
                                    <input 
                                      type="text" 
                                      required
                                      placeholder="Contoh: 12345678"
                                      className="w-full bg-bg-sidebar border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs md:text-sm font-bold"
                                      value={gameFormData.game_id}
                                      onChange={(e) => setGameFormData({...gameFormData, game_id: e.target.value})}
                                    />
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <button 
                            type="submit"
                            className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.01] transition-all text-xs md:text-xs uppercase tracking-widest"
                          >
                            Simpan Detail Akun Boosting
                          </button>
                        </form>
                      </div>
                    );
                  }

                  return boostingAccounts.filter(acc => acc.nickname !== 'New Kijo').map((acc) => (
                    <div 
                      key={acc.id} 
                      onClick={() => openEditGame(acc)}
                      className="bg-bg-main border border-border-main rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden group hover:border-orange-primary/30 transition-all shadow-sm cursor-pointer"
                    >
                      <div className="absolute top-0 right-0 p-3 md:p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                        <Award size={40} />
                      </div>
                      <div className="relative z-10 space-y-3 md:space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 md:gap-4">
                            <div className="w-8 h-8 md:w-14 md:h-14 bg-orange-primary/10 rounded-lg md:rounded-2xl flex items-center justify-center border border-orange-primary/20 shadow-sm">
                              <img src={`https://picsum.photos/seed/${acc.game_name}/60/60`} className="w-6 h-6 md:w-10 md:h-10 rounded-md md:rounded-lg" alt="Game" />
                            </div>
                            <div>
                              <h4 className="text-text-main font-bold text-xs md:text-lg leading-tight">{acc.game_name}</h4>
                              <p className="text-orange-primary text-[11px] md:text-xs font-semibold uppercase tracking-wide mt-0.5 md:mb-1">
                                {acc.rank || (() => {
                                  try {
                                    const dynamic = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                                    return dynamic['Highest Rank'] || dynamic['Rank'] || '-';
                                  } catch (e) { return '-'; }
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGameAccount(acc.id);
                              }}
                              className="p-1 md:p-2 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:gap-6 pt-3 md:pt-6 border-t border-border-main">
                          {acc.dynamic_data ? (
                            Object.entries(JSON.parse(acc.dynamic_data)).slice(0, 4).map(([key, val]: [string, any]) => (
                              <div key={key}>
                                <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">{key}</div>
                                <div className="text-xs md:text-sm font-bold text-text-main truncate">{val}</div>
                              </div>
                            ))
                          ) : (
                            <>
                              <div>
                                <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Nickname</div>
                                <div className="text-xs md:text-sm font-bold text-text-main truncate">{acc.nickname}</div>
                              </div>
                              <div>
                                <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">ID (Server)</div>
                                <div className="text-xs md:text-sm font-bold text-text-main truncate">{acc.game_id} <span className="text-text-muted">({acc.server})</span></div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* Games Account Details (Personal - For Everyone) */}
          <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Gamepad2 className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Games account details</h3>
              </div>
              <button 
                onClick={() => {
                  setEditingGame(null);
                  setGameFormData({
                    game_name: 'Mobile Legends',
                    nickname: '',
                    game_id: '',
                    rank: '',
                    server: '',
                    dynamic_data: {},
                    account_type: 'personal'
                  });
                  setShowGameModal(true);
                }}
                className="flex items-center gap-2 bg-orange-primary/10 text-orange-primary px-4 py-2 rounded-xl border border-orange-primary/20 hover:bg-orange-primary hover:text-black transition-all group"
              >
                <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wide">Tambah Akun</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
              {data.gameAccounts.filter(a => a.account_type === 'personal').length === 0 ? (
                <div className="col-span-1 md:col-span-2 py-8 md:py-16 text-center border border-dashed border-border-main rounded-xl md:rounded-2xl shadow-inner bg-bg-main/30">
                  <div className="w-10 h-10 md:w-16 md:h-16 bg-bg-main rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4 border border-border-main">
                    <Gamepad2 size={20} className="text-text-muted opacity-30" />
                  </div>
                  <p className="text-text-muted text-xs md:text-sm font-medium">Belum ada akun game personal yang terdaftar.</p>
                </div>
              ) : (
                data.gameAccounts.filter(a => a.account_type === 'personal').map((acc) => (
                  <div 
                    key={acc.id} 
                    onClick={() => openEditGame(acc)}
                    className="bg-bg-main border border-border-main rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden group hover:border-orange-primary/30 transition-all shadow-sm cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 p-3 md:p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                      <Gamepad2 size={40} />
                    </div>
                    <div className="relative z-10 space-y-3 md:space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="w-8 h-8 md:w-14 md:h-14 bg-orange-primary/10 rounded-lg md:rounded-2xl flex items-center justify-center border border-orange-primary/20 shadow-sm">
                            <img src={`https://picsum.photos/seed/${acc.game_name}/60/60`} className="w-6 h-6 md:w-10 md:h-10 rounded-md md:rounded-lg" alt="Game" />
                          </div>
                          <div>
                            <h4 className="text-text-main font-bold text-xs md:text-lg leading-tight">{acc.game_name}</h4>
                            <p className="text-orange-primary text-[11px] md:text-xs font-semibold uppercase tracking-wide mt-0.5 md:mb-1">{acc.rank || (acc.dynamic_data ? JSON.parse(acc.dynamic_data)['Highest Rank'] : '')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGameAccount(acc.id);
                            }}
                            className="p-1 md:p-2 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:gap-6 pt-3 md:pt-6 border-t border-border-main">
                        {acc.dynamic_data ? (
                          Object.entries(JSON.parse(acc.dynamic_data)).slice(0, 4).map(([key, val]: [string, any]) => (
                            <div key={key}>
                              <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">{key}</div>
                              <div className="text-xs md:text-sm font-bold text-text-main truncate">{val}</div>
                            </div>
                          ))
                        ) : (
                          <>
                            <div>
                              <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Nickname</div>
                              <div className="text-xs md:text-sm font-bold text-text-main truncate">{acc.nickname}</div>
                            </div>
                            <div>
                              <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">ID (Server)</div>
                              <div className="text-xs md:text-sm font-bold text-text-main truncate">{acc.game_id} <span className="text-text-muted">({acc.server})</span></div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
            <div className="flex items-center gap-2 md:gap-3">
              <User className="text-orange-primary" size={16} />
              <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Detail Akun & Privasi</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
              <div className="space-y-4 md:space-y-8">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-bg-main border border-border-main rounded-lg md:rounded-2xl flex items-center justify-center text-text-muted shadow-sm">
                    <User size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Username</div>
                    <div className="text-xs md:text-base font-bold text-text-main">@{data.user.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-bg-main border border-border-main rounded-lg md:rounded-2xl flex items-center justify-center text-text-muted shadow-sm">
                    <Mail size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Email Terdaftar</div>
                    <div className="text-xs md:text-base font-bold text-text-main truncate max-w-[150px] sm:max-w-none">{data.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-bg-main border border-border-main rounded-lg md:rounded-2xl flex items-center justify-center text-text-muted shadow-sm">
                    <Phone size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">No. Telepon</div>
                    <div className="text-xs md:text-base font-bold text-text-main">{data.user.phone}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-8">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-bg-main border border-border-main rounded-lg md:rounded-2xl flex items-center justify-center text-text-muted shadow-sm">
                    <Calendar size={14} />
                  </div>
                  <div>
                    <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Tanggal Lahir</div>
                    <div className="text-xs md:text-base font-bold text-text-main">{data.user.birth_date || '-'}</div>
                  </div>
                </div>
                {isKijo && (
                  <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-bg-main border border-border-main rounded-lg md:rounded-2xl flex items-center justify-center text-text-muted shadow-sm">
                      <Clock size={14} />
                    </div>
                    <div>
                      <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Jam Operasional</div>
                      <div className="text-xs md:text-base font-bold text-text-main">{data.user.work_start} - {data.user.work_end}</div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setShowResetPassword(true)}
                  className="w-full flex items-center justify-between p-3 md:p-5 bg-orange-primary/5 border border-orange-primary/10 rounded-xl md:rounded-[24px] group hover:bg-orange-primary/10 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-7 h-7 md:w-10 md:h-10 bg-orange-primary/10 rounded-lg md:rounded-xl flex items-center justify-center text-orange-primary">
                      <KeyRound size={14} />
                    </div>
                    <span className="text-[11px] sm:text-xs md:text-xs font-bold text-text-main uppercase tracking-widest">Ganti Password</span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform md:w-[18px] md:h-[18px]" />
                </button>

                <button 
                  onClick={() => setShowChangePhone(true)}
                  className="w-full flex items-center justify-between p-3 md:p-5 bg-orange-primary/5 border border-orange-primary/10 rounded-xl md:rounded-[24px] group hover:bg-orange-primary/10 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-7 h-7 md:w-10 md:h-10 bg-orange-primary/10 rounded-lg md:rounded-xl flex items-center justify-center text-orange-primary">
                      <Phone size={14} />
                    </div>
                    <span className="text-[11px] sm:text-xs md:text-xs font-bold text-text-main uppercase tracking-widest">Ganti Nomor Telpon</span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform md:w-[18px] md:h-[18px]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Ratings & Testimonials (4/12) */}
        {isKijo && (
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-10">
            <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm flex flex-col sticky top-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <Star className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Rating & Testimoni</h3>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={10} className={i < Math.round(parseFloat(averageRating)) ? 'text-orange-primary fill-orange-primary' : 'text-text-muted/20'} />
                  ))}
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[300px] no-scrollbar flex-1">
                {data.ratings.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center border border-dashed border-border-main rounded-2xl bg-bg-main/30">
                    <p className="text-text-muted text-xs font-medium italic">Belum ada testimoni.</p>
                  </div>
                ) : (
                  data.ratings.map((rating) => (
                    <div key={rating.id} className="bg-bg-main border border-border-main rounded-xl p-3 space-y-2 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-bg-sidebar rounded-full flex items-center justify-center text-text-muted border border-border-main">
                            <User size={12} />
                          </div>
                          <h5 className="text-text-main font-bold text-xs">{isKijo ? `Jokies #${rating.jokies_id}` : `Kijo #${rating.user_id}`}</h5>
                        </div>
                        <span className="text-[11px] text-text-muted font-semibold uppercase tracking-wide">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-text-muted text-xs leading-relaxed italic">"{rating.comment || 'Tidak ada komentar.'}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
              <button 
                onClick={() => window.location.href = 'mailto:admin@acinonyx.com'}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-orange-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-primary/10 rounded-lg md:rounded-xl flex items-center justify-center text-orange-primary border border-orange-primary/20 shadow-sm">
                    <Mail size={14} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Email Admin</h4>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <button 
                onClick={onLogout}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-red-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-red-500 border border-red-500/20 shadow-sm">
                    <LogOut size={14} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Keluar Akun</h4>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {!isKijo && (
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-10">
            {/* Action Buttons for Jokies */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
              <button 
                onClick={() => window.location.href = 'mailto:admin@acinonyx.com'}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-orange-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-primary/10 rounded-lg md:rounded-xl flex items-center justify-center text-orange-primary border border-orange-primary/20 shadow-sm">
                    <Mail size={14} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Email Admin</h4>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <button 
                onClick={onLogout}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-red-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-red-500 border border-red-500/20 shadow-sm">
                    <LogOut size={14} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Keluar Akun</h4>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Reset Password Modal */}
      <AnimatePresence>
        {showResetPassword && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetPassword(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-text-main mb-6 uppercase tracking-tighter">Ganti <span className="text-orange-primary">Password.</span></h3>
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Password Lama</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Password Baru</label>
                  <input 
                    type="password" 
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowResetPassword(false)}
                    className="flex-1 bg-bg-main text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-bg-card transition-all text-xs uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
                  >
                    Update
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Phone Modal */}
      <AnimatePresence>
        {showChangePhone && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowChangePhone(false);
                setOtpSent(false);
                setNewPhone('');
                setOtpValues(['', '', '', '', '', '']);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl md:text-2xl font-bold text-text-main mb-6 uppercase tracking-tighter">Ganti <span className="text-orange-primary">Nomor Telpon.</span></h3>
              <form onSubmit={handleUpdatePhone} className="space-y-6">
                {!otpSent ? (
                  <div className="space-y-6">
                    <div className="bg-orange-primary/5 border border-orange-primary/20 p-4 rounded-xl">
                      <p className="text-xs font-bold text-orange-primary uppercase tracking-widest leading-relaxed">
                        Fitur ini memerlukan verifikasi 2-langkah. Kami akan mengirimkan kode OTP ke email bisnis Anda: <span className="text-text-main underline">{user.email}</span>
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleSendOtp}
                      className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
                    >
                      KIRIM KODE VERIFIKASI
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1 text-center block">Kode OTP (Email)</label>
                      <div className="flex justify-between gap-2">
                        {otpValues.map((val, i) => (
                          <input
                            key={i}
                            ref={otpRefs[i]}
                            type="text"
                            maxLength={1}
                            value={val}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            className="w-10 h-12 md:w-12 md:h-14 bg-bg-main border border-border-main rounded-xl text-center text-lg font-bold text-orange-primary focus:outline-none focus:border-orange-primary transition-all shadow-inner"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nomor Telepon Baru</label>
                      <input 
                        type="tel" 
                        required
                        placeholder="08123456789"
                        className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isVerifyingOtp}
                      className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      {isVerifyingOtp ? 'MEMPROSES...' : 'UPDATE NOMOR TELEPON'}
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowChangePhone(false);
                      setOtpSent(false);
                      setNewPhone('');
                      setOtpValues(['', '', '', '', '', '']);
                    }}
                    className="flex-1 bg-bg-main text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-bg-card transition-all text-xs uppercase tracking-widest"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Game Account Modal */}
      <AnimatePresence>
        {showGameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGameModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl md:text-2xl font-bold text-text-main mb-8 uppercase tracking-tighter">
                {editingGame ? 'Edit' : 'Tambah'} <span className="text-orange-primary">Akun Game.</span>
              </h3>
              
              <form onSubmit={handleSaveGameAccount} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Tipe Akun</label>
                    <div className="w-full bg-bg-main border border-border-main rounded-xl py-4 px-5 text-text-main font-bold uppercase tracking-widest text-xs">
                      {gameFormData.account_type === 'boosting' ? 'Boosting' : 'Personal'}
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Game</label>
                    <select 
                      disabled={!!editingGame || gameFormData.account_type === 'boosting'}
                      className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold appearance-none disabled:opacity-50"
                      value={gameFormData.game_name}
                      onChange={(e) => {
                        const game = availableGames.find(g => g.name === e.target.value);
                        setGameFormData({
                          ...gameFormData, 
                          game_name: e.target.value,
                          dynamic_data: {}, // Reset dynamic data when game changes
                          rank: '',
                          nickname: '',
                          game_id: '',
                          server: ''
                        });
                      }}
                    >
                      {gameFormData.account_type === 'boosting' ? (
                        <option value={data.user.verified_game || 'Mobile Legends'}>{data.user.verified_game || 'Mobile Legends'}</option>
                      ) : (
                        availableGames.map(game => (
                          <option key={game.name} value={game.name}>{game.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Dynamic Fields */}
                  {(() => {
                    const selectedGame = availableGames.find(g => g.name === (gameFormData.account_type === 'boosting' ? (data.user.verified_game || 'Mobile Legends') : gameFormData.game_name));
                    const schema = selectedGame?.schema || [];
                    const gameRanks = selectedGame?.ranks || [];
                    
                    return schema.map((field: any, index: number) => (
                      <div key={index} className="space-y-2 col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">
                          {typeof field.name === 'string' ? field.name : 'Field'}
                        </label>
                        {(field.type === 'rank' || field.name === 'Highest Rank') ? (
                          <div className="relative">
                            <select
                              required
                              className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold appearance-none"
                              value={(gameFormData.dynamic_data && gameFormData.dynamic_data[field.name]) || ''}
                              onChange={(e) => setGameFormData({
                                ...gameFormData,
                                dynamic_data: {
                                  ...(gameFormData.dynamic_data || {}),
                                  [field.name]: e.target.value
                                },
                                rank: e.target.value
                              })}
                            >
                              <option value="">{field.placeholder || 'Pilih Rank'}</option>
                              {gameRanks.length > 0 ? (
                                gameRanks.map((r: any, i: number) => (
                                  <optgroup key={i} label={r.title}>
                                    {r.tiers.map((tier: string, j: number) => (
                                      <option key={`${i}-${j}`} value={`${r.title} - ${tier}`}>
                                        {tier}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))
                              ) : (
                                <option disabled>Belum ada rank yang diatur oleh Admin</option>
                              )}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                          </div>
                        ) : (
                          <input 
                            type={field.type === 'number' ? 'number' : 'text'}
                            required
                            placeholder={typeof field.placeholder === 'string' ? field.placeholder : ''}
                            className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                            value={(gameFormData.dynamic_data && gameFormData.dynamic_data[field.name]) || ''}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setGameFormData({
                                ...gameFormData,
                                dynamic_data: {
                                  ...(gameFormData.dynamic_data || {}),
                                  [field.name]: newValue
                                },
                                nickname: field.name === 'Nickname' || field.name === 'ID' ? newValue : gameFormData.nickname,
                                game_id: field.name === 'ID Game' || field.name === 'Hashtag' || field.name === 'ID' ? newValue : gameFormData.game_id,
                                server: field.name === 'Server ID' ? newValue : gameFormData.server
                              });
                            }}
                          />
                        )}
                      </div>
                    ));
                  })()}

                  {/* Fallback for legacy data or if no schema exists */}
                  {(!availableGames.find(g => g.name === (gameFormData.account_type === 'boosting' ? (data.user.verified_game || 'Mobile Legends') : gameFormData.game_name))?.schema?.length) && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nickname</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Contoh: ProPlayer99"
                          className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                          value={gameFormData.nickname}
                          onChange={(e) => setGameFormData({...gameFormData, nickname: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Highest Rank</label>
                        <div className="relative">
                          <select
                            required
                            className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold appearance-none"
                            value={gameFormData.rank}
                            onChange={(e) => setGameFormData({...gameFormData, rank: e.target.value})}
                          >
                            <option value="">Pilih Rank</option>
                            {(() => {
                              const selectedGame = availableGames.find(g => g.name === gameFormData.game_name);
                              if (selectedGame?.ranks?.length) {
                                return selectedGame.ranks.map((r: any, i: number) => (
                                  <optgroup key={i} label={r.title}>
                                    {r.tiers.map((tier: string, j: number) => (
                                      <option key={`${i}-${j}`} value={`${r.title} - ${tier}`}>
                                        {tier}
                                      </option>
                                    ))}
                                  </optgroup>
                                ));
                              }
                              return <option disabled>Belum ada rank yang diatur oleh Admin</option>;
                            })()}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">ID Game</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Contoh: 12345678"
                          className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                          value={gameFormData.game_id}
                          onChange={(e) => setGameFormData({...gameFormData, game_id: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Server</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Contoh: Asia (1234)"
                          className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-5 text-text-main focus:outline-none focus:border-orange-primary transition-all text-sm font-bold"
                          value={gameFormData.server}
                          onChange={(e) => setGameFormData({...gameFormData, server: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowGameModal(false)}
                    className="flex-1 bg-bg-main text-text-main font-bold py-5 rounded-2xl border border-border-main hover:bg-bg-card transition-all text-xs uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-5 rounded-2xl shadow-xl hover:scale-[1.02] transition-all text-xs uppercase tracking-widest shadow-orange-primary/20"
                  >
                    Simpan Akun
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
