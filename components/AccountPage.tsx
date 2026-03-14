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
  ChevronDown,
  Camera,
  Link,
  Bell,
  Activity,
  Send,
  X,
  Banknote
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { useAlert } from './AlertContext';

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
  loginHistory: any[];
  savedPaymentMethods: any[];
  stats: {
    monthlyOrders: number;
    totalBooked: number;
  };
}

export default function AccountPage({ user, onLogout, onStartVerification, setView }: AccountPageProps) {
  const { showAlert } = useAlert();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [newPhone, setNewPhone] = useState('');
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

  // Feature 1: Avatar Upload
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Feature 2: Social Links
  const [socialLinks, setSocialLinks] = useState<{ discord: string; steam: string; battlenet: string }>({ discord: '', steam: '', battlenet: '' });
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Feature 3: Notification Preferences
  const [notifPrefs, setNotifPrefs] = useState<{ new_order: boolean; order_completed: boolean; withdrawal_update: boolean; system_announcement: boolean }>({ new_order: true, order_completed: true, withdrawal_update: true, system_announcement: true });
  const [isSavingNotif, setIsSavingNotif] = useState(false);

  // Feature 5: Rating Reply
  const [replyingRatingId, setReplyingRatingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Feature 7: Withdrawal Methods
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<{ method_type: string; account_name: string; account_number: string; is_default: boolean }>({ method_type: 'e-Wallet', account_name: '', account_number: '', is_default: false });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);

  const isKijo = data?.user.role === 'kijo' || user.role === 'kijo';

  const fetchData = async () => {
    setFetchError(false);
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
          setGameFormData((prev: any) => ({
            ...prev,
            game_name: accountData.user.verified_game
          }));
        }
      } else {
        setFetchError(true);
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
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  // Parse social links and notification preferences when data changes
  useEffect(() => {
    if (data?.user) {
      try {
        const links = data.user.social_links ? JSON.parse(data.user.social_links) : {};
        setSocialLinks({ discord: links.discord || '', steam: links.steam || '', battlenet: links.battlenet || '' });
      } catch (e) {
        setSocialLinks({ discord: '', steam: '', battlenet: '' });
      }
      try {
        const prefs = data.user.notification_preferences ? JSON.parse(data.user.notification_preferences) : {};
        setNotifPrefs({
          new_order: prefs.new_order !== false,
          order_completed: prefs.order_completed !== false,
          withdrawal_update: prefs.withdrawal_update !== false,
          system_announcement: prefs.system_announcement !== false,
        });
      } catch (e) {
        setNotifPrefs({ new_order: true, order_completed: true, withdrawal_update: true, system_announcement: true });
      }
    }
  }, [data]);

  const handleSendOtp = async () => {
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/update-phone-2sv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setOtpSent(true);
        showAlert('OTP verifikasi telah dikirim ke email bisnis Anda', 'success');
      } else {
        const data = await res.json();
        showAlert(data.message || 'Gagal mengirim OTP', 'error');
      }
    } catch (error) {
      showAlert('Kesalahan server saat mengirim OTP', 'error');
    }
  };

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length < 6) {
      showAlert('Masukkan 6 digit kode OTP', 'warning');
      return;
    }
    if (!newPhone || newPhone.length < 10) {
      showAlert('Nomor telepon baru tidak valid', 'warning');
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
        showAlert('Data berhasil diperbarui, silakan login kembali dengan kredensial baru Anda.', 'success');
        onLogout();
      } else {
        const data = await res.json();
        showAlert(data.message || 'Verifikasi gagal', 'error');
      }
    } catch (error) {
      showAlert('Kesalahan server saat memperbarui nomor telepon', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue.length > 1) {
      // Handle paste
      const pastedData = numericValue.slice(0, 6).split('');
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
    newValues[index] = numericValue;
    setOtpValues(newValues);

    if (numericValue && index < 5) {
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
    const numAmount = parseInt(withdrawAmount, 10);
    if (!withdrawAmount || numAmount < 20000) {
      showAlert('Minimal penarikan Rp 20.000', 'warning');
      return;
    }
    const availableBalance = data?.user.balance_active || 0;
    if (numAmount > availableBalance) {
      showAlert('Saldo tidak mencukupi', 'warning');
      return;
    }

    setWithdrawStatus('loading');
    try {
      const res = await fetchWithAuth('/api/kijo/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: numAmount,
          destination: selectedPaymentMethod
            ? `${selectedPaymentMethod.method_type}: ${selectedPaymentMethod.account_name} - ${selectedPaymentMethod.account_number}`
            : (data?.user.phone || data?.user.email)
        })
      });
      if (res.ok) {
        setWithdrawStatus('success');
        setWithdrawAmount('');
        fetchData();
        setTimeout(() => setWithdrawStatus('idle'), 3000);
      } else {
        setWithdrawStatus('error');
        setTimeout(() => setWithdrawStatus('idle'), 3000);
      }
    } catch (error) {
      setWithdrawStatus('error');
      setTimeout(() => setWithdrawStatus('idle'), 3000);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (newPassword.length < 8) {
      showAlert('Password minimal 8 karakter', 'warning');
      return;
    }
    if (emojiRegex.test(newPassword)) {
      showAlert('Password tidak boleh mengandung emoji', 'warning');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      if (res.ok) {
        showAlert('Data berhasil diperbarui, silakan login kembali dengan kredensial baru Anda.', 'success');
        onLogout();
      } else {
        const errData = await res.json();
        showAlert(errData.message || 'Gagal mereset password', 'error');
      }
    } catch (error) {
      showAlert('Gagal mereset password', 'error');
    } finally {
      setResetPasswordLoading(false);
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

      const res = await fetchWithAuth('/api/kijo/game-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showAlert(editingGame ? 'Akun game diperbarui' : 'Akun game ditambahkan', 'success');
        setShowGameModal(false);
        setEditingGame(null);
        fetchData();
        
        // Reset form data
        setGameFormData({
          game_name: data?.user?.verified_game || 'Mobile Legends',
          nickname: '',
          game_id: '',
          rank: '',
          server: '',
          dynamic_data: {},
          account_type: 'personal'
        });
      } else {
        const errorData = await res.json();
        showAlert(`Gagal menyimpan akun game: ${errorData.message || 'Terjadi kesalahan server'}`, 'error');
      }
    } catch (error) {
      console.error('[AccountPage] Save Game Account Error:', error);
      showAlert('Gagal menyimpan akun game. Silakan periksa koneksi Anda.', 'error');
    }
  };

  const handleSaveMotto = async () => {
    if (motto.length > 500) {
      showAlert('Motto maksimal 500 karakter', 'warning');
      return;
    }
    setIsSavingMotto(true);
    try {
      const res = await fetchWithAuth('/api/kijo/update-motto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, motto })
      });
      if (res.ok) {
        showAlert('Motto berhasil diperbarui', 'success');
        try {
          window.dispatchEvent(new CustomEvent('refreshStats'));
        } catch (e) {
          console.warn('Failed to dispatch refreshStats event:', e);
        }
      } else {
        showAlert('Gagal memperbarui motto', 'error');
      }
    } catch (error) {
      showAlert('Gagal memperbarui motto', 'error');
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
    let parsedDynamicData = {};
    try {
      parsedDynamicData = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
    } catch (e) {
      parsedDynamicData = {};
    }
    setGameFormData({
      game_name: acc.game_name,
      nickname: acc.nickname,
      game_id: acc.game_id,
      rank: acc.rank,
      server: acc.server,
      dynamic_data: parsedDynamicData,
      account_type: acc.account_type || 'personal'
    });
    setShowGameModal(true);
  };

  const handleDeleteGameAccount = async (id: number) => {
    if (!confirm('Hapus akun game ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/kijo/game-accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Akun game dihapus. Etalase yang terkait otomatis disembunyikan.', 'success');
        fetchData();
      } else {
        const data = await res.json();
        showAlert(data.message || 'Gagal menghapus akun game', 'error');
      }
    } catch (error) {
      showAlert('Gagal menghapus akun game', 'error');
    }
  };

  // Feature 1: Avatar Upload Handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetchWithAuth(`/api/users/${user.id}/avatar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url: base64 })
          });
          if (res.ok) {
            fetchData();
          } else {
            showAlert('Gagal mengupload avatar', 'error');
          }
        } catch (error) {
          showAlert('Gagal mengupload avatar', 'error');
        } finally {
          setIsUploadingAvatar(false);
        }
      };
      reader.onerror = () => {
        showAlert('Gagal membaca file', 'error');
        setIsUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      showAlert('Gagal mengupload avatar', 'error');
      setIsUploadingAvatar(false);
    }
  };

  // Feature 2: Social Links Handler
  const handleSaveSocialLinks = async () => {
    setIsSavingSocial(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/social-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_links: socialLinks })
      });
      if (res.ok) {
        showAlert('Linked accounts berhasil diperbarui', 'success');
        fetchData();
      } else {
        showAlert('Gagal menyimpan linked accounts', 'error');
      }
    } catch (error) {
      showAlert('Gagal menyimpan linked accounts', 'error');
    } finally {
      setIsSavingSocial(false);
    }
  };

  // Feature 3: Notification Preferences Handler
  const handleSaveNotifPrefs = async () => {
    setIsSavingNotif(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/notification-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: notifPrefs })
      });
      if (res.ok) {
        showAlert('Preferensi notifikasi berhasil diperbarui', 'success');
      } else {
        showAlert('Gagal menyimpan preferensi notifikasi', 'error');
      }
    } catch (error) {
      showAlert('Gagal menyimpan preferensi notifikasi', 'error');
    } finally {
      setIsSavingNotif(false);
    }
  };

  // Feature 5: Rating Reply Handler
  const handleSendReply = async (ratingId: number) => {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await fetchWithAuth(`/api/kijo/ratings/${ratingId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText })
      });
      if (res.ok) {
        setReplyingRatingId(null);
        setReplyText('');
        fetchData();
      } else {
        showAlert('Gagal mengirim balasan', 'error');
      }
    } catch (error) {
      showAlert('Gagal mengirim balasan', 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Feature 7: Payment Method Handlers
  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentFormData)
      });
      if (res.ok) {
        showAlert('Metode penarikan berhasil ditambahkan', 'success');
        setShowPaymentModal(false);
        setPaymentFormData({ method_type: 'e-Wallet', account_name: '', account_number: '', is_default: false });
        fetchData();
      } else {
        showAlert('Gagal menambahkan metode penarikan', 'error');
      }
    } catch (error) {
      showAlert('Gagal menambahkan metode penarikan', 'error');
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    if (!confirm('Hapus metode penarikan ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/payment-methods/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        showAlert('Gagal menghapus metode penarikan', 'error');
      }
    } catch (error) {
      showAlert('Gagal menghapus metode penarikan', 'error');
    }
  };

  // Helper: mask IP address
  const maskIp = (ip: string) => {
    if (!ip) return '-';
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
    return ip;
  };

  // Helper: abbreviate user agent
  const abbreviateUA = (ua: string) => {
    if (!ua) return '-';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera')) return 'Opera';
    return ua.length > 20 ? ua.substring(0, 20) + '...' : ua;
  };

  // Helper: mask account number
  const maskAccountNumber = (num: string) => {
    if (!num || num.length < 4) return num || '-';
    return '****' + num.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Sinkronisasi Akun...</p>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-sm font-bold text-text-muted">Gagal memuat data akun</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="px-4 py-2 bg-orange-primary text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors uppercase tracking-widest"
        >
          Coba Lagi
        </button>
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
                    src={data?.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-bg-sidebar shadow-lg" />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -top-1 -right-1 w-7 h-7 bg-orange-primary rounded-full flex items-center justify-center text-black hover:scale-110 transition-all shadow-lg border-2 border-bg-sidebar"
              >
                {isUploadingAvatar ? (
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={12} />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div>
                  <h2 className="text-2xl md:text-4xl font-bold text-text-main tracking-tighter">{data.user.username}</h2>
                  <p className="text-sm font-bold text-text-muted">{user.full_name}</p>
                </div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="bg-orange-primary/10 text-orange-primary text-xs font-bold px-3 py-1 rounded-full border border-orange-primary/20 uppercase tracking-widest">
                    {user.role}
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
            {isKijo && data.user.verified_game && (
              <div className="bg-bg-main/50 backdrop-blur-sm border border-border-main rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary">
                  <Gamepad2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Game Terverifikasi</p>
                  <p className="text-sm font-bold text-text-main">{data.user.verified_game}</p>
                </div>
                <ShieldCheck size={16} className="text-green-500 ml-auto" />
              </div>
            )}
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

      {/* Riwayat Transaksi & Rating side by side */}
      <div className={`grid ${isKijo ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6 md:gap-8 items-stretch`}>
        {/* Riwayat Transaksi */}
        <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm flex flex-col">
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
                        <div className="text-sm font-bold text-red-500 font-mono">- Rp {(w.amount ?? 0).toLocaleString()}</div>
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
                          {t.type === 'income' ? '+' : '-'} Rp {(t.amount ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Selesai</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        {/* Rating & Testimoni (same row, same height) */}
        {isKijo && (
          <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Star className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Rating & Testimoni</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-main">{averageRating}</span>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => {
                    const rating = parseFloat(averageRating);
                    const filled = rating >= i + 1;
                    const halfFilled = !filled && rating >= i + 0.5;
                    return (
                      <div key={i} className="relative" style={{ width: 10, height: 10 }}>
                        <Star size={10} className="text-text-muted/20 absolute inset-0" />
                        {filled && <Star size={10} className="text-orange-primary fill-orange-primary absolute inset-0" />}
                        {halfFilled && (
                          <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                            <Star size={10} className="text-orange-primary fill-orange-primary" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[10px] text-text-muted">({data.ratings.length})</span>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[400px] no-scrollbar flex-1">
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
                    {rating.reply ? (
                      <div className="bg-bg-sidebar border border-border-main rounded-lg p-2.5 mt-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare size={10} className="text-orange-primary" />
                          <span className="text-[10px] font-bold text-orange-primary uppercase tracking-widest">Balasan Anda</span>
                          {rating.reply_at && (
                            <span className="text-[10px] text-text-muted font-bold ml-auto">{new Date(rating.reply_at).toLocaleDateString()}</span>
                          )}
                        </div>
                        <p className="text-text-muted text-xs leading-relaxed">"{rating.reply}"</p>
                      </div>
                    ) : isKijo && (
                      replyingRatingId === rating.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Tulis balasan..." className="flex-1 bg-bg-sidebar border border-border-main rounded-lg py-1.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all" />
                          <button onClick={() => handleSendReply(rating.id)} disabled={isSendingReply} className="p-1.5 bg-orange-primary rounded-lg text-black hover:scale-105 transition-all disabled:opacity-50">
                            {isSendingReply ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Send size={12} />}
                          </button>
                          <button onClick={() => { setReplyingRatingId(null); setReplyText(''); }} className="p-1.5 bg-bg-sidebar border border-border-main rounded-lg text-text-muted hover:text-red-500 transition-all">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setReplyingRatingId(rating.id); setReplyText(''); }} className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline flex items-center gap-1 mt-1">
                          <MessageSquare size={10} /> Balas
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* Left Column: Wallet, Stats, Accounts (8/12) */}
        <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-10">
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
                      <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5">Saldo Refund</div>
                      <div className="text-sm md:text-lg font-bold text-text-main font-mono">Rp {data.user.balance_held?.toLocaleString() || '0'}</div>
                    </div>
                    <Clock size={14} className="text-text-muted" />
                  </div>
                )}
              </div>

              {isKijo && (
                <div className="space-y-3 pt-4 border-t border-border-main mt-auto">
                  {/* Saved Payment Methods */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Metode Penarikan Tersimpan</span>
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                      >
                        <Plus size={10} /> Tambah
                      </button>
                    </div>
                    {(data?.savedPaymentMethods || []).length === 0 ? (
                      <div className="py-3 text-center border border-dashed border-border-main rounded-xl bg-bg-main/30">
                        <p className="text-text-muted text-[11px] font-medium italic">Belum ada metode tersimpan.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                        {(data?.savedPaymentMethods || []).map((pm: any) => (
                          <div
                            key={pm.id}
                            onClick={() => setSelectedPaymentMethod(pm)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                              selectedPaymentMethod?.id === pm.id
                                ? 'bg-orange-primary/10 border-orange-primary/30'
                                : 'bg-bg-main border-border-main hover:border-orange-primary/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-orange-primary/10 rounded-lg flex items-center justify-center">
                                <Banknote size={10} className="text-orange-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-text-main">{pm.account_name}</span>
                                  {pm.is_default && <Star size={8} className="text-orange-primary fill-orange-primary" />}
                                </div>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{pm.method_type} - {maskAccountNumber(pm.account_number)}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePaymentMethod(pm.id); }}
                              className="p-1 text-text-muted hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleWithdraw} className="space-y-3">
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
                      withdrawStatus === 'success' ? 'bg-green-500 text-black' : withdrawStatus === 'error' ? 'bg-red-500 text-white' : 'bg-orange-primary text-black hover:scale-[1.02] shadow-orange-primary/20'
                    }`}
                  >
                    {withdrawStatus === 'loading' ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : withdrawStatus === 'success' ? (
                      <>
                        <CheckCircle2 size={14} />
                        BERHASIL
                      </>
                    ) : withdrawStatus === 'error' ? (
                      <>
                        <AlertCircle size={14} />
                        GAGAL
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={14} />
                        TARIK SALDO
                      </>
                    )}
                  </button>
                  </form>
                </div>
              )}
            </div>

            {/* Stats & Game Selection Column */}
            <div className="space-y-6 flex flex-col">
              {/* Monthly Stats */}
              <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-3">
                    <TrendingUp className="text-orange-primary" size={16} />
                    <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Statistik Bulan Ini</h3>
                  </div>
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
                  maxLength={500}
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
                    setGameFormData({
                      game_name: data.user.verified_game || availableGames[0]?.name || '',
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
                            <p className="text-text-muted text-[11px] md:text-xs font-bold uppercase tracking-widest">Game: {data?.user?.verified_game || 'Mobile Legends'}</p>
                          </div>
                        </div>
                        
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const finalData = {
                            ...gameFormData,
                            game_name: data?.user?.verified_game || 'Mobile Legends',
                            account_type: 'boosting',
                            id: placeholder?.id
                          };
                          handleSaveGameAccount(e, finalData);
                        }} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {(() => {
                              const selectedGame = availableGames.find(g => g.name === (data?.user?.verified_game || 'Mobile Legends'));
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
                          {acc.dynamic_data ? (() => {
                            try {
                              return Object.entries(JSON.parse(acc.dynamic_data)).slice(0, 4).map(([key, val]: [string, any]) => (
                                <div key={key}>
                                  <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">{key}</div>
                                  <div className="text-xs md:text-sm font-bold text-text-main truncate">{val}</div>
                                </div>
                              ));
                            } catch (e) { return null; }
                          })() : (
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
                    game_name: availableGames[0]?.name || 'Mobile Legends',
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
                            <p className="text-orange-primary text-[11px] md:text-xs font-semibold uppercase tracking-wide mt-0.5 md:mb-1">{acc.rank || (() => {
                                try {
                                  const d = acc.dynamic_data ? JSON.parse(acc.dynamic_data) : {};
                                  return d['Highest Rank'] || '';
                                } catch (e) { return ''; }
                              })()}</p>
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
                        {acc.dynamic_data ? (() => {
                          try {
                            return Object.entries(JSON.parse(acc.dynamic_data)).slice(0, 4).map(([key, val]: [string, any]) => (
                              <div key={key}>
                                <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">{key}</div>
                                <div className="text-xs md:text-sm font-bold text-text-main truncate">{val}</div>
                              </div>
                            ));
                          } catch (e) { return null; }
                        })() : (
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
                      <div className="text-xs md:text-base font-bold text-text-main">{data.user.work_start || '-'} - {data.user.work_end || '-'}</div>
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

            {/* Feature 3: Notification Preferences */}
            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-border-main">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <Bell className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Notifikasi</h3>
                </div>
                <button
                  onClick={handleSaveNotifPrefs}
                  disabled={isSavingNotif}
                  className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  {isSavingNotif ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'new_order' as const, label: 'Pesanan Baru' },
                  { key: 'order_completed' as const, label: 'Pesanan Selesai' },
                  { key: 'withdrawal_update' as const, label: 'Update Penarikan' },
                  { key: 'system_announcement' as const, label: 'Pengumuman Sistem' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-bg-main border border-border-main rounded-xl">
                    <span className="text-xs font-bold text-text-main">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`relative w-10 h-5 rounded-full transition-all ${notifPrefs[item.key] ? 'bg-orange-primary' : 'bg-bg-sidebar border border-border-main'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm ${notifPrefs[item.key] ? 'right-0.5 bg-black' : 'left-0.5 bg-text-muted'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature 6: Activity Log */}
            {(data?.loginHistory || []).length > 0 && (
              <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-border-main">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <Activity className="text-orange-primary" size={16} />
                  <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Riwayat Login</h3>
                </div>
                <div className="space-y-2">
                  {(data?.loginHistory || []).slice(0, 5).map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 bg-bg-main border border-border-main rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-orange-primary/10 rounded-lg flex items-center justify-center">
                          <Activity size={12} className="text-orange-primary" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-text-main">{maskIp(entry.ip_address)}</div>
                          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{abbreviateUA(entry.user_agent)}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        {new Date(entry.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Social Links & Actions (4/12) */}
        {isKijo && (
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-10">
            {/* Feature 2: Social Links (Kijo) */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 md:gap-3">
                <Link className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Linked Accounts</h3>
              </div>
              <div className="space-y-3">
                {/* Discord */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Discord</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#5865F2]/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#5865F2]" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="username#0000"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.discord}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, discord: e.target.value }))}
                    />
                  </div>
                </div>
                {/* Steam */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Steam</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#171a21]/30 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-text-muted" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 10.934l6.432 2.658a3.387 3.387 0 0 1 1.912-.588c.063 0 .125.003.187.006l2.861-4.142V8.77c0-2.58 2.1-4.68 4.68-4.68 2.58 0 4.68 2.1 4.68 4.68s-2.1 4.68-4.68 4.68h-.108l-4.076 2.911c0 .049.003.098.003.148 0 1.937-1.575 3.512-3.512 3.512A3.524 3.524 0 0 1 5.1 16.885L.254 14.856C1.484 19.955 6.236 23.87 11.979 23.87c6.625 0 12-5.375 12-12s-5.375-12-12-12z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Steam ID atau URL"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.steam}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, steam: e.target.value }))}
                    />
                  </div>
                </div>
                {/* Battle.net */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Battle.net</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#00AEFF]/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#00AEFF]" fill="currentColor"><path d="M10.457 0c.856 1.706.793 3.597.258 5.391-.328-.702-.762-1.414-1.345-1.984a12.16 12.16 0 0 0-.248 3.262c-1.02-.915-2.316-1.36-3.623-1.488 1.027.744 1.828 1.794 2.239 3.006C6.4 7.523 4.985 7.258 3.584 7.5c1.327.485 2.479 1.434 3.14 2.717-1.407-.406-2.895-.186-4.22.381 1.382.192 2.668.88 3.522 1.95C4.55 12.29 3.2 12.445 2 13.202c1.36-.086 2.716.318 3.775 1.14-1.272.387-2.288 1.308-2.915 2.46 1.133-.599 2.466-.77 3.72-.53-1.013.744-1.638 1.936-1.886 3.18.91-.84 2.118-1.35 3.373-1.406-.674.93-.972 2.076-.89 3.204.703-.983 1.754-1.694 2.928-2.005-.31 1.038-.234 2.158.16 3.16.462-1.084 1.3-1.994 2.337-2.525a5.107 5.107 0 0 0 .622 3.044c.204-1.167.83-2.252 1.736-3.019.012 1.076.4 2.145 1.093 2.98-.074-1.183.282-2.384.984-3.339.417.938 1.12 1.747 2 2.3-.402-1.095-.387-2.335.053-3.418.73.76 1.68 1.308 2.724 1.545-.695-.924-.99-2.114-.791-3.26.94.521 2.022.733 3.072.614-.904-.665-1.519-1.672-1.688-2.788 1.015.254 2.095.145 3.041-.27-1.013-.379-1.834-1.16-2.283-2.139 1.04-.02 2.062-.393 2.893-1.015-1.05-.068-2.02-.567-2.72-1.34.987-.295 1.85-.883 2.456-1.695-.996.242-2.042.087-2.987-.336.844-.558 1.485-1.395 1.828-2.353-.89.492-1.912.6-2.886.337.62-.788.96-1.771 1.003-2.77-.726.691-1.668 1.1-2.655 1.155.34-.947.372-1.993.106-2.96-.508.814-1.278 1.445-2.162 1.777.034-.99-.236-1.972-.77-2.82-.264.89-.795 1.69-1.52 2.288-.257-.955-.77-1.84-1.49-2.52-.002.943-.282 1.866-.79 2.668-.555-.83-1.328-1.5-2.227-1.93.3.877.36 1.83.167 2.73C11.23 4.398 10.647 3.4 10.278 2.414c-.328.886-.419 1.84-.266 2.77-.732-.75-1.638-1.3-2.63-1.598.553.78.863 1.71.907 2.658C7.495 5.4 7.049 4.427 6.87 3.38c-.563.766-.883 1.674-.944 2.608-.55-.89-1.34-1.59-2.293-2.024.682.736 1.098 1.708 1.148 2.72-.66-.822-1.548-1.424-2.55-1.728.777.63 1.29 1.544 1.424 2.539-.787-.69-1.745-1.118-2.77-1.24.822.485 1.432 1.278 1.692 2.184-.847-.514-1.832-.722-2.787-.599.82.303 1.498.908 1.87 1.685-.832-.289-1.734-.258-2.547.074.766.12 1.456.543 1.93 1.158-.767-.06-1.536.196-2.122.653.66-.066 1.305.17 1.81.616-.48.116-.912.388-1.236.77.537-.265 1.15-.3 1.715-.108-.34.286-.58.678-.68 1.11.426-.397 1-.585 1.583-.535-.24.375-.35.82-.317 1.264.294-.474.756-.81 1.288-.951-.13.433-.102.902.08 1.323.166-.517.517-.948.977-1.228-.013.446.134.886.412 1.24.045-.537.293-1.038.69-1.4.106.408.37.77.74 1.008-.07-.527.065-1.074.37-1.512.186.355.508.624.89.75-.198-.463-.178-1.004.044-1.458.27.28.633.445 1.014.468-.31-.384-.39-.914-.215-1.38.342.195.739.266 1.128.205-.396-.278-.606-.78-.55-1.28.393.102.807.07 1.178-.087-.454-.158-.78-.575-.854-1.052.41.01.822-.12 1.155-.363-.48-.027-.897-.34-1.083-.78.39-.072.77-.268 1.065-.56-.48.103-.978-.06-1.298-.418.34-.143.648-.38.878-.683-.45.227-.966.2-1.393-.058.265-.2.48-.46.63-.763-.4.338-.907.4-1.36.173.177-.246.296-.534.344-.84-.327.423-.81.63-1.293.56.085-.277.108-.572.065-.86-.24.5-.692.83-1.207.88 0-.274-.07-.544-.203-.786-.143.535-.503.965-.978 1.168.088-.265.11-.548.063-.82-.255.457-.694.765-1.196.843.135-.237.21-.504.218-.778-.335.393-.82.61-1.32.592.195-.2.33-.457.387-.737-.405.3-.9.397-1.375.275.24-.153.43-.374.547-.634-.44.176-.925.146-1.345-.064.265-.095.493-.268.656-.5-.44.04-.876-.126-1.22-.437.27-.035.52-.145.724-.317-.42-.09-.79-.353-1.033-.727z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="BattleTag#0000"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.battlenet}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, battlenet: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveSocialLinks}
                disabled={isSavingSocial}
                className="w-full bg-orange-primary text-black font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/10"
              >
                {isSavingSocial ? 'Menyimpan...' : 'Simpan Linked Accounts'}
              </button>
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
            {/* Feature 2: Social Links (Jokies) */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 md:gap-3">
                <Link className="text-orange-primary" size={16} />
                <h3 className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-wider">Linked Accounts</h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Discord</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#5865F2]/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#5865F2]" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="username#0000"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.discord}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, discord: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Steam</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#171a21]/30 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-text-muted" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 10.934l6.432 2.658a3.387 3.387 0 0 1 1.912-.588c.063 0 .125.003.187.006l2.861-4.142V8.77c0-2.58 2.1-4.68 4.68-4.68 2.58 0 4.68 2.1 4.68 4.68s-2.1 4.68-4.68 4.68h-.108l-4.076 2.911c0 .049.003.098.003.148 0 1.937-1.575 3.512-3.512 3.512A3.524 3.524 0 0 1 5.1 16.885L.254 14.856C1.484 19.955 6.236 23.87 11.979 23.87c6.625 0 12-5.375 12-12s-5.375-12-12-12z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Steam ID atau URL"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.steam}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, steam: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Battle.net</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#00AEFF]/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#00AEFF]" fill="currentColor"><path d="M10.457 0c.856 1.706.793 3.597.258 5.391-.328-.702-.762-1.414-1.345-1.984a12.16 12.16 0 0 0-.248 3.262c-1.02-.915-2.316-1.36-3.623-1.488 1.027.744 1.828 1.794 2.239 3.006C6.4 7.523 4.985 7.258 3.584 7.5c1.327.485 2.479 1.434 3.14 2.717-1.407-.406-2.895-.186-4.22.381 1.382.192 2.668.88 3.522 1.95C4.55 12.29 3.2 12.445 2 13.202c1.36-.086 2.716.318 3.775 1.14-1.272.387-2.288 1.308-2.915 2.46 1.133-.599 2.466-.77 3.72-.53-1.013.744-1.638 1.936-1.886 3.18.91-.84 2.118-1.35 3.373-1.406-.674.93-.972 2.076-.89 3.204.703-.983 1.754-1.694 2.928-2.005-.31 1.038-.234 2.158.16 3.16.462-1.084 1.3-1.994 2.337-2.525a5.107 5.107 0 0 0 .622 3.044c.204-1.167.83-2.252 1.736-3.019.012 1.076.4 2.145 1.093 2.98-.074-1.183.282-2.384.984-3.339.417.938 1.12 1.747 2 2.3-.402-1.095-.387-2.335.053-3.418.73.76 1.68 1.308 2.724 1.545-.695-.924-.99-2.114-.791-3.26.94.521 2.022.733 3.072.614-.904-.665-1.519-1.672-1.688-2.788 1.015.254 2.095.145 3.041-.27-1.013-.379-1.834-1.16-2.283-2.139 1.04-.02 2.062-.393 2.893-1.015-1.05-.068-2.02-.567-2.72-1.34.987-.295 1.85-.883 2.456-1.695-.996.242-2.042.087-2.987-.336.844-.558 1.485-1.395 1.828-2.353-.89.492-1.912.6-2.886.337.62-.788.96-1.771 1.003-2.77-.726.691-1.668 1.1-2.655 1.155.34-.947.372-1.993.106-2.96-.508.814-1.278 1.445-2.162 1.777.034-.99-.236-1.972-.77-2.82-.264.89-.795 1.69-1.52 2.288-.257-.955-.77-1.84-1.49-2.52-.002.943-.282 1.866-.79 2.668-.555-.83-1.328-1.5-2.227-1.93.3.877.36 1.83.167 2.73C11.23 4.398 10.647 3.4 10.278 2.414c-.328.886-.419 1.84-.266 2.77-.732-.75-1.638-1.3-2.63-1.598.553.78.863 1.71.907 2.658C7.495 5.4 7.049 4.427 6.87 3.38c-.563.766-.883 1.674-.944 2.608-.55-.89-1.34-1.59-2.293-2.024.682.736 1.098 1.708 1.148 2.72-.66-.822-1.548-1.424-2.55-1.728.777.63 1.29 1.544 1.424 2.539-.787-.69-1.745-1.118-2.77-1.24.822.485 1.432 1.278 1.692 2.184-.847-.514-1.832-.722-2.787-.599.82.303 1.498.908 1.87 1.685-.832-.289-1.734-.258-2.547.074.766.12 1.456.543 1.93 1.158-.767-.06-1.536.196-2.122.653.66-.066 1.305.17 1.81.616-.48.116-.912.388-1.236.77.537-.265 1.15-.3 1.715-.108-.34.286-.58.678-.68 1.11.426-.397 1-.585 1.583-.535-.24.375-.35.82-.317 1.264.294-.474.756-.81 1.288-.951-.13.433-.102.902.08 1.323.166-.517.517-.948.977-1.228-.013.446.134.886.412 1.24.045-.537.293-1.038.69-1.4.106.408.37.77.74 1.008-.07-.527.065-1.074.37-1.512.186.355.508.624.89.75-.198-.463-.178-1.004.044-1.458.27.28.633.445 1.014.468-.31-.384-.39-.914-.215-1.38.342.195.739.266 1.128.205-.396-.278-.606-.78-.55-1.28.393.102.807.07 1.178-.087-.454-.158-.78-.575-.854-1.052.41.01.822-.12 1.155-.363-.48-.027-.897-.34-1.083-.78.39-.072.77-.268 1.065-.56-.48.103-.978-.06-1.298-.418.34-.143.648-.38.878-.683-.45.227-.966.2-1.393-.058.265-.2.48-.46.63-.763-.4.338-.907.4-1.36.173.177-.246.296-.534.344-.84-.327.423-.81.63-1.293.56.085-.277.108-.572.065-.86-.24.5-.692.83-1.207.88 0-.274-.07-.544-.203-.786-.143.535-.503.965-.978 1.168.088-.265.11-.548.063-.82-.255.457-.694.765-1.196.843.135-.237.21-.504.218-.778-.335.393-.82.61-1.32.592.195-.2.33-.457.387-.737-.405.3-.9.397-1.375.275.24-.153.43-.374.547-.634-.44.176-.925.146-1.345-.064.265-.095.493-.268.656-.5-.44.04-.876-.126-1.22-.437.27-.035.52-.145.724-.317-.42-.09-.79-.353-1.033-.727z"/></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="BattleTag#0000"
                      className="flex-1 bg-bg-main border border-border-main rounded-xl py-2.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all font-bold"
                      value={socialLinks.battlenet}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, battlenet: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveSocialLinks}
                disabled={isSavingSocial}
                className="w-full bg-orange-primary text-black font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-orange-primary/10"
              >
                {isSavingSocial ? 'Menyimpan...' : 'Simpan Linked Accounts'}
              </button>
            </div>

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
              onClick={() => { setShowResetPassword(false); setOldPassword(''); setNewPassword(''); }}
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
                    onClick={() => { setShowResetPassword(false); setOldPassword(''); setNewPassword(''); }}
                    className="flex-1 bg-bg-main text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-bg-card transition-all text-xs uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={resetPasswordLoading}
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {resetPasswordLoading ? 'Memproses...' : 'Update'}
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
                        <option value={gameFormData.game_name}>{gameFormData.game_name || 'Belum ada game terverifikasi'}</option>
                      ) : (
                        availableGames.map(game => (
                          <option key={game.name} value={game.name}>{game.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Dynamic Fields */}
                  {(() => {
                    const selectedGame = availableGames.find(g => g.name === gameFormData.game_name);
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
                                        {r.title} - {tier}
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
                  {(!availableGames.find(g => g.name === gameFormData.game_name)?.schema?.length) && (
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
                                        {r.title} - {tier}
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

      {/* Payment Method Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-6 md:p-8 shadow-2xl"
            >
              <h3 className="text-xl md:text-2xl font-bold text-text-main mb-6 uppercase tracking-tighter">Tambah <span className="text-orange-primary">Metode Penarikan.</span></h3>
              <form onSubmit={handleAddPaymentMethod} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Tipe Metode</label>
                  <div className="relative">
                    <select
                      className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs font-bold appearance-none"
                      value={paymentFormData.method_type}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, method_type: e.target.value }))}
                    >
                      <option value="e-Wallet">e-Wallet (DANA, OVO, GoPay, dll)</option>
                      <option value="Bank">Bank Transfer</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nama Pemilik Akun</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: John Doe"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs font-bold"
                    value={paymentFormData.account_name}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, account_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nomor Rekening / Akun</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 08123456789"
                    className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all text-xs font-bold"
                    value={paymentFormData.account_number}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, account_number: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-bg-main border border-border-main rounded-xl">
                  <span className="text-xs font-bold text-text-main">Jadikan Default</span>
                  <button
                    type="button"
                    onClick={() => setPaymentFormData(prev => ({ ...prev, is_default: !prev.is_default }))}
                    className={`relative w-10 h-5 rounded-full transition-all ${paymentFormData.is_default ? 'bg-orange-primary' : 'bg-bg-sidebar border border-border-main'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm ${paymentFormData.is_default ? 'right-0.5 bg-black' : 'left-0.5 bg-text-muted'}`} />
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 bg-bg-main text-text-main font-bold py-4 rounded-xl border border-border-main hover:bg-bg-card transition-all text-xs uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest shadow-orange-primary/20"
                  >
                    Simpan Metode
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
