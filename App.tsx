import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Store, 
  Bell, 
  UserCircle, 
  Settings, 
  Clock, 
  Calendar, 
  History, 
  Activity,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  User as UserIcon,
  Sun,
  Moon,
  ShoppingBag,
  Image as ImageIcon,
  Wallet,
  Zap,
  TrendingUp,
  Package,
  ArrowRight,
  ShieldCheck,
  Gamepad2,
  Trophy,
  Star,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthPage from './components/AuthPage';
import EtalasePage from './components/EtalasePage';
import NotificationPage from './components/NotificationPage';
import TraitsPage from './components/TraitsPage';
import AccountPage from './components/AccountPage';
import MarketplacePage from './components/MarketplacePage';
import OrdersPage from './components/OrdersPage';
import AdminPage from './components/AdminPage';
import { useAlert } from './components/AlertContext';
import AdminSetupPage from './components/AdminSetupPage';
import KijoVerificationPage from './components/KijoVerificationPage';
import KijoStorePage from './components/KijoStorePage';
import OrderChat from './components/OrderChat';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { formatDuration, statusColor, statusLabel, toJakartaDT } from '@/utils/formatters';

import { JOKIES_TRAITS } from './constants';
import { 
  NavItem, 
  StatCard, 
  SectionHeader, 
  OrderItem, 
  TopNavItem, 
  BottomNavItem 
} from './components/LayoutComponents';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  has_kijo_profile: number;
  verified_game?: string;
  wallet_jokies?: number;
  is_suspended?: number;
  // Some endpoints return this value as 0/1 or boolean
  is_verified?: number | boolean;
}

interface UserStats {
  id: number;
  full_name: string;
  balance_active: number;
  balance_held: number;
  status_ketersediaan: string;
  work_start: string;
  work_end: string;
  active_orders: number;
  manual_status?: string;
  max_slots?: number;
}

interface Session {
  id: number;
  title: string;
  customer_name: string;
  price: number;
  scheduled_at: string;
  status: string;
  jokies_id?: number;
  duration?: number;
  started_at?: string;
  total_price?: number;
  screenshot_start?: string;
  screenshot_end?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  cancel_escalated?: number;
  kijo_finished?: number;
  jokies_finished?: number;
}

interface GroupedSessions {
  upcoming: Session[];
  ongoing: Session[];
  history: Session[];
}

