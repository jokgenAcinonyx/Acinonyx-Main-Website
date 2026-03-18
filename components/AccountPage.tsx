import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { useAlert } from './AlertContext';

interface AccountPageProps {
  user: any;
  onLogout: () => void;
  onStartVerification?: () => void;
  setView?: (view: any) => void;
  subView?: string;
  onSubViewChange?: (sv: string) => void;
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
    cancelledOrders: number;
    totalBooked: number;
  };
}

export default function AccountPage({ user, onLogout, onStartVerification, setView, subView, onSubViewChange }: AccountPageProps) {
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

  // Guard: if subView is not a known account sub-view (e.g. 'statistik' leaked from dashboard), reset to 'profil'
  const ACCOUNT_SUBVIEWS = ['profil', 'penilaian', 'pendapatan', 'game-detail', 'log', ''];
  const effectiveSubView = ACCOUNT_SUBVIEWS.includes(subView ?? '') ? (subView ?? '') : 'profil';
  // Sync back to parent if we had to normalise
  React.useEffect(() => {
    if (!ACCOUNT_SUBVIEWS.includes(subView ?? '')) {
      onSubViewChange?.('profil');
    }
  }, [subView]);

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
    const availableBalance = isKijo ? (data?.user.balance_active || 0) : (data?.user.wallet_jokies || 0);
    if (numAmount > availableBalance) {
      showAlert('Saldo tidak mencukupi', 'warning');
      return;
    }

    setWithdrawStatus('loading');
    try {
      const endpoint = isKijo ? '/api/kijo/withdraw' : '/api/jokies/withdraw';
      const res = await fetchWithAuth(endpoint, {
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
        const result = await res.json().catch(() => ({}));
        showAlert(result.message || 'Penarikan gagal', 'error');
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

      {/* Sub-view: Profil */}
      {(!effectiveSubView || effectiveSubView === 'profil') && (
      <>
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
                  <span>+</span>
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
                  <span className="text-xs font-bold">{data.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <span className="text-xs font-bold">{data.user.phone}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3 w-full">
            {isKijo && data.user.verified_game && (
              <div className="bg-bg-main/50 backdrop-blur-sm border border-border-main rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Game Terverifikasi</p>
                  <p className="text-sm font-bold text-text-main">{data.user.verified_game}</p>
                </div>
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
                    RE-VERIFY KIJO
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onStartVerification}
                  className="w-full bg-orange-primary text-black font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  BE A KIJO
                </button>
              )
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Sub-view: Penilaian */}
      {effectiveSubView === 'penilaian' && (
      <>
      {/* Rating & Review Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Rating <span className="text-orange-primary">& Review.</span></h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text-main">{averageRating}</span>
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => {
              const rating = parseFloat(averageRating);
              const filled = rating >= i + 1;
              const halfFilled = !filled && rating >= i + 0.5;
              return (
                <div key={i} className="relative" style={{ width: 14, height: 14 }}>
                  <Star size={14} className="text-text-muted/20 absolute inset-0" />
                  {filled && <Star size={14} className="text-orange-primary fill-orange-primary absolute inset-0" />}
                  {halfFilled && (
                    <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                      <Star size={14} className="text-orange-primary fill-orange-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-xs text-text-muted">({data.ratings.length})</span>
        </div>
      </div>

      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 shadow-sm">
        {data.ratings.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border-main rounded-2xl bg-bg-main/30">
            <p className="text-text-muted text-xs font-medium italic">Belum ada review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-main">
                  <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Dari</th>
                  <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Rating</th>
                  <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Traits</th>
                  <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Komentar</th>
                  <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Tanggal</th>
                  {isKijo && <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3">Balasan</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {data.ratings.map((rating) => (
                  <tr key={rating.id} className="hover:bg-bg-main/50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="text-xs font-bold text-text-main">
                        {isKijo
                          ? (rating.jokies_name || rating.jokies_username || `Jokies #${rating.jokies_id}`)
                          : (rating.kijo_name || rating.kijo_username || `Kijo #${rating.user_id}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} className={i < (rating.stars || 0) ? 'text-orange-primary fill-orange-primary' : 'text-text-muted/20'} />
                        ))}
                      </div>
                      {(rating.skill_rating || rating.attitude_rating) && (
                        <div className="flex gap-2 mt-1">
                          {rating.skill_rating && <span className="text-[10px] text-text-muted">Skill: {rating.skill_rating}/5</span>}
                          {rating.attitude_rating && <span className="text-[10px] text-text-muted">Att: {rating.attitude_rating}/5</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      {(() => { try { const tags = JSON.parse(rating.tags || '[]'); return tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((t: string) => (
                            <span key={t} className="bg-orange-primary/10 text-orange-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-primary/20">{t}</span>
                          ))}
                        </div>
                      ) : <span className="text-text-muted text-[10px] italic">—</span>; } catch { return <span className="text-text-muted text-[10px] italic">—</span>; } })()}
                    </td>
                    <td className="py-3 pr-4 max-w-[220px]">
                      <p className="text-text-muted text-xs leading-relaxed italic truncate">"{rating.comment || 'Tidak ada komentar.'}"</p>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="text-xs text-text-muted font-semibold">{new Date(rating.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </td>
                    {isKijo && (
                      <td className="py-3">
                        {rating.reply ? (
                          <div className="max-w-[200px]">
                            <p className="text-text-muted text-xs leading-relaxed italic truncate">"{rating.reply}"</p>
                          </div>
                        ) : (
                          replyingRatingId === rating.id ? (
                            <div className="flex items-center gap-2">
                              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Tulis balasan..." className="flex-1 bg-bg-main border border-border-main rounded-lg py-1.5 px-3 text-xs text-text-main focus:outline-none focus:border-orange-primary transition-all min-w-[120px]" />
                              <button onClick={() => handleSendReply(rating.id)} disabled={isSendingReply} className="p-1.5 bg-orange-primary rounded-lg text-black hover:scale-105 transition-all disabled:opacity-50">
                                {isSendingReply ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" /> : '→'}
                              </button>
                              <button onClick={() => { setReplyingRatingId(null); setReplyText(''); }} className="p-1.5 text-text-muted hover:text-red-500 transition-all">
                                ×
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setReplyingRatingId(rating.id); setReplyText(''); }} className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline">
                              Balas
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Sub-view: Pendapatan */}
      {effectiveSubView === 'pendapatan' && (
      <>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight mb-1">Pendapatan<span className="text-orange-primary">.</span></h2>
        <p className="text-text-muted text-xs md:text-sm">Kelola saldo dan metode penarikan Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Saldo Boxes */}
        <div className="space-y-4">
          {/* Saldo Aktif - Kijo Only */}
          {isKijo && (
            <div className="bg-gradient-to-br from-orange-primary to-orange-600 rounded-2xl p-5 md:p-6 text-black relative overflow-hidden shadow-lg shadow-orange-primary/10">
              <div className="relative z-10">
                <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Saldo Aktif</div>
                <div className="text-xl md:text-3xl font-bold font-mono">
                  Rp {data.user.balance_active?.toLocaleString() || '0'}
                </div>
                <div className="mt-3 text-[11px] font-bold bg-black/10 px-2 py-1 rounded-lg w-fit uppercase tracking-widest">
                  Siap ditarik
                </div>
              </div>
            </div>
          )}

          {/* Wallet Jokies */}
          {!isKijo && (
            <div className="bg-gradient-to-br from-orange-primary to-orange-600 rounded-2xl p-5 md:p-6 text-black relative overflow-hidden shadow-lg shadow-orange-primary/10">
              <div className="relative z-10">
                <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Wallet Jokies</div>
                <div className="text-xl md:text-3xl font-bold font-mono">
                  Rp {data.user.wallet_jokies?.toLocaleString() || '0'}
                </div>
                <div className="mt-3 text-[11px] font-bold bg-black/10 px-2 py-1 rounded-lg w-fit uppercase tracking-widest">
                  Saldo dari refund & cashback
                </div>
              </div>
            </div>
          )}

          {/* Saldo Ditahan */}
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Saldo Ditahan</div>
            <div className="text-xl md:text-2xl font-bold text-text-main font-mono">
              Rp {(isKijo ? data.user.balance_held : 0)?.toLocaleString() || '0'}
            </div>
            <div className="mt-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              {isKijo ? 'Pesanan aktif — belum selesai' : 'Tidak ada dana ditahan'}
            </div>
          </div>

          {/* Saldo Refund */}
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Saldo Refund</div>
            <div className="text-xl md:text-2xl font-bold text-text-main font-mono">
              Rp {data.user.balance_refund?.toLocaleString() || '0'}
            </div>
            <div className="mt-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              Total dana yang pernah direfund
            </div>
          </div>
        </div>

        {/* Payment Method Box */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Metode Pembayaran</h3>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline"
            >
              Tambah
            </button>
          </div>
          {(data?.savedPaymentMethods || []).length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-6 border border-dashed border-border-main rounded-xl bg-bg-main/30">
              <p className="text-text-muted text-[11px] font-medium italic">Belum ada metode tersimpan.</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[280px] no-scrollbar">
              {(data?.savedPaymentMethods || []).map((pm: any) => (
                <div
                  key={pm.id}
                  onClick={() => setSelectedPaymentMethod(pm)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMethod?.id === pm.id
                      ? 'bg-orange-primary/10 border-orange-primary/30'
                      : 'bg-bg-main border-border-main hover:border-orange-primary/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-text-main">{pm.account_name}</span>
                      {pm.is_default && <Star size={8} className="text-orange-primary fill-orange-primary" />}
                    </div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{pm.method_type} - {maskAccountNumber(pm.account_number)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePaymentMethod(pm.id); }}
                    className="p-1 text-text-muted hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Withdrawal Box */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 shadow-sm flex flex-col">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Penarikan Saldo {isKijo ? '(Kijo)' : '(Jokies)'}</h3>
            <form onSubmit={handleWithdraw} className="space-y-4 flex-1 flex flex-col">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Nominal Penarikan</label>
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

              {selectedPaymentMethod && (
                <div className="bg-bg-main border border-border-main rounded-xl p-3">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Metode Terpilih</div>
                  <div className="text-xs font-bold text-text-main">{selectedPaymentMethod.account_name}</div>
                  <div className="text-[10px] font-bold text-text-muted">{selectedPaymentMethod.method_type} - {maskAccountNumber(selectedPaymentMethod.account_number)}</div>
                </div>
              )}

              <div className="mt-auto pt-2">
                <button
                  type="submit"
                  disabled={withdrawStatus === 'loading'}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
                    withdrawStatus === 'success' ? 'bg-green-500 text-black' : withdrawStatus === 'error' ? 'bg-red-500 text-white' : 'bg-orange-primary text-black hover:scale-[1.02] shadow-orange-primary/20'
                  }`}
                >
                  {withdrawStatus === 'loading' ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : withdrawStatus === 'success' ? 'BERHASIL' : withdrawStatus === 'error' ? 'GAGAL' : 'TARIK SALDO'}
                </button>
              </div>
            </form>
          </div>
      </div>
      </>
      )}

      {/* grid-cols-12 main content - only render for sub-views that need it */}
      {(effectiveSubView === 'game-detail' || effectiveSubView === 'log' || effectiveSubView === 'profil' || !effectiveSubView) && (
      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* Left Column: Wallet, Stats, Accounts (8/12) */}
        <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-10">

          {/* Motto Box (Kijo Only) - show in profil subView */}
          {effectiveSubView === 'profil' && isKijo && (
            <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-6 shadow-sm">
              <div className="flex items-center gap-2 md:gap-3">
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

          {/* Boosting Account Details (Kijo Only) - game-detail subView */}
          {effectiveSubView === 'game-detail' && isKijo && (
            <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
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
                  <span>+</span>
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
                              ×
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

          {/* Games Account Details (Personal - For Everyone) - game-detail subView */}
          {effectiveSubView === 'game-detail' && (
          <div className="bg-bg-sidebar border border-border-main rounded-[24px] md:rounded-2xl p-5 md:p-8 space-y-4 md:space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
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
                <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wide">Tambah Akun</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
              {data.gameAccounts.filter(a => a.account_type === 'personal').length === 0 ? (
                <div className="col-span-1 md:col-span-2 py-8 md:py-16 text-center border border-dashed border-border-main rounded-xl md:rounded-2xl shadow-inner bg-bg-main/30">
                  <p className="text-text-muted text-xs md:text-sm font-medium">Belum ada akun game personal yang terdaftar.</p>
                </div>
              ) : (
                data.gameAccounts.filter(a => a.account_type === 'personal').map((acc) => (
                  <div 
                    key={acc.id} 
                    onClick={() => openEditGame(acc)}
                    className="bg-bg-main border border-border-main rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden group hover:border-orange-primary/30 transition-all shadow-sm cursor-pointer"
                  >
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
                            ×
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
          )}

          {/* Activity Log - log subView */}
          {effectiveSubView === 'log' && (
          <div className="space-y-6">
            {/* Account Details Card */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Detail Akun</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Username</div>
                    <div className="text-xs md:text-base font-bold text-text-main">@{data.user.username}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Email Terdaftar</div>
                    <div className="text-xs md:text-base font-bold text-text-main truncate max-w-[150px] sm:max-w-none">{data.user.email}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-0.5">No. Telepon</div>
                    <div className="text-xs md:text-base font-bold text-text-main">{data.user.phone}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Tanggal Lahir</div>
                    <div className="text-xs md:text-base font-bold text-text-main">{data.user.birth_date || '-'}</div>
                  </div>
                  {isKijo && (
                    <div>
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Jam Operasional</div>
                      <div className="text-xs md:text-base font-bold text-text-main">{data.user.work_start || '-'} - {data.user.work_end || '-'}</div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowResetPassword(true)}
                      className="flex-1 flex items-center justify-center p-3 bg-orange-primary/5 border border-orange-primary/10 rounded-xl hover:bg-orange-primary/10 transition-all shadow-sm"
                    >
                      <span className="text-[11px] font-bold text-text-main uppercase tracking-widest">Ganti Password</span>
                    </button>
                    <button
                      onClick={() => setShowChangePhone(true)}
                      className="flex-1 flex items-center justify-center p-3 bg-orange-primary/5 border border-orange-primary/10 rounded-xl hover:bg-orange-primary/10 transition-all shadow-sm"
                    >
                      <span className="text-[11px] font-bold text-text-main uppercase tracking-widest">Ganti No. Telpon</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Preferensi Notifikasi</h3>
                <button
                  onClick={handleSaveNotifPrefs}
                  disabled={isSavingNotif}
                  className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  {isSavingNotif ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              <div className="space-y-2">
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

            {/* Activity Log */}
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-5 md:p-8 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Riwayat Aktivitas</h3>
              {(data?.loginHistory || []).length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border-main rounded-2xl bg-bg-main/30">
                  <p className="text-text-muted text-xs font-medium italic">Belum ada riwayat aktivitas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border-main">
                        <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Waktu</th>
                        <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Aktivitas</th>
                        <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3 pr-4">Perangkat</th>
                        <th className="text-[10px] font-bold text-text-muted uppercase tracking-widest pb-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main">
                      {(data?.loginHistory || []).map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-bg-main/50 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="text-xs font-bold text-text-main whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[10px] font-bold text-text-muted">
                              {new Date(entry.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs font-bold text-orange-primary uppercase tracking-wide">Login</span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-xs font-bold text-text-main">{abbreviateUA(entry.user_agent)}</div>
                          </td>
                          <td className="py-3">
                            <div className="text-xs font-mono text-text-muted">{maskIp(entry.ip_address)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Right Column: Social Links & Actions (4/12) - show for profil */}
        {effectiveSubView === 'profil' && isKijo && (
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-10">

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
              <button 
                onClick={() => window.location.href = 'mailto:jokgen.acinonyx@gmail.com'}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-orange-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Email Admin</h4>
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-red-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Keluar Akun</h4>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {effectiveSubView === 'profil' && !isKijo && (
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-10">

            {/* Action Buttons for Jokies */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
              <button 
                onClick={() => window.location.href = 'mailto:jokgen.acinonyx@gmail.com'}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-orange-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Email Admin</h4>
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                className="w-full bg-bg-sidebar border border-border-main rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between group hover:border-red-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-left">
                    <h4 className="text-text-main font-bold text-xs md:text-sm uppercase tracking-tight">Keluar Akun</h4>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
      )}
      
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