export default function App() {
  const { showAlert } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [sessions, setSessions] = useState<GroupedSessions>({ upcoming: [], ongoing: [], history: [] });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [view, setView] = useState<'dashboard' | 'etalase' | 'notifications' | 'traits' | 'account' | 'marketplace' | 'orders' | 'kijo-store'>('dashboard');
  const [selectedKijoId, setSelectedKijoId] = useState<number | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mode, setMode] = useState<'kijo' | 'jokies'>('jokies');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pages, setPages] = useState({ upcoming: 1, history: 1 });
  const [historySort, setHistorySort] = useState('all');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [ratingJokiesSession, setRatingJokiesSession] = useState<any>(null);
  const [selectedJokiesTags, setSelectedJokiesTags] = useState<string[]>([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orderActionModal, setOrderActionModal] = useState<{ type: 'finish' | 'cancel' | 'start', order: any } | null>(null);
  const [orderActionReason, setOrderActionReason] = useState('');
  const [proofBeforeData, setProofBeforeData] = useState<string | null>(null);
  const [proofAfterData, setProofAfterData] = useState<string | null>(null);
  const [showKijoMobileChat, setShowKijoMobileChat] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [systemStatus, setSystemStatus] = useState<{ status: string, schedule?: any }>({ status: 'normal' });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [globalGames, setGlobalGames] = useState<any[]>([]);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/system/status');
      if (res.ok) setSystemStatus(await res.json());
    } catch (e) {
      console.error('Failed to fetch system status', e);
    }
  };

  const fetchGlobalGames = async () => {
    try {
      const res = await fetch('/api/kijo/available-games');
      if (res.ok) {
        const data = await res.json();
        setGlobalGames(data); // endpoint already returns only active games
      }
    } catch (e) {
      console.error('Failed to fetch global games', e);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);

    const savedTheme = localStorage.getItem('kijo_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
    
    const savedMode = localStorage.getItem('kijo_mode') as 'kijo' | 'jokies';
    if (savedMode) {
      setMode(savedMode);
      if (savedMode === 'jokies') setView('marketplace');
    }

    try {
      const savedUser = localStorage.getItem('kijo_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          setUser(parsed);
        } else {
          localStorage.removeItem('kijo_user');
        }
      }
    } catch (e) {
      console.error('Failed to parse saved user', e);
      localStorage.removeItem('kijo_user');
    }

    // Check if first-time admin setup is needed
    fetch('/api/setup/status')
      .then(r => r.ok ? r.json() : { needsSetup: false })
      .then(data => setNeedsSetup(data.needsSetup ?? false))
      .catch(() => setNeedsSetup(false))
      .finally(() => setLoading(false));

    fetchSystemStatus();
    fetchGlobalGames();
    const statusInterval = setInterval(fetchSystemStatus, 300000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(statusInterval);
    };
  }, []);

  const fetchData = async () => {
    if (!user || !user.id) return;
    try {
      const [statsRes, sessionsRes, notificationsRes, userRes, announcementsRes] = await Promise.all([
        fetchWithAuth(`/api/kijo/stats/${user.id}`).catch(() => ({ ok: false, status: 500 })),
        fetchWithAuth(`/api/kijo/sessions/${user.id}?sort=${historySort}`).catch(() => ({ ok: false, status: 500 })),
        fetchWithAuth(`/api/kijo/notifications/${user.id}`).catch(() => ({ ok: false, status: 500 })),
        fetchWithAuth(`/api/auth/me/${user.id}`).catch(() => ({ ok: false, status: 500 })),
        fetchWithAuth(`/api/announcements?role=${user.role}`).catch(() => ({ ok: false, status: 500 }))
      ]);

      if (userRes.ok) {
        const userData = await (userRes as Response).json();
        if (userData.success) {
          const updatedUser = userData.user;
          setUser(updatedUser);
          localStorage.setItem('kijo_user', JSON.stringify(updatedUser));
        }
      }

      if ((statsRes as any).status === 404) {
        handleLogout();
        return;
      }

      if (statsRes.ok) {
        const statsData = await (statsRes as Response).json();
        setStats(statsData);
        
        // Deep compare to prevent infinite loops
        const hasChanged = 
          statsData.role !== user.role || 
          (statsData.verified_game || '') !== (user.verified_game || '') || 
          Number(statsData.is_verified) !== Number(user.is_verified);

        if (hasChanged && statsData.id === user.id) {
          const updatedUser = { ...user, ...statsData };
          setUser(updatedUser);
          localStorage.setItem('kijo_user', JSON.stringify(updatedUser));
        }
      }
      if (sessionsRes.ok) setSessions(await (sessionsRes as Response).json());
      if (notificationsRes.ok) {
        const notificationsData = await (notificationsRes as Response).json();
        setUnreadNotifications(notificationsData.filter((n: any) => n.is_read === 0).length);
      }
      if (announcementsRes.ok) {
        setAnnouncements(await (announcementsRes as Response).json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('refreshStats', handleRefresh);

    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshStats', handleRefresh);
    };
  }, [user?.id, historySort]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('kijo_user', JSON.stringify(userData));
    setIsSidebarOpen(false);
    
    // Redirect to home/marketplace on login
    if (userData.role === 'jokies') {
      setMode('jokies');
      setView('marketplace');
      localStorage.setItem('kijo_mode', 'jokies');
    } else {
      setMode('kijo');
      setView('dashboard');
      localStorage.setItem('kijo_mode', 'kijo');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsSidebarOpen(false);
    localStorage.removeItem('kijo_user');
    localStorage.removeItem('kijo_token');
  };

  const handleSetupComplete = (adminUser: any, token: string) => {
    localStorage.setItem('kijo_token', token);
    localStorage.setItem('kijo_user', JSON.stringify(adminUser));
    setUser(adminUser);
    setNeedsSetup(false);
    setMode('kijo');
    setView('dashboard');
  };

  const handleNavClick = (newView: any) => {
    setView(newView);
    if (mode === 'jokies' || window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('kijo_theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const toggleMode = async () => {
    if (mode === 'jokies') {
      // Trying to switch to Kijo
      if (user?.role !== 'kijo') {
        // Not a kijo yet, redirect to account page to verify
        setView('account');
        setIsSidebarOpen(false);
        return;
      }
      setMode('kijo');
      localStorage.setItem('kijo_mode', 'kijo');
      setView('dashboard');
    } else {
      // Switching back to Jokies
      setMode('jokies');
      localStorage.setItem('kijo_mode', 'jokies');
      setView('marketplace');
    }
    setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-primary/30 border-t-orange-primary rounded-full animate-spin" />
          <span className="text-text-muted text-sm font-medium">Memuat...</span>
        </div>
      </div>
    );
  }

  if (systemStatus.status === 'maintenance' && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-10 text-center">
        <div className="w-24 h-24 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary mb-8 animate-bounce">
          <Clock size={48} />
        </div>
        <h1 className="text-4xl font-bold text-text-main uppercase tracking-tighter mb-4">The system is busy right now!</h1>
        <p className="text-text-muted text-lg font-bold uppercase tracking-widest mb-8">We will back soon!</p>
        <div className="max-w-md p-6 bg-bg-sidebar border border-border-main rounded-2xl">
          <p className="text-sm text-text-muted leading-relaxed italic">
            "{systemStatus.schedule?.reason || 'Pemeliharaan rutin sistem sedang berlangsung.'}"
          </p>
          <div className="mt-6 pt-6 border-t border-border-main flex flex-col items-center gap-2">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Estimasi Selesai</p>
            <p className="text-sm font-bold text-orange-primary">
              {new Date(systemStatus.schedule?.end_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (needsSetup) {
      return <AdminSetupPage onSetupComplete={handleSetupComplete} />;
    }
    return <AuthPage onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return <AdminPage user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} globalGames={globalGames} />;
  }

  if (user.is_suspended) {
    return (
      <div className={`min-h-screen bg-bg-main flex items-center justify-center p-6 ${theme}`}>
        <div className="max-w-md w-full bg-bg-sidebar border border-red-500/30 rounded-2xl p-10 text-center shadow-2xl space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-main uppercase tracking-tighter mb-2">Akun Ditangguhkan</h2>
            <p className="text-text-muted text-sm leading-relaxed">
              Akun Anda telah ditangguhkan oleh admin. Silakan hubungi support untuk informasi lebih lanjut.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  const handleKijoOrderAction = async () => {
    if (!orderActionModal) return;
    setIsProcessingOrder(true);
    try {
      let endpoint = '';
      let body: any = {};

      if (orderActionModal.type === 'finish') {
        endpoint = '/api/kijo/finish-order';
        body = { orderId: orderActionModal.order.id };
      } else if (orderActionModal.type === 'cancel') {
        endpoint = '/api/orders/cancel';
        body = { orderId: orderActionModal.order.id, reason: orderActionReason };
      } else if (orderActionModal.type === 'start') {
        endpoint = '/api/orders/start';
        body = { orderId: orderActionModal.order.id };
      }

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        let successMsg = '';
        if (orderActionModal.type === 'finish') successMsg = 'Pesanan ditandai selesai! Menunggu konfirmasi pelanggan.';
        else if (orderActionModal.type === 'cancel') successMsg = 'Pesanan berhasil dibatalkan.';
        else if (orderActionModal.type === 'start') successMsg = 'Sesi telah dimulai!';

        showAlert(successMsg, 'success');
        setOrderActionModal(null);
        setOrderActionReason('');
        // After starting, go back to list so user lands on "Sedang Berjalan"
        if (orderActionModal.type === 'start') {
          setSelectedSession(null);
          setProofBeforeData(null);
          setProofAfterData(null);
          setShowKijoMobileChat(false);
        }
        fetchData();
      } else {
        showAlert(data.message || 'Gagal memproses aksi pesanan', 'error');
      }
    } catch (error) {
      showAlert('Terjadi kesalahan server', 'error');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  return (
    <div className={`flex min-h-screen bg-bg-main text-text-main ${theme}`}>
      {systemStatus.status === 'freeze' && user?.role !== 'admin' && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/10 text-amber-400 py-2.5 px-4 text-center font-medium text-sm border-b border-amber-500/20 z-[100]">
          Sistem akan memasuki masa maintenance dalam waktu dekat. Pemesanan baru dinonaktifkan sementara.
        </div>
      )}
      {/* Sidebar Overlay - Works on all screens when sidebar is open, but hidden on PC hover */}
      <AnimatePresence>
        {isSidebarOpen && mode === 'kijo' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className={`fixed inset-0 bg-black/60 z-[55] ${isMobile ? 'backdrop-blur-sm' : 'xl:hidden'}`}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Hidden on mobile (isMobile < 768px), shown on desktop */}
      {!isMobile && mode === 'kijo' && (
        <>
          {/* Hover trigger zone */}
          {!isSidebarOpen && (
            <div 
              className="fixed left-0 top-0 bottom-0 w-4 z-[59]"
              onMouseEnter={() => setIsSidebarOpen(true)}
            />
          )}
          <aside 
            onMouseEnter={() => setIsSidebarOpen(true)}
            onMouseLeave={() => setIsSidebarOpen(false)}
            className={`
              fixed left-0 top-0 h-screen w-64 bg-bg-sidebar border-r border-border-main z-[60] transition-transform duration-300 flex flex-col
              ${isSidebarOpen 
                ? 'translate-x-0' 
                : '-translate-x-full xl:translate-x-0'
              }
            `}
          >
          <div className="p-6 border-b border-border-main flex justify-center items-center shrink-0">
            <span className="text-orange-primary font-extrabold text-xl tracking-wider">ACINONYX</span>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <nav className="mt-8 px-4 space-y-2">
              {mode === 'kijo' ? (
                <>
                  <NavItem 
                    icon={<LayoutDashboard size={18} />} 
                    label="Dashboard" 
                    active={view === 'dashboard'} 
                    onClick={() => handleNavClick('dashboard')}
                  />
                  <NavItem 
                    icon={<Store size={18} />} 
                    label="Etalase" 
                    active={view === 'etalase'} 
                    onClick={() => handleNavClick('etalase')}
                  />
                  <NavItem 
                    icon={<Bell size={18} />} 
                    label="Notifikasi" 
                    active={view === 'notifications'} 
                    onClick={() => handleNavClick('notifications')}
                    badge={unreadNotifications > 0 ? unreadNotifications : undefined}
                  />
                  <NavItem 
                    icon={<Activity size={18} />} 
                    label="Traits" 
                    active={view === 'traits'} 
                    onClick={() => handleNavClick('traits')}
                  />
                </>
              ) : (
                <>
                  <NavItem 
                    icon={<ShoppingBag size={18} />} 
                    label="Beranda" 
                    active={view === 'marketplace'} 
                    onClick={() => handleNavClick('marketplace')}
                  />
                  <NavItem 
                    icon={<History size={18} />} 
                    label="Pesanan" 
                    active={view === 'orders'} 
                    onClick={() => handleNavClick('orders')}
                  />
                  <NavItem
                    icon={<Bell size={18} />} 
                    label="Notifikasi" 
                    active={view === 'notifications'} 
                    onClick={() => handleNavClick('notifications')}
                    badge={unreadNotifications > 0 ? unreadNotifications : undefined}
                  />
                  <NavItem 
                    icon={<Activity size={18} />} 
                    label="Traits" 
                    active={view === 'traits'} 
                    onClick={() => handleNavClick('traits')}
                  />
                </>
              )}
              
              <NavItem 
                icon={<UserCircle size={18} />} 
                label="Akun" 
                active={view === 'account'} 
                onClick={() => handleNavClick('account')}
              />
            </nav>
          </div>

          <div className="p-4 border-t border-border-main space-y-2 shrink-0">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-bg-card border border-border-main hover:border-orange-primary/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-orange-primary" />}
                  <span className="text-xs font-bold uppercase tracking-wider">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-blue-900/50' : 'bg-orange-primary/20'}`}>
                  <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${theme === 'dark' ? 'right-1 bg-blue-400' : 'left-1 bg-orange-primary'}`} />
                </div>
              </button>

              {/* Mode Switcher */}
              <button
                onClick={toggleMode}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg ${
                  mode === 'kijo'
                    ? 'bg-orange-primary/10 text-orange-primary shadow-orange-primary/10 border border-orange-primary/30 hover:bg-orange-primary hover:text-black'
                    : 'bg-orange-primary text-black shadow-orange-primary/10'
                }`}
              >
                {mode === 'kijo' ? <ShoppingBag size={18} /> : <Activity size={18} />}
                <span className="text-xs uppercase tracking-widest">
                  {mode === 'kijo' ? 'Pindah ke Jokies' : (user?.role === 'kijo' ? 'Pindah ke Kijo' : 'Jadi Kijo')}
                </span>
              </button>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-text-muted hover:text-red-500 hover:bg-red-500/5 group"
              >
                <LogOut size={18} className="group-hover:text-red-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Floating Active Order Indicator */}
      <FloatingOrderIndicator
        user={user}
        mode={mode}
        view={view}
        selectedSession={selectedSession}
        selectedOrder={null}
        onNavigate={(session: any) => {
          if (mode === 'kijo') {
            setView('dashboard');
            setSelectedSession(session);
          } else {
            setView('orders');
          }
        }}
      />

      {/* Bottom Navbar for Mobile */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-bg-sidebar border-t border-border-main z-[60] flex items-center justify-around px-2 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {mode === 'kijo' ? (
            <>
              <BottomNavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Home" 
                active={view === 'dashboard'} 
                onClick={() => setView('dashboard')}
              />
              <BottomNavItem 
                icon={<Store size={20} />} 
                label="Etalase" 
                active={view === 'etalase'} 
                onClick={() => setView('etalase')}
              />
              <BottomNavItem 
                icon={<Bell size={20} />} 
                label="Inbox" 
                active={view === 'notifications'} 
                onClick={() => setView('notifications')}
                badge={unreadNotifications > 0 ? unreadNotifications : undefined}
              />
              <BottomNavItem 
                icon={<Activity size={20} />} 
                label="Traits" 
                active={view === 'traits'} 
                onClick={() => setView('traits')}
              />
              <BottomNavItem 
                icon={<UserCircle size={20} />} 
                label="Akun" 
                active={view === 'account'} 
                onClick={() => setView('account')}
              />
            </>
          ) : (
            <>
              <BottomNavItem 
                icon={<ShoppingBag size={20} />} 
                label="Home" 
                active={view === 'marketplace'} 
                onClick={() => setView('marketplace')}
              />
              <BottomNavItem 
                icon={<History size={20} />} 
                label="Pesanan" 
                active={view === 'orders'} 
                onClick={() => setView('orders')}
              />
              <BottomNavItem 
                icon={<Bell size={20} />} 
                label="Inbox" 
                active={view === 'notifications'} 
                onClick={() => setView('notifications')}
                badge={unreadNotifications > 0 ? unreadNotifications : undefined}
              />
              <BottomNavItem 
                icon={<Activity size={20} />} 
                label="Traits" 
                active={view === 'traits'} 
                onClick={() => setView('traits')}
              />
              <BottomNavItem 
                icon={<UserCircle size={20} />} 
                label="Akun" 
                active={view === 'account'} 
                onClick={() => setView('account')}
              />
            </>
          )}
        </nav>
      )}

      {/* Main Content */}
      <main className={`flex-1 min-h-screen relative z-10 overflow-x-hidden transition-all duration-300 ${isMobile ? 'pb-20' : (mode === 'jokies' ? 'lg:ml-0' : 'xl:ml-64 lg:ml-0')}`}>
        {/* Mobile/Desktop Header for Jokies (Sticky) */}
        <header className={`flex ${mode === 'jokies' ? 'justify-between' : 'xl:hidden'} sticky top-0 left-0 right-0 h-16 bg-bg-sidebar border-b border-border-main z-[50] items-center px-4 sm:px-6 shadow-sm`}>
          <div className="flex items-center gap-4 md:gap-8 flex-1">
            <span className="text-orange-primary font-bold text-sm sm:text-base md:text-xl tracking-wide sm:tracking-wider shrink-0">ACINONYX</span>
            
            {mode === 'jokies' && (
              <div className="hidden md:flex items-center gap-1 sm:gap-2 md:gap-4 overflow-x-auto no-scrollbar flex-1 justify-center md:justify-start">
                <TopNavItem 
                  icon={<ShoppingBag />} 
                  label="Home" 
                  active={view === 'marketplace'} 
                  onClick={() => setView('marketplace')}
                />
                <TopNavItem 
                  icon={<History />} 
                  label="Pesanan" 
                  active={view === 'orders'} 
                  onClick={() => setView('orders')}
                />
                <TopNavItem 
                  icon={<Bell />} 
                  label="Inbox" 
                  active={view === 'notifications'} 
                  onClick={() => setView('notifications')}
                  badge={unreadNotifications > 0 ? unreadNotifications : undefined}
                />
                <TopNavItem 
                  icon={<Activity />} 
                  label="Traits" 
                  active={view === 'traits'} 
                  onClick={() => setView('traits')}
                />
                <TopNavItem 
                  icon={<UserCircle />} 
                  label="Akun" 
                  active={view === 'account'} 
                  onClick={() => setView('account')}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2">
            {mode === 'kijo' && !isMobile && (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 sm:p-2 text-text-main hover:bg-bg-card rounded-lg transition-colors flex items-center gap-1 sm:gap-2"
              >
                <span className="hidden xs:inline text-xs font-semibold uppercase tracking-wide">Opsi</span>
                {isSidebarOpen ? <X size={20} className="sm:size-6" /> : <Menu size={20} className="sm:size-6" />}
              </button>
            )}
            {(isMobile || mode === 'jokies') && (
              <div className="flex items-center gap-2">
                <button onClick={toggleTheme} className="p-2 text-text-muted hover:text-text-main transition-colors">
                  {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button onClick={toggleMode} className="bg-orange-primary text-black text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest hover:scale-105 transition-all">
                  {mode === 'kijo' ? 'Jokies' : 'Kijo'}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-10">
          <GlobalAnnouncements announcements={announcements} />
          {view === 'dashboard' && mode === 'kijo' && (
          <div className="animate-in fade-in duration-500">
            {selectedSession ? (
              <KijoOrderDetailView
                selectedSession={selectedSession}
                user={user}
                showMobileChat={showKijoMobileChat}
                setShowMobileChat={setShowKijoMobileChat}
                proofBeforeData={proofBeforeData}
                setProofBeforeData={setProofBeforeData}
                proofAfterData={proofAfterData}
                setProofAfterData={setProofAfterData}
                onBack={() => { setSelectedSession(null); setProofBeforeData(null); setProofAfterData(null); setShowKijoMobileChat(false); }}
                onStart={(session: any) => setOrderActionModal({ type: 'start', order: session })}
                onFinish={(session: any) => setOrderActionModal({ type: 'finish', order: session })}
                onCancel={(session: any) => setOrderActionModal({ type: 'cancel', order: session })}
                showAlert={showAlert}
                fetchData={fetchData}
              />
            ) : (
            <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-8 sm:mb-10">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-text-main tracking-tight">
                  Halo, <span className="text-orange-primary">{stats?.full_name || user.full_name}</span>!
                </h1>
                <p className="text-text-muted text-xs sm:text-sm mt-1">Selamat datang kembali di panel kendali Partner Anda.</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-bg-sidebar px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-border-main flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-xs text-text-muted font-bold uppercase tracking-wider">Operasional</span>
                    <span className="text-orange-primary font-mono font-bold text-xs sm:text-sm">
                      {stats?.work_start || '08:00'} - {stats?.work_end || '22:00'}
                    </span>
                  </div>
                  <Clock className="text-orange-primary/50" size={14} />
                </div>
              </div>
            </header>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <StatCard 
                label="Saldo Aktif" 
                value={`Rp ${new Intl.NumberFormat('id-ID').format(stats?.balance_active || 0)}`} 
              />
              <StatCard 
                label="Saldo Tertahan" 
                value={`Rp ${new Intl.NumberFormat('id-ID').format(stats?.balance_held || 0)}`} 
              />
              <StatCard 
                label="Status Ketersediaan" 
                value={
                  stats?.manual_status === 'offline' 
                    ? 'Sedang Istirahat' 
                    : ((stats?.active_orders ?? 0) >= (stats?.max_slots || 3))
                      ? 'Sibuk (Slot Penuh)'
                      : 'Tersedia'
                }
                status={
                  stats?.manual_status === 'offline'
                    ? 'busy'
                    : ((stats?.active_orders ?? 0) >= (stats?.max_slots || 3))
                      ? 'busy'
                      : 'active'
                } 
              />
            </section>

            {/* Content Columns */}
            <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 items-stretch">
              {/* Upcoming */}
              <div className="space-y-6 bg-bg-card/50 p-5 rounded-2xl border border-border-main/50 h-full">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={<Calendar size={16} />} title="Sesi Mendatang" />
                  <div className="flex gap-2">
                    <button 
                      disabled={pages.upcoming === 1}
                      onClick={() => setPages(p => ({ ...p, upcoming: p.upcoming - 1 }))}
                      className="p-1 text-text-muted hover:text-orange-primary disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      disabled={pages.upcoming * 5 >= sessions.upcoming.length}
                      onClick={() => setPages(p => ({ ...p, upcoming: p.upcoming + 1 }))}
                      className="p-1 text-text-muted hover:text-orange-primary disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {sessions.upcoming.length > 0 ? sessions.upcoming.slice((pages.upcoming - 1) * 5, pages.upcoming * 5).map(session => (
                    <OrderItem 
                      key={session.id}
                      title={session.title} 
                      user={session.customer_name} 
                      price={`Rp ${new Intl.NumberFormat('id-ID').format(session.price)}`} 
                      time={session.scheduled_at} 
                      hoverEffect
                      onClick={() => setSelectedSession(session)}
                      onStart={() => setOrderActionModal({ type: 'start', order: session })}
                    />
                  )) : <p className="text-gray-600 text-xs italic">Tidak ada sesi mendatang</p>}
                </div>
              </div>

              {/* Ongoing */}
              <div className="space-y-6 bg-bg-card/50 p-5 rounded-2xl border border-border-main/50 h-full">
                <SectionHeader icon={<Activity size={16} />} title="Sedang Berjalan" />
                <div className="space-y-4">
                  {sessions.ongoing.length > 0 ? sessions.ongoing.map(session => (
                    <OrderItem
                      key={session.id}
                      title={session.title}
                      user={session.customer_name}
                      price={`Rp ${new Intl.NumberFormat('id-ID').format(session.price)}`}
                      time={session.scheduled_at}
                      active
                      onClick={() => setSelectedSession(session)}
                      details={{
                        id: session.id,
                        kijoId: user?.id ?? 0,
                        jokiesId: session.jokies_id ?? 0,
                        duration: session.duration ?? 0,
                        startTime: session.started_at ?? session.scheduled_at,
                        hasProofs: !!(session.screenshot_start && session.screenshot_end)
                      }}
                      onFinish={session.status === 'ongoing' ? () => setOrderActionModal({ type: 'finish', order: session }) : undefined}
                      onCancel={session.status === 'ongoing' ? () => setOrderActionModal({ type: 'cancel', order: session }) : undefined}
                    />
                  )) : <p className="text-gray-600 text-xs italic">Tidak ada sesi berjalan</p>}
                </div>
              </div>

              {/* History */}
              <div className="lg:col-span-2 xl:col-span-1 space-y-6 bg-bg-card/50 p-5 rounded-2xl border border-border-main/50 h-full">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={<History size={16} />} title="History" />
                  <div className="flex items-center gap-2">
                    <select 
                      value={historySort}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (['3months', '6months', '1year'].includes(val)) {
                          setShowFullHistory(true);
                          // Reset to 'all' so it acts as a trigger
                          setHistorySort('all');
                        } else {
                          setHistorySort(val);
                        }
                      }}
                      className="bg-bg-sidebar border border-border-main text-xs font-bold uppercase px-2 py-1 rounded-lg focus:outline-none focus:border-orange-primary"
                    >
                      <option value="all">Semua</option>
                      <option value="week">1 Minggu</option>
                      <option value="month">1 Bulan</option>
                      <option disabled className="text-text-muted">--- Lebih Lama ---</option>
                      <option value="3months">3 Bulan +</option>
                      <option value="6months">6 Bulan +</option>
                      <option value="1year">1 Tahun +</option>
                    </select>
                    <div className="flex gap-1">
                      <button 
                        disabled={pages.history === 1}
                        onClick={() => setPages(p => ({ ...p, history: p.history - 1 }))}
                        className="p-1 text-text-muted hover:text-orange-primary disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        disabled={pages.history * 5 >= sessions.history.length}
                        onClick={() => setPages(p => ({ ...p, history: p.history + 1 }))}
                        className="p-1 text-text-muted hover:text-orange-primary disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {sessions.history.length > 0 ? sessions.history.slice((pages.history - 1) * 5, pages.history * 5).map(session => (
                    <OrderItem 
                      key={session.id}
                      title={session.title} 
                      user={session.customer_name} 
                      price={`Rp ${new Intl.NumberFormat('id-ID').format(session.total_price || session.price)}`} 
                      time={session.scheduled_at} 
                      completed
                      hoverEffect
                      onClick={() => setSelectedSession(session)}
                      onRate={() => {
                        setRatingJokiesSession(session);
                        setSelectedJokiesTags([]);
                      }}
                    />
                  )) : <p className="text-gray-600 text-xs italic">Belum ada history</p>}
                </div>
              </div>
            </section>
          </>
          )}
          </div>
        )}

        {view === 'dashboard' && mode === 'jokies' && (
          <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-5xl font-bold text-text-main tracking-tighter uppercase leading-none">
                  Beranda <span className="text-orange-primary">Jokies.</span>
                </h1>
                <p className="text-text-muted text-xs sm:text-base mt-2 font-medium max-w-md">
                  Selamat datang kembali! Pantau saldo, kelola pesanan, dan temukan partner mabar terbaikmu hari ini.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Waktu Server</p>
                  <p className="text-sm font-bold text-text-main">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="w-12 h-12 bg-bg-sidebar border border-border-main rounded-2xl flex items-center justify-center text-text-muted">
                  <Clock size={20} />
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-4 shadow-sm group hover:border-orange-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary border border-orange-primary/20">
                    <Wallet size={20} />
                  </div>
                  <TrendingUp size={16} className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Saldo Wallet</p>
                  <p className="text-2xl font-bold text-text-main tracking-tight">
                    Rp {new Intl.NumberFormat('id-ID').format(user.wallet_jokies || 0)}
                  </p>
                </div>
              </div>

              <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-4 shadow-sm group hover:border-orange-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <Package size={20} />
                  </div>
                  <ArrowRight size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Total Pesanan</p>
                  <p className="text-2xl font-bold text-text-main tracking-tight">
                    {(sessions.history.length + sessions.upcoming.length + sessions.ongoing.length).toString()}
                  </p>
                </div>
              </div>

              <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 space-y-4 shadow-sm group hover:border-orange-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 ${user.is_suspended ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'} rounded-xl flex items-center justify-center border`}>
                    <ShieldCheck size={20} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Status Akun</p>
                  <p className={`text-2xl font-bold tracking-tight ${user.is_suspended ? 'text-red-500' : 'text-green-500'}`}>
                    {user.is_suspended ? 'Suspended' : 'Verified'}
                  </p>
                </div>
              </div>

              <div className="bg-orange-primary rounded-2xl p-6 space-y-4 shadow-xl shadow-orange-primary/20 group hover:scale-[1.02] transition-all cursor-pointer" onClick={() => setView('marketplace')}>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center text-black">
                    <Zap size={20} />
                  </div>
                  <ArrowRight size={16} className="text-black" />
                </div>
                <div>
                  <p className="text-xs font-bold text-black/60 uppercase tracking-widest">Mulai Mabar</p>
                  <p className="text-2xl font-bold text-black tracking-tight">Marketplace</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* History Pesanan Section */}
              <div className="lg:col-span-2 bg-bg-sidebar border border-border-main rounded-2xl p-6 sm:p-10 space-y-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <History className="text-orange-primary" size={24} />
                    <h3 className="text-xl sm:text-2xl font-bold text-text-main uppercase tracking-tight">History <span className="text-orange-primary">Pesanan.</span></h3>
                  </div>
                  <button 
                    onClick={() => setView('orders')} 
                    className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-widest hover:text-orange-primary transition-colors group"
                  >
                    Lihat Semua <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessions.history.length === 0 && sessions.upcoming.length === 0 && sessions.ongoing.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-border-main rounded-2xl bg-bg-main/30">
                      <div className="w-16 h-16 bg-bg-sidebar rounded-full flex items-center justify-center mx-auto mb-4 border border-border-main">
                        <Package size={32} className="text-text-muted opacity-20" />
                      </div>
                      <p className="text-text-muted text-sm font-medium italic">Belum ada riwayat pesanan.</p>
                      <button 
                        onClick={() => setView('marketplace')}
                        className="mt-6 text-orange-primary text-xs font-semibold uppercase tracking-wide hover:underline"
                      >
                        Mulai Pesanan Pertama Anda
                      </button>
                    </div>
                  ) : (
                    [...sessions.ongoing, ...sessions.upcoming, ...sessions.history].slice(0, 4).map(session => (
                      <div 
                        key={session.id} 
                        className="bg-bg-main border border-border-main rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-orange-primary/30 transition-all cursor-pointer group shadow-sm"
                        onClick={() => setView('orders')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-bg-sidebar rounded-2xl flex items-center justify-center text-text-muted border border-border-main group-hover:border-orange-primary/20 group-hover:text-orange-primary transition-all">
                              <Gamepad2 size={24} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-text-main leading-tight group-hover:text-orange-primary transition-colors">{session.title}</h4>
                              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">
                                {new Date(session.scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest ${
                            session.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            session.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500' :
                            session.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                            'bg-orange-primary/10 text-orange-primary'
                          }`}>
                            {session.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-border-main/50">
                          <div className="flex -space-x-2">
                            {[1, 2].map(i => (
                              <div key={i} className="w-6 h-6 rounded-full border-2 border-bg-main bg-bg-sidebar flex items-center justify-center overflow-hidden">
                                <img src={`https://picsum.photos/seed/${session.id + i}/24/24`} alt="Avatar" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                          <p className="text-sm font-bold text-text-main tracking-tight">Rp {session.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Info / CTA Section */}
              <div className="space-y-6 sm:space-y-8">
                <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                    <Zap size={120} />
                  </div>
                  <div className="w-24 h-24 bg-orange-primary/10 rounded-full flex items-center justify-center text-orange-primary shrink-0 border border-orange-primary/20 relative z-10">
                    <Trophy size={48} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xl sm:text-2xl font-bold text-text-main mb-3 leading-tight">Siap Naik <span className="text-orange-primary">Rank?</span></h3>
                    <p className="text-text-muted text-xs sm:text-sm leading-relaxed mb-8 font-medium">
                      Partner mabar terbaik menunggumu. Tingkatkan skill dan rank-mu sekarang!
                    </p>
                    <button 
                      onClick={() => setView('marketplace')}
                      className="w-full bg-orange-primary text-black font-bold px-10 py-5 rounded-2xl text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/20"
                    >
                      CARI PARTNER
                    </button>
                  </div>
                </div>

                <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 sm:p-10 space-y-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Star className="text-orange-primary" size={20} />
                    <h4 className="text-sm font-bold text-text-main uppercase tracking-widest">Tips Hari Ini</h4>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed font-medium italic">
                    "Komunikasi adalah kunci kemenangan. Pastikan kamu dan partner-mu selalu berkoordinasi saat in-game!"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showFullHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFullHistory(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[80vh] bg-bg-sidebar border border-border-main rounded-2xl p-10 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-bold text-text-main tracking-tighter uppercase">Detail <span className="text-orange-primary">History Pesanan.</span></h3>
                <button onClick={() => setShowFullHistory(false)} className="p-2 text-text-muted hover:text-orange-primary transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sessions.history.map(session => (
                  <div key={session.id} className="bg-bg-main border border-border-main rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-text-main">{session.title}</h4>
                        <p className="text-xs text-text-muted font-medium">Order #{session.id}</p>
                      </div>
                      <span className="text-orange-primary font-bold">Rp {(session.total_price || session.price).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-main">
                      <div>
                        <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Pelanggan</div>
                        <div className="text-sm font-bold text-text-main">{session.customer_name}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Tanggal</div>
                        <div className="text-sm font-bold text-text-main">{new Date(session.scheduled_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {view === 'etalase' && <EtalasePage user={stats || user} onRefreshStats={() => {
          // Trigger the fetchData function defined in the useEffect or make it accessible
      // Dispatch event to refresh stats globally
      try {
        window.dispatchEvent(new CustomEvent('refreshStats'));
      } catch (e) {
        console.warn('Failed to dispatch refreshStats event:', e);
      }
        }} globalGames={globalGames} />}

        {view === 'marketplace' && <MarketplacePage user={user} setView={setView} onOrderSuccess={() => setView('orders')} systemStatus={systemStatus} onOpenKijo={(id) => { setSelectedKijoId(id); setView('kijo-store'); }} />}

        {view === 'kijo-store' && selectedKijoId !== null && <KijoStorePage user={user} kijoId={selectedKijoId} onBack={() => setView('marketplace')} onOrderSuccess={() => { setSelectedKijoId(null); setView('orders'); }} systemStatus={systemStatus} />}
        
        {view === 'orders' && <OrdersPage user={user} globalGames={globalGames} onGoToMarketplace={() => setView('marketplace')} />}


        {view === 'notifications' && <NotificationPage user={user} onBadgeUpdate={(count) => setUnreadNotifications(count)} />}

        {view === 'traits' && <TraitsPage user={user} mode={mode} />}

        {view === 'account' && (
          showVerification ? (
            <KijoVerificationPage 
              user={user} 
              onBack={() => setShowVerification(false)} 
              onSuccess={() => {
                setShowVerification(false);
                fetchData();
              }} 
            />
          ) : (
            <AccountPage 
              user={user} 
              onLogout={handleLogout} 
              onStartVerification={() => setShowVerification(true)}
              setView={setView}
            />
          )
        )}
        
        {/* Order Action Modal */}
        <AnimatePresence>
          {orderActionModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOrderActionModal(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
              >
                <h3 className="text-2xl font-bold text-text-main mb-2 uppercase tracking-tight">
                  {orderActionModal.type === 'finish' ? 'Selesaikan Pesanan' : orderActionModal.type === 'start' ? 'Mulai Sesi' : 'Batalkan Pesanan'}
                </h3>
                <p className="text-text-muted text-sm mb-6">
                  {orderActionModal.type === 'finish'
                    ? 'Konfirmasi penyelesaian pesanan. Pelanggan akan diminta untuk juga menekan tombol selesai.'
                    : orderActionModal.type === 'start'
                      ? 'Konfirmasi untuk memulai sesi pengerjaan sekarang.'
                      : 'Berikan alasan pembatalan yang jelas untuk pelanggan.'}
                </p>

                {orderActionModal.type === 'cancel' && (
                  <textarea 
                    placeholder="Alasan pembatalan..."
                    className="w-full bg-bg-main border border-border-main rounded-xl p-4 text-sm text-text-main focus:outline-none focus:border-red-500 mb-6 h-32"
                    value={orderActionReason}
                    onChange={(e) => setOrderActionReason(e.target.value)}
                  />
                )}

                {orderActionModal.type === 'finish' && (
                  <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <p className="text-xs text-green-400 font-semibold">Pastikan bukti <b>Sebelum</b> dan <b>Sesudah</b> sudah diunggah di halaman detail pesanan sebelum menyelesaikan.</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={() => setOrderActionModal(null)}
                    className="flex-1 py-4 rounded-xl border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:bg-bg-main transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleKijoOrderAction}
                    disabled={isProcessingOrder || (orderActionModal.type === 'cancel' && !orderActionReason)}
                    className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                      orderActionModal.type === 'finish' 
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                        : orderActionModal.type === 'start'
                          ? 'bg-orange-primary text-black shadow-lg shadow-orange-primary/20'
                          : 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                    } disabled:opacity-50`}
                  >
                    {isProcessingOrder ? 'MEMPROSES...' : 'KONFIRMASI'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Rate Jokies Modal */}
        <AnimatePresence>
          {ratingJokiesSession && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRatingJokiesSession(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-text-main tracking-tighter uppercase">Beri Badge <span className="text-orange-primary">Jokies.</span></h3>
                  <button onClick={() => setRatingJokiesSession(null)} className="p-2 text-text-muted hover:text-orange-primary transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <p className="text-text-muted text-sm mb-6 font-medium">
                  Pilih badge reputasi untuk <span className="text-text-main font-bold">{ratingJokiesSession.customer_name}</span> berdasarkan pengalaman mabar Anda.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {JOKIES_TRAITS.map(tag => (
                    <button
                      key={tag.key}
                      onClick={() => {
                        setSelectedJokiesTags(prev => 
                          prev.includes(tag.key) ? prev.filter(t => t !== tag.key) : [...prev, tag.key]
                        );
                      }}
                      className={`p-3 rounded-xl border text-xs font-semibold uppercase tracking-wide transition-all flex flex-col items-center gap-2 ${
                        selectedJokiesTags.includes(tag.key)
                          ? 'bg-orange-primary border-orange-primary text-black'
                          : 'bg-bg-main border-border-main text-text-muted hover:border-text-muted/50'
                      }`}
                    >
                      {React.cloneElement(tag.icon as React.ReactElement<{ size?: number }>, { size: 18 })}
                      {tag.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={async () => {
                    const res = await fetchWithAuth('/api/kijo/rate-jokies', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        kijoId: user?.id,
                        jokiesId: ratingJokiesSession.jokies_id,
                        sessionId: ratingJokiesSession.id,
                        tags: selectedJokiesTags
                      })
                    });
                    if (res.ok) {
                      setRatingJokiesSession(null);
                      setSelectedJokiesTags([]);
                      showAlert('Badge berhasil diberikan!', 'success');
                    }
                  }}
                  className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20"
                >
                  KIRIM BADGE
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {view !== 'dashboard' && view !== 'etalase' && view !== 'notifications' && view !== 'traits' && view !== 'account' && view !== 'marketplace' && view !== 'orders' && view !== 'kijo-store' && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 bg-bg-sidebar rounded-full flex items-center justify-center mb-6 border border-border-main">
              <Settings className="text-text-muted" size={32} />
            </div>
            <h2 className="text-text-main font-bold text-xl mb-2">Halaman Sedang Dikembangkan</h2>
            <p className="text-text-muted text-sm max-w-xs">Fitur {view} akan segera hadir untuk melengkapi pengalaman Acinonyx Anda.</p>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

function GlobalAnnouncements({ announcements }: { announcements: any[] }) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {announcements.map((a) => (
        <motion.div 
          key={a.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden p-6 rounded-2xl border shadow-sm ${
            a.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
            a.type === 'warning' ? 'bg-orange-primary/10 border-orange-primary/20 text-orange-primary' :
            a.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
            'bg-green-500/10 border-green-500/20 text-green-400'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <Bell size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-tight mb-1">{a.title}</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">{a.content}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Kijo Order Detail full-page view (replaces modal) */
function KijoOrderDetailView({ selectedSession, user, showMobileChat, setShowMobileChat, proofBeforeData, setProofBeforeData, proofAfterData, setProofAfterData, onBack, onStart, onFinish, onCancel, showAlert, fetchData }: any) {
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isAgreeingCancel, setIsAgreeingCancel] = useState(false);
  const [isRejectingCancel, setIsRejectingCancel] = useState(false);
  const session = selectedSession;
  const isActive = ['ongoing', 'pending_completion', 'pending_cancellation'].includes(session.status);

  const computeCanStart = () => {
    if (session.status !== 'upcoming') return { can: false, text: '' };
    const diffMs = new Date(session.scheduled_at).getTime() - Date.now();
    if (diffMs / (1000 * 60) <= 15) return { can: true, text: '' };
    const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return { can: false, text: hours > 0 ? `(${hours}j ${mins}m)` : `(${mins}:${secs.toString().padStart(2, '0')})` };
  };

  const computeFinishAndCancel = () => {
    if (session.status !== 'ongoing') return { canFinish: false, canCancel: true, timerText: '', cancelText: '' };
    const startedAt = session.started_at ?? session.scheduled_at;
    const diffMs = Date.now() - new Date(startedAt).getTime();
    const diffMins = diffMs / (1000 * 60);
    const elapsed = diffMins >= 15;
    const hasProofs = !!(session.screenshot_start && session.screenshot_end);
    let timerText = '';
    let cancelText = '';
    if (!elapsed) {
      const remainingMs = (15 * 60 * 1000) - diffMs;
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      timerText = `${mins}:${secs.toString().padStart(2, '0')}`;
      cancelText = timerText;
    }
    return { canFinish: elapsed && hasProofs, canCancel: elapsed, timerText, cancelText };
  };

  const [startState, setStartState] = useState(computeCanStart);
  const [actionState, setActionState] = useState(computeFinishAndCancel);

  useEffect(() => {
    if (session.status !== 'upcoming') return;
    const interval = setInterval(() => setStartState(computeCanStart()), 1000);
    return () => clearInterval(interval);
  }, [session.status, session.scheduled_at]);

  useEffect(() => {
    if (session.status !== 'ongoing') return;
    const interval = setInterval(() => setActionState(computeFinishAndCancel()), 1000);
    return () => clearInterval(interval);
  }, [session.status, session.started_at, session.scheduled_at, session.screenshot_start, session.screenshot_end]);

  const handleAgreeCancel = async () => {
    setIsAgreeingCancel(true);
    try {
      const res = await fetchWithAuth('/api/orders/agree-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: session.id })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Pembatalan disetujui.', 'success');
        onBack();
        fetchData();
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
        body: JSON.stringify({ orderId: session.id })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Pembatalan ditolak. Masalah dieskalasi ke Admin.', 'warning');
        fetchData();
      } else {
        showAlert(data.message || 'Gagal menolak pembatalan', 'error');
      }
    } catch { showAlert('Terjadi kesalahan', 'error'); }
    finally { setIsRejectingCancel(false); }
  };

  const handleFileUpload = (setter: (v: string | null) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showAlert('Ukuran file maksimal 2MB', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleUploadProof = async () => {
    if (!proofBeforeData && !proofAfterData) {
      showAlert('Pilih minimal satu foto bukti', 'warning');
      return;
    }
    setIsUploadingProof(true);
    try {
      const res = await fetchWithAuth('/api/kijo/update-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: session.id,
          proofBefore: proofBeforeData || undefined,
          proofAfter: proofAfterData || undefined
        })
      });
      if (res.ok) {
        showAlert('Bukti pengerjaan berhasil diunggah!', 'success');
        setProofBeforeData(null);
        setProofAfterData(null);
        fetchData();
      } else {
        const data = await res.json();
        showAlert(data.message || 'Gagal mengunggah bukti', 'error');
      }
    } catch {
      showAlert('Gagal mengunggah bukti', 'error');
    } finally {
      setIsUploadingProof(false);
    }
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
    } catch { return null; }
  };

  // Mobile chat full page
  if (showMobileChat) {
    return (
      <div className="fixed inset-0 z-[120] bg-bg-main flex flex-col">
        <div className="p-4 border-b border-border-main bg-bg-sidebar flex items-center gap-3">
          <button onClick={() => setShowMobileChat(false)} className="p-2 text-text-muted hover:text-orange-primary">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="text-sm font-bold text-text-main">Chat Pesanan #{session.id}</h3>
            <p className="text-xs text-text-muted">{session.title}</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <OrderChat
            sessionId={session.id}
            userId={user.id}
            username={user.username || user.full_name}
            isActive={!['completed', 'cancelled'].includes(session.status)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest">
        <ChevronLeft size={16} /> Kembali ke Dashboard
      </button>

      <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-border-main bg-bg-card/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold bg-orange-primary/10 text-orange-primary px-2 py-1 rounded-md border border-orange-primary/20 uppercase tracking-widest">
                  ID: #{session.id}
                </span>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-md border uppercase tracking-widest ${statusColor(session.status)}`}>
                  {statusLabel(session.status)}
                </span>
              </div>
              <h2 className="text-xl md:text-3xl font-bold text-text-main tracking-tight">{session.title}</h2>
              <p className="text-text-muted text-xs mt-1">{session.game_title || 'Game Session'}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Pendapatan</p>
              <p className="text-2xl md:text-3xl font-bold text-orange-primary font-mono">Rp {(session.total_price || session.price).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Detail Pemesanan */}
            <div className="bg-bg-main/50 p-5 md:p-6 rounded-2xl border border-border-main">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar size={14} /> Detail Pemesanan
              </h3>
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <p className="text-xs text-text-muted font-bold uppercase">Jadwal Mabar</p>
                  <p className="text-sm font-bold text-orange-primary">{toJakartaDT(session.scheduled_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted font-bold uppercase">Durasi</p>
                  <p className="text-sm font-bold text-text-main">{formatDuration(session.duration)}</p>
                </div>
                {session.quantity > 1 && (
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase">Jumlah</p>
                    <p className="text-sm font-bold text-text-main">x{session.quantity}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rincian Pembayaran */}
            <div className="bg-bg-main/50 p-5 md:p-6 rounded-2xl border border-border-main">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <Wallet size={14} /> Rincian Pembayaran
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Harga Paket</span>
                  <span className="font-bold text-text-main">Rp {(session.price * (session.quantity || 1)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border-main">
                  <span className="font-bold text-text-main uppercase text-xs">Total Pendapatan</span>
                  <span className="font-bold text-orange-primary">Rp {(session.total_price || session.price).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <UserIcon size={14} /> Detail Jokies
                </h3>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-text-main">{session.jokies_name || session.jokies_username || session.customer_name}</p>
                  {session.status !== 'cancelled' && session.jokies_dynamic_data && renderDynamicData(session.jokies_dynamic_data)}
                </div>
              </div>
              <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-orange-primary" /> Detail Kijo
                </h3>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-text-main">{user.full_name || user.username}</p>
                  {session.status !== 'cancelled' && session.kijo_dynamic_data && renderDynamicData(session.kijo_dynamic_data)}
                </div>
              </div>
            </div>

            {/* Bukti Pengerjaan (Kijo can upload) */}
            {(isActive || session.status === 'completed') && (
              <div className="bg-bg-main/50 p-5 rounded-2xl border border-border-main">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ImageIcon size={14} /> Bukti Pengerjaan
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted font-bold uppercase text-center">Sebelum</p>
                    <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden relative group">
                      {proofBeforeData || session.screenshot_start ? (
                        <>
                          <img src={proofBeforeData || session.screenshot_start} className="w-full h-full object-cover" alt="Bukti sebelum" />
                          {isActive && (
                            <button onClick={() => handleFileUpload(setProofBeforeData)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                              Ganti Foto
                            </button>
                          )}
                        </>
                      ) : isActive ? (
                        <button onClick={() => handleFileUpload(setProofBeforeData)} className="w-full h-full flex flex-col items-center justify-center gap-1 hover:text-orange-primary transition-colors">
                          <ImageIcon size={20} className="text-text-muted" />
                          <span className="text-[10px] text-text-muted font-bold uppercase">Unggah</span>
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted italic">Tidak ada</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted font-bold uppercase text-center">Sesudah</p>
                    <div className="aspect-video bg-bg-sidebar rounded-xl border border-border-main flex items-center justify-center overflow-hidden relative group">
                      {proofAfterData || session.screenshot_end ? (
                        <>
                          <img src={proofAfterData || session.screenshot_end} className="w-full h-full object-cover" alt="Bukti sesudah" />
                          {isActive && (
                            <button onClick={() => handleFileUpload(setProofAfterData)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                              Ganti Foto
                            </button>
                          )}
                        </>
                      ) : isActive ? (
                        <button onClick={() => handleFileUpload(setProofAfterData)} className="w-full h-full flex flex-col items-center justify-center gap-1 hover:text-orange-primary transition-colors">
                          <ImageIcon size={20} className="text-text-muted" />
                          <span className="text-[10px] text-text-muted font-bold uppercase">Unggah</span>
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted italic">Tidak ada</span>
                      )}
                    </div>
                  </div>
                </div>
                {isActive && (proofBeforeData || proofAfterData) && (
                  <button onClick={handleUploadProof} disabled={isUploadingProof}
                    className="w-full mt-4 bg-orange-primary text-black font-bold py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/10 disabled:opacity-50"
                  >
                    {isUploadingProof ? 'MENGUNGGAH...' : 'SIMPAN BUKTI PENGERJAAN'}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4">
              {/* Upcoming: Start Session */}
              {session.status === 'upcoming' && (
                <>
                  <button
                    disabled={!startState.can}
                    onClick={() => onStart(session)}
                    className={`w-full font-bold py-4 rounded-xl text-xs uppercase tracking-widest transition-all ${
                      startState.can
                        ? 'bg-orange-primary text-black shadow-lg shadow-orange-primary/20 hover:scale-[1.02] cursor-pointer'
                        : 'bg-bg-card text-text-faint border border-border-main cursor-not-allowed opacity-60'
                    }`}
                  >
                    {startState.can ? 'MULAI SESI' : `MULAI SESI ${startState.text}`}
                  </button>
                  <button onClick={() => onCancel(session)}
                    className="w-full border border-red-500/30 text-red-500 font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-red-500/10 transition-all"
                  >
                    BATALKAN PESANAN
                  </button>
                </>
              )}

              {/* Ongoing: Finish + Cancel (both with 15-min lock) */}
              {session.status === 'ongoing' && (
                <>
                  <button
                    disabled={!actionState.canFinish}
                    onClick={() => onFinish(session)}
                    className={`w-full font-bold py-4 rounded-xl text-xs uppercase tracking-widest transition-all ${
                      actionState.canFinish
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/20 hover:scale-[1.02] cursor-pointer'
                        : 'bg-bg-card text-text-faint border border-border-main cursor-not-allowed opacity-60'
                    }`}
                  >
                    {!actionState.canFinish && actionState.timerText
                      ? `SELESAIKAN PESANAN (${actionState.timerText})`
                      : !actionState.canFinish
                        ? 'SELESAIKAN PESANAN (butuh bukti)'
                        : 'SELESAIKAN PESANAN'}
                  </button>
                  {!actionState.canFinish && (
                    <p className="text-xs text-text-muted text-center">
                      {!session.screenshot_start || !session.screenshot_end
                        ? 'Upload bukti sebelum & sesudah terlebih dahulu'
                        : `Tombol aktif ${actionState.timerText} lagi`}
                    </p>
                  )}
                  <button
                    disabled={!actionState.canCancel}
                    onClick={() => { if (actionState.canCancel) onCancel(session); }}
                    className={`w-full border font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all ${
                      actionState.canCancel
                        ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                        : 'border-border-main text-text-faint cursor-not-allowed opacity-50'
                    }`}
                  >
                    {actionState.canCancel ? 'BATALKAN PESANAN' : `BATALKAN (${actionState.cancelText})`}
                  </button>
                </>
              )}

              {/* Pending Completion: waiting for Jokies */}
              {session.status === 'pending_completion' && (
                <div className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-center">
                  MENUNGGU KONFIRMASI PELANGGAN
                </div>
              )}

              {/* Pending Cancellation: agree/reject UI */}
              {session.status === 'pending_cancellation' && (
                <div className="space-y-3">
                  {session.cancel_escalated ? (
                    <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-center">
                      SENGKETA — MENUNGGU KEPUTUSAN ADMIN
                    </div>
                  ) : session.cancelled_by === 'kijo' ? (
                    <div className="w-full bg-orange-primary/10 border border-orange-primary/20 text-orange-primary font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-center">
                      MENUNGGU PERSETUJUAN PELANGGAN
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-text-muted text-center">
                        Pelanggan meminta pembatalan: <span className="text-text-main italic">"{session.cancellation_reason}"</span>
                      </p>
                      <button onClick={handleAgreeCancel} disabled={isAgreeingCancel}
                        className="w-full bg-red-500 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50"
                      >
                        {isAgreeingCancel ? 'MEMPROSES...' : 'SETUJUI PEMBATALAN'}
                      </button>
                      <button onClick={handleRejectCancel} disabled={isRejectingCancel}
                        className="w-full border border-border-main text-text-muted font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-bg-card transition-all disabled:opacity-50"
                      >
                        {isRejectingCancel ? 'MEMPROSES...' : 'TOLAK (ESKALASI KE ADMIN)'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat */}
          {session.status !== 'pending' && (
            <div className="space-y-6 self-start">
              <div className="hidden lg:block lg:sticky lg:top-4">
                <OrderChat
                  sessionId={session.id}
                  userId={user.id}
                  username={user.username || user.full_name}
                  isActive={!['completed', 'cancelled'].includes(session.status)}
                />
              </div>
              <div className="lg:hidden">
                <button onClick={() => setShowMobileChat(true)}
                  className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/10"
                >
                  <MessageSquare size={18} /> BUKA CHAT PESANAN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Floating indicator showing active order - like Gojek's floating ride widget */
function FloatingOrderIndicator({ user, mode, view, selectedSession, selectedOrder, onNavigate }: any) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchWithAuth('/api/orders/active-session');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.hasActive) {
          setActiveSession(data.session);
        } else {
          setActiveSession(null);
        }
      } catch { /* ignore */ }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!activeSession) { setVisible(false); return; }
    // Hide when already viewing the order details
    const isViewingKijoOrder = mode === 'kijo' && view === 'dashboard' && selectedSession?.id === activeSession.id;
    const isViewingJokiesOrder = mode === 'jokies' && view === 'orders' && selectedOrder?.id === activeSession.id;
    setVisible(!isViewingKijoOrder && !isViewingJokiesOrder);
  }, [activeSession, mode, view, selectedSession, selectedOrder]);

  if (!visible || !activeSession) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-20 md:bottom-6 right-4 md:right-8 z-[90]"
    >
      <button
        onClick={() => onNavigate(activeSession)}
        className="flex items-center gap-3 bg-orange-primary text-black pl-4 pr-5 py-3 rounded-2xl shadow-xl shadow-orange-primary/30 hover:scale-105 transition-all"
      >
        <div className="w-9 h-9 bg-black/10 rounded-xl flex items-center justify-center">
          <Gamepad2 size={20} />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold truncate max-w-[140px]">{activeSession.title}</p>
          <p className="text-[10px] font-semibold opacity-70">{statusLabel(activeSession.status)}</p>
        </div>
        {activeSession.unread_count > 0 && (
          <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {activeSession.unread_count > 9 ? '9+' : activeSession.unread_count}
          </span>
        )}
      </button>
    </motion.div>
  );
}
