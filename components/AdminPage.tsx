import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  PackageSearch, 
  ShieldAlert, 
  TrendingUp, 
  DollarSign, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  XCircle, 
  History, 
  Eye, 
  MessageSquare, 
  Send,
  Clock,
  Key,
  ShieldCheck,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Settings2,
  LogOut,
  Bell,
  Moon,
  Sun,
  Save,
  Edit2,
  Menu,
  X,
  Gamepad2,
  Plus,
  Trash2,
  Zap,
  ArrowUpRight,
  Calendar,
  Megaphone,
  ScrollText,
  Wallet,
  Banknote,
  BarChart3,
  ExternalLink,
  Ban,
  Unlock,
  UserCog,
  Phone,
  Mail,
  Lock,
  EyeOff,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar
} from 'recharts';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface AdminPageProps {
  user: any;
  onLogout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  globalGames?: any[];
}

type AdminView = 'dashboard' | 'users' | 'orders' | 'financials' | 'security' | 'notifications' | 'announcements' | 'games' | 'maintenance' | 'audit' | 'profile';

export default function AdminPage({ user, onLogout, theme, toggleTheme, globalGames = [] }: AdminPageProps) {
  const [view, setView] = useState<AdminView>('dashboard');
  const [adminUser, setAdminUser] = useState(user);
  const [stats, setStats] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>({ kijos: [], jokies: [] });
  const [sessionsData, setSessionsData] = useState<any>({ upcoming: [], ongoing: [], disputes: [], history: [] });
  const [securityData, setSecurityData] = useState<any>({ otps: [], chats: [], kijoApplications: [], chatSessions: [] });
  const [games, setGames] = useState<any[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const endpoints = [
        { key: 'stats', url: '/api/admin/stats', setter: setStats },
        { key: 'users', url: '/api/admin/users', setter: (data: any) => data?.kijos && setUsersData(data) },
        { key: 'sessions', url: '/api/admin/sessions', setter: (data: any) => data?.upcoming && setSessionsData(data) },
        { key: 'games', url: '/api/admin/games', setter: (data: any) => Array.isArray(data) && setGames(data) },
        { key: 'otps', url: '/api/admin/otps', setter: (data: any) => setSecurityData((prev: any) => ({ ...prev, otps: Array.isArray(data) ? data : [] })) },
        { key: 'kijoApplications', url: '/api/admin/kijo-applications', setter: (data: any) => setSecurityData((prev: any) => ({ ...prev, kijoApplications: Array.isArray(data) ? data : [] })) },
        { key: 'notifications', url: '/api/admin/notifications', setter: (data: any) => Array.isArray(data) && setAdminNotifications(data) },
        { key: 'chats', url: '/api/admin/chats', setter: (data: any) => setSecurityData((prev: any) => ({ ...prev, chats: Array.isArray(data) ? data : [] })) },
        { key: 'chatSessions', url: '/api/admin/chat-sessions', setter: (data: any) => setSecurityData((prev: any) => ({ ...prev, chatSessions: Array.isArray(data) ? data : [] })) },
        { key: 'financials', url: '/api/admin/financials', setter: setFinancials },
        { key: 'withdrawals', url: '/api/admin/withdrawals', setter: (data: any) => Array.isArray(data) && setWithdrawals(data) },
        { key: 'announcements', url: '/api/admin/announcements', setter: (data: any) => Array.isArray(data) && setAnnouncements(data) },
        { key: 'auditLogs', url: '/api/admin/audit-logs', setter: (data: any) => Array.isArray(data) && setAuditLogs(data) }
      ];

      await Promise.all(endpoints.map(async (endpoint) => {
        try {
          const res = await fetchWithAuth(endpoint.url);
          if (res.ok) {
            const data = await res.json();
            endpoint.setter(data);
          } else {
            console.warn(`Admin Fetch Warning: ${endpoint.key} returned ${res.status}`);
          }
        } catch (e) {
          console.error(`Admin Fetch Error for ${endpoint.key}:`, e);
        }
      }));

    } catch (error) {
      console.error('Admin Data Fetch Critical Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    
    const handleRefresh = () => fetchData();
    window.addEventListener('refreshAdminData', handleRefresh);
    
    const interval = setInterval(fetchData, 60000); // Auto refresh every minute
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshAdminData', handleRefresh);
    };
  }, []);

  const handleSuspend = async (userId: number, currentStatus: number) => {
    if (!confirm(`Apakah Anda yakin ingin ${currentStatus ? 'mengaktifkan' : 'menonaktifkan'} user ini?`)) return;
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend: !currentStatus })
      });
      if (res.ok) fetchData();
    } catch (error) {
      alert('Gagal mengubah status user');
    }
  };

  const handleVerify = async (userId: number) => {
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/verify`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (error) {
      alert('Gagal memverifikasi user');
    }
  };

  const handleForceComplete = async (sessionId: number) => {
    if (!confirm('Paksa selesaikan pesanan ini? Dana akan langsung diteruskan ke KIJO.')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/sessions/${sessionId}/complete`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (error) {
      alert('Gagal menyelesaikan pesanan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-orange-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-primary/20" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-text-main tracking-tighter uppercase">MINOX <span className="text-orange-primary">CONTROLLER.</span></h2>
          <p className="text-text-muted text-xs font-bold tracking-widest uppercase animate-pulse">Mengautentikasi Akses Internal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-bg-main text-text-main font-sans selection:bg-orange-primary selection:text-black ${theme}`}>
      {/* Sidebar Navigation - Hidden on mobile/tablet by default */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] xl:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed left-0 top-0 bottom-0 w-72 bg-bg-sidebar border-r border-border-main z-[70] flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        <div className="p-8 border-b border-border-main shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-primary rounded-xl flex items-center justify-center shadow-lg shadow-orange-primary/20">
                <ShieldCheck className="text-black" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none">MINOX.</h1>
                <p className="text-xs font-bold text-orange-primary uppercase tracking-widest mt-1">Minox Panel</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="xl:hidden text-text-muted hover:text-text-main p-2">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <nav className="space-y-2">
            <SidebarLink 
              active={view === 'dashboard'} 
              onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
            />
            <SidebarLink 
              active={view === 'users'} 
              onClick={() => { setView('users'); setIsSidebarOpen(false); }} 
              icon={<Users size={20} />} 
              label="Users" 
            />
            <SidebarLink 
              active={view === 'orders'} 
              onClick={() => { setView('orders'); setIsSidebarOpen(false); }} 
              icon={<PackageSearch size={20} />} 
              label="Orders" 
            />
            <SidebarLink 
              active={view === 'financials'} 
              onClick={() => { setView('financials'); setIsSidebarOpen(false); }} 
              icon={<Wallet size={20} />} 
              label="Financials" 
            />
            <SidebarLink 
              active={view === 'security'} 
              onClick={() => { setView('security'); setIsSidebarOpen(false); }} 
              icon={<ShieldAlert size={20} />} 
              label="Security" 
            />
            <SidebarLink 
              active={view === 'notifications'} 
              onClick={() => { setView('notifications'); setIsSidebarOpen(false); }} 
              icon={<Bell size={20} />} 
              label="Alerts" 
            />
            <SidebarLink 
              active={view === 'announcements'} 
              onClick={() => { setView('announcements'); setIsSidebarOpen(false); }} 
              icon={<Megaphone size={20} />} 
              label="Banners" 
            />
            <SidebarLink 
              active={view === 'games'} 
              onClick={() => { setView('games'); setIsSidebarOpen(false); }} 
              icon={<Gamepad2 size={20} />} 
              label="Games" 
            />
            <SidebarLink 
              active={view === 'maintenance'} 
              onClick={() => { setView('maintenance'); setIsSidebarOpen(false); }} 
              icon={<Clock size={20} />} 
              label="Maintenance" 
            />
            <SidebarLink
              active={view === 'audit'}
              onClick={() => { setView('audit'); setIsSidebarOpen(false); }}
              icon={<ScrollText size={20} />}
              label="Audit Logs"
            />
            <SidebarLink
              active={view === 'profile'}
              onClick={() => { setView('profile'); setIsSidebarOpen(false); }}
              icon={<UserCog size={20} />}
              label="Profil Minox"
            />
          </nav>
        </div>

        <div className="p-8 border-t border-border-main bg-bg-main/50 shrink-0">
          <button
            onClick={() => { setView('profile'); setIsSidebarOpen(false); }}
            className="flex items-center gap-4 mb-6 w-full text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 rounded-2xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden shrink-0">
              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${adminUser.username}`} alt="Minox" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate uppercase tracking-tight">{adminUser.full_name}</p>
              <p className="text-xs text-text-muted font-medium truncate">{adminUser.email}</p>
            </div>
          </button>
          <button 
            onClick={onLogout}
            className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Logout System
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="xl:pl-72 min-h-screen pb-6 lg:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 bg-bg-main/80 backdrop-blur-xl border-b border-border-main z-40 px-4 md:px-10 py-4 md:py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden p-2 rounded-lg bg-bg-sidebar border border-border-main text-text-muted hover:text-orange-primary transition-all shadow-sm"
            >
              <Menu size={20} />
            </button>
            
            {/* Logo for mobile - icon only */}
            <div className="lg:hidden flex items-center justify-center w-10 h-10 bg-orange-primary rounded-xl shadow-lg shadow-orange-primary/20">
              <ShieldCheck className="text-black" size={24} />
            </div>

            <div className="hidden sm:block">
              <h2 className="text-sm md:text-2xl font-bold uppercase truncate max-w-[150px] md:max-w-none">
                {view === 'dashboard' && 'Dashboard'}
                {view === 'users' && 'Users'}
                {view === 'orders' && 'Orders'}
                {view === 'security' && 'Security'}
                {view === 'notifications' && 'Alerts'}
                {view === 'games' && 'Games'}
                {view === 'maintenance' && 'Maintenance'}
              </h2>
              <p className="text-text-muted text-[11px] md:text-xs font-bold uppercase tracking-widest mt-0.5 md:mt-1 hidden md:block">
                Data diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Logout button - visible on all devices now, but icon-only on mobile */}
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 p-2 md:p-3 rounded-lg md:rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Logout"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wide">Logout</span>
            </button>
            
            <button 
              onClick={toggleTheme}
              className="p-2 md:p-3 rounded-lg md:rounded-xl bg-bg-sidebar border border-border-main text-text-muted hover:text-orange-primary transition-all shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={fetchData}
              disabled={refreshing}
              className={`p-2 md:p-3 rounded-lg md:rounded-xl bg-bg-sidebar border border-border-main text-text-muted hover:text-orange-primary transition-all shadow-sm ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={20} />
            </button>
            <div className="h-8 md:h-10 w-[1px] bg-border-main mx-1 md:mx-2" />
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[11px] md:text-xs font-bold text-green-500 uppercase tracking-widest hidden sm:inline">Optimal</span>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="p-4 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {view === 'dashboard' && <DashboardView stats={stats} onRefresh={fetchData} games={games} />}
              {view === 'users' && <UsersView data={usersData} onSuspend={handleSuspend} onVerify={handleVerify} onDetail={setSelectedUserDetail} />}
              {view === 'orders' && <OrdersView data={sessionsData} onForceComplete={handleForceComplete} globalGames={globalGames} />}
              {view === 'financials' && <FinancialsView data={financials} withdrawals={withdrawals} onRefresh={fetchData} adminId={user.id} />}
              {view === 'security' && <SecurityView data={securityData} sessionsData={sessionsData} />}
              {view === 'notifications' && <AdminNotificationsView notifications={adminNotifications} onRefresh={fetchData} />}
              {view === 'announcements' && <AnnouncementsView data={announcements} onRefresh={fetchData} adminId={user.id} />}
              {view === 'games' && <GamesManagementView games={games} onRefresh={fetchData} />}
              {view === 'maintenance' && <MaintenanceView onRefresh={fetchData} />}
              {view === 'audit' && <AuditLogsView data={auditLogs} />}
              {view === 'profile' && <MinoxProfileView user={adminUser} onUpdate={(updated) => setAdminUser(updated)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUserDetail && (
          <UserDetailModal 
            userId={selectedUserDetail.id} 
            onClose={() => setSelectedUserDetail(null)} 
            onRefresh={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminNotificationsView({ notifications, onRefresh }: { notifications: any[]; onRefresh: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight">System Alerts</h3>
          <p className="text-text-muted text-xs md:text-xs font-bold uppercase tracking-widest">Notifikasi sistem dan aktivitas platform</p>
        </div>
        <button
          onClick={async () => {
            await fetchWithAuth(`/api/admin/notifications/read-all`, { method: 'POST' });
            onRefresh();
          }}
          className="px-6 py-3 rounded-xl bg-bg-sidebar border border-border-main text-text-muted hover:text-orange-primary transition-all text-xs font-semibold uppercase tracking-wide w-full md:w-auto"
        >
          Mark All as Read
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {notifications.map((n) => (
          <div key={n.id} className={`bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 shadow-sm flex gap-4 md:gap-8 items-start hover:border-orange-primary/20 transition-all ${!n.is_read ? 'border-l-4 border-l-orange-primary' : ''}`}>
            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${
              n.type === 'order_new' ? 'bg-blue-500/10 text-blue-500' :
              n.type === 'system' ? 'bg-orange-primary/10 text-orange-primary' :
              'bg-bg-main text-text-muted'
            }`}>
              {n.type === 'order_new' ? <PackageSearch size={24} /> : <Bell size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1 gap-4">
                <h4 className="text-xs md:text-sm font-bold uppercase tracking-tight truncate">{n.title}</h4>
                <span className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest whitespace-nowrap">{new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p className="text-xs md:text-xs text-text-muted leading-relaxed mb-4">{n.message}</p>
              <div className="flex items-center gap-2">
                <span className="bg-bg-main px-2 py-0.5 rounded text-[11px] md:text-[11px] font-bold text-text-muted uppercase tracking-widest border border-border-main">
                  {n.type}
                </span>
                {n.user_name && (
                  <span className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest">
                    Target: {n.user_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="py-32 text-center bg-bg-sidebar border border-dashed border-border-main rounded-2xl">
            <Bell className="text-text-muted mx-auto mb-4 opacity-10" size={64} />
            <p className="text-text-muted text-sm font-semibold uppercase tracking-wide">Belum ada notifikasi sistem</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${
        active 
          ? 'bg-orange-primary text-black shadow-lg shadow-orange-primary/20' 
          : 'text-text-muted hover:bg-bg-sidebar hover:text-text-main'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function BottomNavLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
        active 
          ? 'text-orange-primary' 
          : 'text-text-muted hover:text-text-main'
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

// --- SUB-VIEWS ---

function DashboardView({ stats, onRefresh, games }: { stats: any, onRefresh: () => void, games: any[] }) {
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [newFee, setNewFee] = useState(stats?.adminFee || 10);
  const [saving, setSaving] = useState(false);

  if (!stats) return null;

  const handleSaveFee = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_fee: newFee })
      });
      if (res.ok) {
        setIsEditingFee(false);
        onRefresh();
      }
    } catch (error) {
      alert('Gagal menyimpan biaya admin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Game Management Quick Access - Replaces Welcome Box */}
      <div className="bg-gradient-to-br from-bg-sidebar to-bg-main border border-border-main rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Gamepad2 size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-xl md:text-4xl font-bold uppercase mb-2">
              Manajemen <span className="text-orange-primary">Game.</span>
            </h1>
            <p className="text-text-muted text-xs md:text-sm font-bold uppercase tracking-widest max-w-md leading-relaxed">
              Daftar game aktif di sistem. Game ini akan muncul di registrasi, filter marketplace, dan etalase kijo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {games.slice(0, 4).map(game => (
              <span key={game.id} className="px-4 py-2 bg-bg-main border border-border-main rounded-xl text-xs font-semibold uppercase tracking-wide text-text-main">
                {game.name}
              </span>
            ))}
            {games.length > 4 && (
              <span className="px-4 py-2 bg-bg-main border border-border-main rounded-xl text-xs font-semibold uppercase tracking-wide text-text-muted">
                +{games.length - 4} Lainnya
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        <StatCard 
          icon={<DollarSign className="text-blue-400" />} 
          label="Total Omzet" 
          value={`Rp ${stats.totalOmzet?.toLocaleString() || '0'}`} 
          trend="Pendapatan Kotor Sistem"
          color="blue"
        />
        <div className="relative group">
          <StatCard 
            icon={<TrendingUp className="text-orange-primary" />} 
            label="Profit Minox"
            value={`Rp ${stats.profitAdmin?.toLocaleString() || '0'}`} 
            trend={`Biaya Layanan: ${stats.adminFee || '10'}%`}
            color="orange"
          />
          <button 
            onClick={() => { setIsEditingFee(true); setNewFee(stats.adminFee || 10); }}
            className="absolute top-4 right-4 p-2 rounded-lg bg-bg-main border border-border-main text-text-muted hover:text-orange-primary opacity-0 group-hover:opacity-100 transition-all"
          >
            <Edit2 size={14} />
          </button>
        </div>
        <StatCard 
          icon={<Users className="text-green-400" />} 
          label="Statistik User" 
          value={`${stats.stats.kijo} KIJO / ${stats.stats.jokies} JOKIES`} 
          trend="Akun Aktif Terverifikasi"
          color="green"
        />
        <StatCard 
          icon={<AlertTriangle className="text-red-400" />} 
          label="Pesanan Dibatalkan" 
          value={stats.cancellationStats} 
          trend="Total Kasus Sengketa"
          color="red"
        />
      </div>

      {/* Admin Fee Edit Modal */}
      <AnimatePresence>
        {isEditingFee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingFee(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Atur Fee Platform</h3>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mb-6">Biaya ini akan dikenakan pada setiap transaksi baru.</p>
              
              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Persentase Biaya (%)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={newFee}
                      onChange={(e) => setNewFee(parseInt(e.target.value) || 0)}
                      className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all pr-12"
                      placeholder="Contoh: 10"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditingFee(false)}
                  className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:text-text-main transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveFee}
                  disabled={saving}
                  className="flex-1 py-4 rounded-2xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-orange-primary/20 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-10 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Tren Pesanan</h3>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">Harian (30 Hari Terakhir)</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-orange-primary/10 text-orange-primary text-xs font-bold rounded-lg border border-orange-primary/20 uppercase">Harian</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyTrends}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF9F1C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF9F1C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2D2D2D', borderRadius: '12px' }}
                  itemStyle={{ color: '#FF9F1C', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="count" stroke="#FF9F1C" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-10 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Jam Paling Ramai</h3>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">Distribusi Pesanan per Jam</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-400/10 text-blue-400 text-xs font-bold rounded-lg border border-blue-400/20 uppercase">Peak Times</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
                <XAxis dataKey="hour" stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}:00`} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2D2D2D', borderRadius: '12px' }}
                  labelFormatter={(val) => `Jam ${val}:00`}
                />
                <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Long-term Trends */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-10 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Pertumbuhan Bulanan</h3>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">Total Pesanan dari Bulan ke Bulan</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-green-400/10 text-green-400 text-xs font-bold rounded-lg border border-green-400/20 uppercase">Monthly</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
              <XAxis dataKey="month" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2D2D2D', borderRadius: '12px' }}
              />
              <Line type="monotone" dataKey="count" stroke="#4ADE80" strokeWidth={3} dot={{ fill: '#4ADE80', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: any) {
  const colorClasses: any = {
    orange: 'bg-orange-primary/10 border-orange-primary/20 text-orange-primary',
    blue: 'bg-blue-400/10 border-blue-400/20 text-blue-400',
    green: 'bg-green-400/10 border-green-400/20 text-green-400',
    red: 'bg-red-400/10 border-red-400/20 text-red-400'
  };

  return (
    <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-5 md:p-8 shadow-sm hover:border-orange-primary/30 transition-all group">
      <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center border mb-4 md:mb-6 transition-transform group-hover:scale-110 duration-500 ${colorClasses[color]}`}>
        {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 18 })}
      </div>
      <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-1 md:mb-2">{label}</p>
      <h4 className="text-lg md:text-2xl font-bold mb-2 md:mb-4">{value}</h4>
      <p className="text-[11px] md:text-xs font-bold text-text-muted italic">{trend}</p>
    </div>
  );
}

function UsersView({ data, onSuspend, onVerify, onDetail }: { data: any, onSuspend: any, onVerify: any, onDetail: (u: any) => void }) {
  const [activeTab, setActiveTab] = useState<'kijo' | 'jokies' | 'verification'>('kijo');
  const safeKijos: any[] = Array.isArray(data?.kijos) ? data.kijos : [];
  const safeJokies: any[] = Array.isArray(data?.jokies) ? data.jokies : [];

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex gap-2 md:gap-4 bg-bg-sidebar border border-border-main p-1.5 md:p-2 rounded-xl md:rounded-2xl w-full sm:w-fit shadow-sm overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('kijo')}
          className={`flex-1 sm:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'kijo' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          KIJO
        </button>
        <button 
          onClick={() => setActiveTab('jokies')}
          className={`flex-1 sm:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'jokies' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          JOKIES
        </button>
        <button 
          onClick={() => setActiveTab('verification')}
          className={`flex-1 sm:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'verification' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          Verifikasi
        </button>
      </div>

      {/* Content Table */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
            <thead>
              <tr className="bg-bg-main/50 border-b border-border-main">
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs md:text-xs font-semibold uppercase tracking-wide text-text-muted">User Profile</th>
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs md:text-xs font-semibold uppercase tracking-wide text-text-muted">Status / Info</th>
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs md:text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {activeTab === 'kijo' && safeKijos.map((u: any) => (
                <tr key={u.id} className="hover:bg-bg-main/30 transition-colors group">
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="Avatar" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-tight truncate">{u.full_name}</p>
                        <p className="text-xs md:text-xs text-text-muted font-bold truncate">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div>
                        <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Rating</p>
                        <div className="flex items-center gap-1">
                          <StarIcon size={10} className="text-orange-primary fill-orange-primary" />
                          <span className="text-xs md:text-xs font-bold">{u.rating?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Usia</p>
                        <span className="text-xs md:text-xs font-bold">{u.birth_date ? new Date().getFullYear() - new Date(u.birth_date).getFullYear() : '—'} Thn</span>
                      </div>
                      {u.is_suspended === 1 && (
                        <span className="bg-red-500/10 text-red-500 text-[11px] md:text-[11px] font-bold px-1.5 md:px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-widest">Suspended</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onDetail(u)}
                        className="p-2 rounded-lg bg-bg-main border border-border-main text-text-muted hover:text-orange-primary transition-all"
                        title="Detail User"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => onSuspend(u.id, u.is_suspended)}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[11px] md:text-xs font-semibold uppercase tracking-wide transition-all ${u.is_suspended ? 'bg-green-500 text-black' : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                      >
                        {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {activeTab === 'jokies' && safeJokies.map((u: any) => (
                <tr key={u.id} className="hover:bg-bg-main/30 transition-colors group">
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="Avatar" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-tight truncate">{u.full_name}</p>
                        <p className="text-xs md:text-xs text-text-muted font-bold truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div>
                        <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Total Pesanan</p>
                        <span className="text-xs md:text-xs font-bold">{u.total_orders} Order</span>
                      </div>
                      {u.is_suspended === 1 && (
                        <span className="bg-red-500/10 text-red-500 text-[11px] md:text-[11px] font-bold px-1.5 md:px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-widest">Suspended</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onDetail(u)}
                        className="p-2 rounded-lg bg-bg-main border border-border-main text-text-muted hover:text-orange-primary transition-all"
                        title="Detail User"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => onSuspend(u.id, u.is_suspended)}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[11px] md:text-xs font-semibold uppercase tracking-wide transition-all ${u.is_suspended ? 'bg-green-500 text-black' : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                      >
                        {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {activeTab === 'verification' && safeKijos.filter((u: any) => u.is_verified === 0).map((u: any) => (
                <tr key={u.id} className="hover:bg-bg-main/30 transition-colors group">
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="Avatar" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-tight truncate">{u.full_name}</p>
                        <p className="text-xs md:text-xs text-text-muted font-bold truncate">Tgl Lahir: {u.birth_date}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div>
                      <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Usia Terdeteksi</p>
                      <span className={`text-xs md:text-xs font-bold ${!u.birth_date || new Date().getFullYear() - new Date(u.birth_date).getFullYear() >= 15 ? 'text-green-500' : 'text-red-500'}`}>
                        {u.birth_date ? `${new Date().getFullYear() - new Date(u.birth_date).getFullYear()} Tahun` : 'Tidak Diisi'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <button 
                      onClick={() => onVerify(u.id)}
                      className="px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl bg-orange-primary text-black text-[11px] md:text-xs font-semibold uppercase tracking-wide shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all"
                    >
                      Verifikasi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(activeTab === 'verification' && safeKijos.filter((u: any) => u.is_verified === 0).length === 0) && (
          <div className="py-12 md:py-20 text-center">
            <CheckCircle2 className="text-text-muted mx-auto mb-4 opacity-20" size={48} />
            <p className="text-text-muted text-xs md:text-xs font-bold uppercase tracking-widest">Semua KIJO telah terverifikasi</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersView({ data, onForceComplete, globalGames }: { data: any, onForceComplete: any, globalGames: any[] }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'ongoing' | 'disputes' | 'history'>('ongoing');
  const [sortBy, setSortBy] = useState<'date' | 'rank'>('date');

  const getRankPriority = (gameTitle: string, rankName: string) => {
    const game = globalGames.find(g => g.name === gameTitle);
    if (!game || !game.ranks) return 0;
    
    // Flatten ranks to get a simple list for priority
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
        return priorityB - priorityA; // Higher rank first
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher & Sort */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2 md:gap-4 bg-bg-sidebar border border-border-main p-1.5 md:p-2 rounded-xl md:rounded-2xl w-full sm:w-fit shadow-sm overflow-x-auto no-scrollbar">
          {['upcoming', 'ongoing', 'disputes', 'history'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 sm:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === tab ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
            >
              {tab === 'upcoming' && 'Mendatang'}
              {tab === 'ongoing' && 'Berjalan'}
              {tab === 'disputes' && 'Sengketa'}
              {tab === 'history' && 'History'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-bg-sidebar border border-border-main p-1.5 md:p-2 rounded-xl md:rounded-2xl shadow-sm">
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
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'ongoing' && sortOrders(data.ongoing).map((s: any) => (
          <OrderMonitorCard key={s.id} session={s} onForceComplete={onForceComplete} />
        ))}
        {activeTab === 'disputes' && data.disputes.map((s: any) => (
          <DisputeCard key={s.id} session={s} />
        ))}
        {activeTab === 'upcoming' && sortOrders(data.upcoming).map((s: any) => (
          <OrderMonitorCard key={s.id} session={s} />
        ))}
        {activeTab === 'history' && sortOrders(data.history).map((s: any) => (
          <OrderMonitorCard key={s.id} session={s} isHistory />
        ))}
      </div>
    </div>
  );
}

function OrderMonitorCard({ session, onForceComplete, isHistory }: { session: any, onForceComplete?: any, isHistory?: boolean, key?: any }) {
  const scheduledDate = new Date(session.scheduled_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return (
    <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-4 md:p-8 shadow-sm group hover:border-orange-primary/20 transition-all">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start lg:items-center">
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <span className="bg-bg-main border border-border-main px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest">#{session.id}</span>
            <h4 className="text-sm md:text-lg font-bold uppercase tracking-tight truncate flex-1">
              {session.game_title} {session.quantity > 1 ? `(x${session.quantity})` : ''}
            </h4>
            <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg text-[11px] md:text-[11px] font-semibold uppercase tracking-wide ${
              session.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
              session.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
              'bg-orange-primary/10 text-orange-primary border border-orange-primary/20'
            }`}>
              {session.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <div>
              <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">KIJO / JOKIES</p>
              <p className="text-xs md:text-xs font-bold truncate">{session.kijo_nickname || 'KIJO'} / {session.jokies_nickname || 'JOKIES'}</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Jadwal Sesi</p>
              <p className="text-xs md:text-xs font-bold">{scheduledDate.toLocaleDateString('id-ID')} - {scheduledDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Durasi</p>
              <p className={`text-xs md:text-xs font-bold ${diffDays >= 7 ? 'text-red-500' : 'text-text-main'}`}>{diffDays} Hari</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Total</p>
              <p className="text-xs md:text-xs font-bold text-orange-primary">Rp {session.total_price?.toLocaleString() || '0'}</p>
            </div>
            {session.rank_start && (
              <div>
                <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Rank Awal</p>
                <p className="text-xs md:text-xs font-bold">{session.rank_start}</p>
              </div>
            )}
            {session.rank_end && (
              <div>
                <p className="text-[11px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">Rank Akhir</p>
                <p className="text-xs md:text-xs font-bold">{session.rank_end}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 shrink-0 w-full lg:w-auto mt-2 lg:mt-0">
          {session.status === 'ongoing' && diffDays >= 7 && (
            <button 
              onClick={() => onForceComplete(session.id)}
              className="flex-1 lg:flex-none px-4 md:px-6 py-2.5 md:py-4 rounded-xl md:rounded-2xl bg-orange-primary text-black font-bold text-xs md:text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all"
            >
              Force Complete
            </button>
          )}
          <button className="flex-1 lg:flex-none p-2.5 md:p-4 rounded-xl md:rounded-2xl bg-bg-main border border-border-main text-text-muted hover:text-orange-primary transition-all flex items-center justify-center">
            <Eye size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DisputeCard({ session }: { session: any, key?: any }) {
  return (
    <div className="bg-bg-sidebar border border-red-500/20 rounded-2xl p-8 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <AlertTriangle size={80} className="text-red-500" />
      </div>
      
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-lg font-bold uppercase tracking-tight">Pengajuan Pembatalan #{session.id}</h4>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Dibatalkan pada: {session.cancelled_at ? new Date(session.cancelled_at).toLocaleString('id-ID') : '-'}</p>
            </div>
          </div>

          <div className="bg-bg-main/50 rounded-2xl p-6 border border-border-main">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Alasan Pembatalan:</p>
            <p className="text-sm font-medium italic text-text-main leading-relaxed">"{session.cancellation_reason}"</p>
          </div>
        </div>

        <div className="w-full lg:w-72 space-y-4">
          <button className="w-full py-4 rounded-2xl bg-green-500 text-black font-bold text-xs uppercase tracking-widest shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-all">
            Approve Cancel
          </button>
          <button className="w-full py-4 rounded-2xl bg-bg-main border border-border-main text-text-main font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
            Reject & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function SecurityView({ data, sessionsData }: { data: any, sessionsData: any }) {
  const [activeTab, setActiveTab] = useState<'otps' | 'screenshots' | 'chats' | 'kijo_apps'>('otps');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [reviewingApp, setReviewingApp] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerifyKijo = async (applicationId: number, status: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const res = await fetchWithAuth('/api/admin/verify-kijo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status, reason: status === 'rejected' ? rejectReason : '' })
      });
      if (res.ok) {
        setReviewingApp(null);
        setRejectReason('');
        // Trigger global refresh
        try {
          const event = document.createEvent('CustomEvent');
          event.initCustomEvent('refreshAdminData', true, true, {});
          window.dispatchEvent(event);
        } catch (e) {
          console.warn('Failed to dispatch refreshAdminData event:', e);
        }
      }
    } catch (error) {
      alert('Gagal memproses verifikasi');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-2 md:gap-4 bg-bg-sidebar border border-border-main p-1.5 md:p-2 rounded-xl md:rounded-2xl w-full sm:w-fit shadow-sm overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('otps')}
          className={`px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'otps' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          OTP
        </button>
        <button 
          onClick={() => setActiveTab('kijo_apps')}
          className={`px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'kijo_apps' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          Pengajuan Kijo
        </button>
        <button 
          onClick={() => setActiveTab('screenshots')}
          className={`px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'screenshots' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          Screenshots
        </button>
        <button 
          onClick={() => setActiveTab('chats')}
          className={`px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${activeTab === 'chats' ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
        >
          Chats
        </button>
      </div>

      {activeTab === 'kijo_apps' && (
        <div className="grid grid-cols-1 gap-6">
          {data.kijoApplications?.filter((a: any) => a.status === 'pending').map((app: any) => (
            <div key={app.id} className="bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-sm hover:border-orange-primary/20 transition-all">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${app.username}`} alt="Avatar" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold uppercase tracking-tight">{app.full_name}</h4>
                      <p className="text-xs text-text-muted font-bold uppercase tracking-widest">@{app.username} • {app.experience_type === 'experienced' ? 'Berpengalaman' : 'Baru'}</p>
                      <div className="mt-2 inline-flex items-center gap-2 bg-orange-primary/10 border border-orange-primary/20 px-3 py-1 rounded-lg">
                        <Gamepad2 size={12} className="text-orange-primary" />
                        <span className="text-xs font-bold text-orange-primary uppercase tracking-widest">{app.desired_game}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Foto Identitas Game</p>
                      <div className="flex flex-wrap gap-2">
                        {app.identification_photos.map((url: string, i: number) => (
                          <img 
                            key={i} 
                            src={url} 
                            className="w-20 h-20 object-cover rounded-xl border border-border-main cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => window.open(url, '_blank')}
                            alt="ID" 
                          />
                        ))}
                      </div>
                    </div>
                    {app.experience_type === 'experienced' && (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Bukti Pengalaman</p>
                        <div className="flex flex-wrap gap-2">
                          {app.proof_photos.map((url: string, i: number) => (
                            <img 
                              key={i} 
                              src={url} 
                              className="w-20 h-20 object-cover rounded-xl border border-border-main cursor-pointer hover:scale-110 transition-transform" 
                              onClick={() => window.open(url, '_blank')}
                              alt="Proof" 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-bg-main rounded-2xl border border-border-main">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Sosial Media</p>
                    <a href={app.social_media} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-primary hover:underline">{app.social_media}</a>
                  </div>
                </div>

                <div className="w-full lg:w-64 space-y-3">
                  <button 
                    onClick={() => handleVerifyKijo(app.id, 'approved')}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl bg-green-500 text-black font-bold text-xs uppercase tracking-widest shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    Setujui Pengajuan
                  </button>
                  <button 
                    onClick={() => setReviewingApp(app)}
                    className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                  >
                    Tolak Pengajuan
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(!data.kijoApplications || data.kijoApplications.filter((a: any) => a.status === 'pending').length === 0) && (
            <div className="py-20 text-center bg-bg-sidebar border border-dashed border-border-main rounded-2xl">
              <ShieldCheck className="text-text-muted mx-auto mb-4 opacity-20" size={48} />
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">Tidak ada pengajuan Kijo baru</p>
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {reviewingApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewingApp(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Tolak Pengajuan</h3>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mb-6">Berikan alasan penolakan untuk user.</p>
              
              <textarea 
                className="w-full bg-bg-main border border-border-main rounded-2xl p-4 text-sm text-text-main focus:outline-none focus:border-red-500 mb-6 h-32"
                placeholder="Alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setReviewingApp(null)}
                  className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:text-text-main transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleVerifyKijo(reviewingApp.id, 'rejected')}
                  disabled={!rejectReason || isProcessing}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === 'otps' && (
        <div className="bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl overflow-x-auto shadow-sm no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-bg-main/50 border-b border-border-main">
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Target</th>
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">OTP Code</th>
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Waktu Kirim</th>
                <th className="px-4 md:px-8 py-4 md:py-6 text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {(data.otps || []).map((log: any) => (
                <tr key={log.id} className="hover:bg-bg-main/30 transition-colors">
                  <td className="px-4 md:px-8 py-4 md:py-6 text-xs font-bold whitespace-nowrap">{log.identifier}</td>
                  <td className="px-4 md:px-8 py-4 md:py-6 font-mono text-orange-primary font-bold">{log.code}</td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-xs font-bold text-text-muted whitespace-nowrap">{log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}</td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <span className="bg-green-500/10 text-green-500 text-[11px] font-bold px-2 py-0.5 rounded-full border border-green-500/20 uppercase tracking-widest">Berhasil</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'screenshots' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(sessionsData.history || []).filter((s: any) => s.screenshot_start || s.screenshot_end).map((s: any) => (
            <div key={s.id} className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm group">
              <div className="grid grid-cols-2 h-48 bg-bg-main">
                <div className="relative border-r border-border-main">
                  <img src={s.screenshot_start || 'https://picsum.photos/seed/start/200/300'} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Start" />
                  <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-[11px] font-bold px-2 py-1 rounded uppercase tracking-widest">Rank Awal</span>
                </div>
                <div className="relative">
                  <img src={s.screenshot_end || 'https://picsum.photos/seed/end/200/300'} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="End" />
                  <span className="absolute bottom-2 left-2 bg-orange-primary/80 backdrop-blur-md text-black text-[11px] font-bold px-2 py-1 rounded uppercase tracking-widest">Rank Akhir</span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-tight">{s.game_title}</h4>
                    <p className="text-xs text-text-muted font-bold">Pesanan #{s.id}</p>
                  </div>
                  <span className="bg-green-500/10 text-green-500 text-[11px] font-bold px-2 py-1 rounded-lg border border-green-500/20 uppercase">Valid</span>
                </div>
                <button className="w-full py-3 rounded-xl bg-bg-main border border-border-main text-xs font-semibold uppercase tracking-wide hover:border-orange-primary/50 transition-all">
                  Audit Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative h-[600px]">
          {/* Chat List */}
          <div className={`lg:col-span-1 bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-6 md:p-8 shadow-sm overflow-y-auto space-y-4 ${selectedChat ? 'hidden lg:block' : 'block'}`}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-6">Sesi Chat Aktif</h3>
            {data.chatSessions?.map((session: any) => (
              <div 
                key={session.id} 
                onClick={() => setSelectedChat(session)}
                className={`p-5 bg-bg-main border rounded-2xl transition-all cursor-pointer group ${selectedChat?.id === session.id ? 'border-orange-primary' : 'border-border-main hover:border-orange-primary/30'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold uppercase tracking-tight">{session.customer_name}</p>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${session.status === 'open' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {session.status}
                  </span>
                </div>
                <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Tiket #{session.id}</p>
                <p className="text-[11px] text-text-muted mt-1">{new Date(session.created_at).toLocaleString()}</p>
              </div>
            ))}
            {(!data.chatSessions || data.chatSessions.length === 0) && (
              <p className="text-center text-text-muted text-xs py-10 uppercase font-bold tracking-widest opacity-50">Belum ada sesi chat</p>
            )}
          </div>
          
          {/* Chat Window */}
          <AdminChatWindow 
            session={selectedChat} 
            onClose={() => setSelectedChat(null)} 
            adminId={1} // Assuming admin ID is 1
          />
        </div>
      )}
    </div>
  );
}

function AdminChatWindow({ session, onClose, adminId }: { session: any, onClose: () => void, adminId: number }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!session) return;
    try {
      const res = await fetchWithAuth(`/api/chat/sessions/${session.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session) return;

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          senderId: adminId,
          receiverId: session.user_id,
          message: newMessage
        })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session || !confirm('Tutup sesi chat ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/chat/sessions/${session.id}/close`, { method: 'POST' });
      if (res.ok) {
        onClose();
        try {
          const event = document.createEvent('CustomEvent');
          event.initCustomEvent('refreshAdminData', true, true, {});
          window.dispatchEvent(event);
        } catch (e) {
          console.warn('Failed to dispatch refreshAdminData event:', e);
        }
      }
    } catch (error) {
      console.error('Error closing session:', error);
    }
  };

  if (!session) {
    return (
      <div className="lg:col-span-2 bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-sm flex flex-col items-center justify-center text-center space-y-4 opacity-30">
        <MessageSquare size={64} />
        <p className="text-xs font-semibold uppercase tracking-wide">Pilih chat untuk membalas</p>
      </div>
    );
  }

  return (
    <div className="lg:col-span-2 bg-bg-sidebar border border-border-main rounded-2xl md:rounded-2xl p-6 md:p-10 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b border-border-main pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text-main">
            <X size={20} />
          </button>
          <div>
            <p className="text-sm font-bold uppercase tracking-tight">{session.customer_name}</p>
            <p className="text-xs text-orange-primary font-bold uppercase tracking-widest">Tiket #{session.id}</p>
          </div>
        </div>
        {session.status === 'open' && (
          <button 
            onClick={handleCloseSession}
            className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[11px] font-semibold uppercase tracking-wide hover:bg-red-500 hover:text-white transition-all"
          >
            Tutup Sesi
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 no-scrollbar">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.sender_id === adminId ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
              msg.sender_id === adminId 
                ? 'bg-orange-primary text-black rounded-tr-none' 
                : 'bg-bg-main border border-border-main text-text-main rounded-tl-none'
            }`}>
              {msg.message}
              <p className={`text-[11px] font-semibold uppercase tracking-wide mt-2 ${msg.sender_id === adminId ? 'text-black/50' : 'text-text-muted'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {session.status === 'open' ? (
        <form onSubmit={handleSendMessage} className="mt-auto pt-4 border-t border-border-main flex gap-3 md:gap-4">
          <input 
            type="text" 
            placeholder="Tulis balasan bantuan teknis..."
            className="flex-1 bg-bg-main border border-border-main rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm focus:outline-none focus:border-orange-primary transition-all"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="w-12 h-12 md:w-14 md:h-14 bg-orange-primary text-black rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-primary/20 hover:scale-105 transition-all shrink-0 disabled:opacity-50"
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      ) : (
        <div className="mt-auto pt-4 border-t border-border-main text-center">
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Sesi ini telah ditutup.</p>
        </div>
      )}
    </div>
  );
}

function GamesManagementView({ games, onRefresh }: { games: any[], onRefresh: () => void }) {
  const [newGameName, setNewGameName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingGame, setEditingGame] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({
    name: '',
    is_active: true,
    input_schema: [],
    ranks: []
  });

  const GAME_TEMPLATES = [
    {
      name: 'Valorant',
      input_schema: [
        { name: 'Nickname', type: 'text', placeholder: 'Contoh: TenZ' },
        { name: 'ID Game', type: 'text', placeholder: 'Contoh: Riot ID' },
        { name: 'Hashtag', type: 'text', placeholder: 'Contoh: 1234' },
        { name: 'Highest Rank', type: 'rank', placeholder: 'Pilih Rank Saat Ini' }
      ],
      ranks: [
        { title: 'Iron', tiers: ['1', '2', '3'] },
        { title: 'Bronze', tiers: ['1', '2', '3'] },
        { title: 'Silver', tiers: ['1', '2', '3'] },
        { title: 'Gold', tiers: ['1', '2', '3'] },
        { title: 'Platinum', tiers: ['1', '2', '3'] },
        { title: 'Diamond', tiers: ['1', '2', '3'] },
        { title: 'Ascendant', tiers: ['1', '2', '3'] },
        { title: 'Immortal', tiers: ['1', '2', '3'] },
        { title: 'Radiant', tiers: ['Top 500'] }
      ]
    },
    {
      name: 'Mobile Legends',
      input_schema: [
        { name: 'Nickname', type: 'text', placeholder: 'Contoh: JessNoLimit' },
        { name: 'ID Game', type: 'text', placeholder: 'Contoh: 12345678' },
        { name: 'Server ID', type: 'text', placeholder: 'Contoh: 1234' },
        { name: 'Highest Rank', type: 'rank', placeholder: 'Pilih Rank Saat Ini' }
      ],
      ranks: [
        { title: 'Warrior', tiers: ['III', 'II', 'I'] },
        { title: 'Elite', tiers: ['III', 'II', 'I'] },
        { title: 'Master', tiers: ['IV', 'III', 'II', 'I'] },
        { title: 'Grandmaster', tiers: ['V', 'IV', 'III', 'II', 'I'] },
        { title: 'Epic', tiers: ['V', 'IV', 'III', 'II', 'I'] },
        { title: 'Legend', tiers: ['V', 'IV', 'III', 'II', 'I'] },
        { title: 'Mythic', tiers: ['Grading', '1-25 Stars', '26-50 Stars', '51-100 Stars', '100+ Stars'] }
      ]
    },
    {
      name: 'Genshin Impact',
      input_schema: [
        { name: 'Nickname', type: 'text', placeholder: 'Contoh: Traveler' },
        { name: 'UID', type: 'text', placeholder: 'Contoh: 800123456' },
        { name: 'Server', type: 'text', placeholder: 'Contoh: Asia' },
        { name: 'Adventure Rank', type: 'number', placeholder: 'Contoh: 60' }
      ],
      ranks: [
        { title: 'World Level', tiers: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] }
      ]
    }
  ];

  const applyTemplate = async (template: any) => {
    setIsAdding(true);
    try {
      const res = await fetchWithAuth('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: template.name,
          is_active: true,
          input_schema: template.input_schema,
          ranks: template.ranks
        })
      });
      if (res.ok) {
        setShowTemplates(false);
        onRefresh();
      }
    } catch (error) {
      alert('Gagal menerapkan template');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddGame = async () => {
    if (!newGameName.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetchWithAuth('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newGameName,
          is_active: true,
          input_schema: [
            { name: 'Nickname', type: 'text', placeholder: 'Contoh: ProPlayer99' },
            { name: 'ID Game', type: 'text', placeholder: 'Contoh: 12345678' },
            { name: 'Highest Rank', type: 'rank', placeholder: 'Pilih Rank' }
          ],
          ranks: []
        })
      });
      if (res.ok) {
        setNewGameName('');
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Gagal menambahkan game');
      }
    } catch (error) {
      alert('Terjadi kesalahan');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateGame = async () => {
    if (!editFormData.name.trim()) return;
    try {
      const res = await fetchWithAuth(`/api/admin/games/${editingGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setShowEditModal(false);
        onRefresh();
      }
    } catch (error) {
      alert('Gagal memperbarui game');
    }
  };

  const handleDeleteGame = async (id: number) => {
    if (!confirm('Hapus game ini? Ini mungkin mempengaruhi data yang sudah ada.')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/games/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        onRefresh();
      } else {
        alert(data.message || 'Gagal menghapus game');
      }
    } catch (error) {
      alert('Gagal menghapus game');
    }
  };

  const addInputField = () => {
    setEditFormData({
      ...editFormData,
      input_schema: [...editFormData.input_schema, { name: '', type: 'text', placeholder: '' }]
    });
  };

  const removeInputField = (index: number) => {
    const newSchema = [...editFormData.input_schema];
    newSchema.splice(index, 1);
    setEditFormData({ ...editFormData, input_schema: newSchema });
  };

  const updateInputField = (index: number, field: string, value: string) => {
    const newSchema = [...editFormData.input_schema];
    newSchema[index] = { ...newSchema[index], [field]: value };
    setEditFormData({ ...editFormData, input_schema: newSchema });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Manajemen Game</h3>
            <p className="text-text-muted text-xs md:text-xs font-bold uppercase tracking-widest">Kelola daftar game yang didukung oleh platform</p>
          </div>
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 bg-bg-sidebar border border-border-main rounded-xl text-xs font-semibold uppercase tracking-wide hover:border-orange-primary/30 transition-all flex items-center gap-2"
          >
            <Zap size={14} className="text-orange-primary" /> Use Template
          </button>
        </div>
      </div>

      {showTemplates && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"
        >
          {GAME_TEMPLATES.map((template, idx) => (
            <button 
              key={idx}
              onClick={() => applyTemplate(template)}
              className="bg-bg-sidebar border border-border-main p-6 rounded-2xl text-left hover:border-orange-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-text-main uppercase tracking-tight">{template.name}</h4>
                <ArrowUpRight size={16} className="text-text-muted group-hover:text-orange-primary transition-colors" />
              </div>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest">
                {template.input_schema.length} Fields • {template.ranks.length} Ranks
              </p>
            </button>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Game Form */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-sm h-fit">
          <h4 className="text-sm font-bold uppercase tracking-tight mb-6">Tambah Game Baru</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nama Game</label>
              <input 
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all"
                placeholder="Contoh: Mobile Legends"
              />
            </div>

            <button 
              onClick={handleAddGame}
              disabled={isAdding || !newGameName.trim()}
              className="w-full py-4 rounded-2xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-orange-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isAdding ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
              Tambah Game
            </button>
          </div>
        </div>

        {/* Games List */}
        <div className="lg:col-span-2 bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm">
          <div className="p-8 border-b border-border-main flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-tight">Daftar Game Aktif</h4>
            <span className="px-3 py-1 bg-bg-main border border-border-main rounded-lg text-xs font-bold text-text-muted uppercase tracking-widest">
              {games.length} Games
            </span>
          </div>
          <div className="divide-y divide-border-main">
            {games.map((game) => (
              <div key={game.id} className="p-6 flex items-center justify-between hover:bg-bg-main/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-bg-main border border-border-main flex items-center justify-center text-orange-primary">
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold uppercase tracking-tight">{game.name}</p>
                      {!game.is_active && (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[11px] font-bold rounded border border-red-500/20 uppercase tracking-widest">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted font-bold uppercase tracking-widest">
                      {game.input_schema?.length || 0} Fields • {game.ranks?.length || 0} Ranks • Ditambahkan: {new Date(game.created_at).toLocaleDateString('id-ID')}
                    </p>
                    {game.ranks && game.ranks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {game.ranks.slice(0, 5).map((r: any, i: number) => (
                          <div key={i} className="flex flex-wrap gap-1 items-center">
                            <span className="px-2 py-0.5 bg-orange-primary/10 border border-orange-primary/20 rounded text-[11px] font-bold text-orange-primary uppercase">
                              {r.title}
                            </span>
                            {(r.tiers || []).slice(0, 2).map((t: string, ti: number) => (
                              <span key={ti} className="px-1.5 py-0.5 bg-bg-main border border-border-main rounded text-[11px] font-bold text-text-muted">
                                {t}
                              </span>
                            ))}
                            {r.tiers && r.tiers.length > 2 && <span className="text-[11px] text-text-muted font-bold">+{r.tiers.length - 2}</span>}
                          </div>
                        ))}
                        {game.ranks.length > 5 && <span className="text-[11px] text-text-muted font-bold">+{game.ranks.length - 5} more categories</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingGame(game);
                      setEditFormData({
                        name: game.name,
                        is_active: !!game.is_active,
                        input_schema: game.input_schema || [],
                        ranks: game.ranks || []
                      });
                      setShowEditModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-primary/10 text-orange-primary text-xs font-semibold uppercase tracking-wide rounded-xl border border-orange-primary/20 hover:bg-orange-primary hover:text-black transition-all"
                  >
                    <Settings2 size={14} /> Manage Game
                  </button>
                  <button 
                    onClick={() => handleDeleteGame(game.id)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {games.length === 0 && (
              <div className="p-20 text-center">
                <Gamepad2 className="mx-auto text-text-muted mb-4 opacity-10" size={64} />
                <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">Belum ada game yang ditambahkan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Game Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold uppercase tracking-tight">Edit <span className="text-orange-primary">Game Title.</span></h3>
                <div className="flex items-center gap-3 bg-bg-main border border-border-main p-2 rounded-2xl">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest ml-2">Status</span>
                  <button 
                    onClick={() => setEditFormData({...editFormData, is_active: !editFormData.is_active})}
                    className={`relative w-12 h-6 rounded-full transition-colors ${editFormData.is_active ? 'bg-green-500' : 'bg-bg-sidebar border border-border-main'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editFormData.is_active ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Nama Game</label>
                  <input 
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Input Fields Schema</label>
                    <button 
                      onClick={addInputField}
                      className="flex items-center gap-2 text-orange-primary text-xs font-semibold uppercase tracking-wide hover:underline"
                    >
                      <Plus size={14} /> Tambah Input
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {editFormData.input_schema.map((field: any, index: number) => (
                      <div key={index} className="bg-bg-main border border-border-main rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
                        <div className="flex-1 space-y-1 w-full">
                          <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Nama Field</label>
                          <input 
                            type="text"
                            value={field.name}
                            onChange={(e) => updateInputField(index, 'name', e.target.value)}
                            className="w-full bg-bg-sidebar border border-border-main rounded-xl py-2 px-4 text-xs font-bold"
                            placeholder="Contoh: Nickname"
                          />
                        </div>
                        <div className="w-full md:w-32 space-y-1">
                          <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Tipe</label>
                          <select 
                            value={field.type}
                            onChange={(e) => updateInputField(index, 'type', e.target.value)}
                            className="w-full bg-bg-sidebar border border-border-main rounded-xl py-2 px-4 text-xs font-bold"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="both">Both</option>
                            <option value="rank">Game Rank</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1 w-full">
                          <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Placeholder</label>
                          <input 
                            type="text"
                            value={field.placeholder}
                            onChange={(e) => updateInputField(index, 'placeholder', e.target.value)}
                            className="w-full bg-bg-sidebar border border-border-main rounded-xl py-2 px-4 text-xs font-bold"
                            placeholder="Contoh: Masukkan nickname"
                          />
                        </div>
                        <button 
                          onClick={() => removeInputField(index)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Game Ranks Setting</label>
                    <button 
                      onClick={() => setEditFormData({...editFormData, ranks: [...(editFormData.ranks || []), { title: '', tiers: [''] }]})}
                      className="flex items-center gap-2 text-orange-primary text-xs font-semibold uppercase tracking-wide hover:underline"
                    >
                      <Plus size={14} /> Tambah Rank
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(editFormData.ranks || []).map((rank: any, rankIndex: number) => (
                      <div key={rankIndex} className="bg-bg-main border border-border-main rounded-2xl p-6 space-y-4 relative group/rank">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Rank Title (Category)</label>
                            <input 
                              type="text"
                              value={rank.title}
                              onChange={(e) => {
                                const newRanks = [...editFormData.ranks];
                                newRanks[rankIndex] = { ...newRanks[rankIndex], title: e.target.value };
                                setEditFormData({ ...editFormData, ranks: newRanks });
                              }}
                              className="w-full bg-bg-sidebar border border-border-main rounded-xl py-2 px-4 text-xs font-bold"
                              placeholder="Contoh: Epic"
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newRanks = [...editFormData.ranks];
                              newRanks.splice(rankIndex, 1);
                              setEditFormData({ ...editFormData, ranks: newRanks });
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all self-end"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Rank Tiers (Packages)</label>
                            <button 
                              onClick={() => {
                                const newRanks = [...editFormData.ranks];
                                const tiers = rank.tiers || [];
                                newRanks[rankIndex] = { ...rank, tiers: [...tiers, ''] };
                                setEditFormData({ ...editFormData, ranks: newRanks });
                              }}
                              className="text-[11px] font-bold text-orange-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                              <Plus size={10} /> Add Rank Tier
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(rank.tiers || []).map((tier: string, tierIndex: number) => (
                              <div key={tierIndex} className="flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={tier}
                                  onChange={(e) => {
                                    const newRanks = [...editFormData.ranks];
                                    const newTiers = [...(rank.tiers || [])];
                                    newTiers[tierIndex] = e.target.value;
                                    newRanks[rankIndex] = { ...rank, tiers: newTiers };
                                    setEditFormData({ ...editFormData, ranks: newRanks });
                                  }}
                                  className="flex-1 bg-bg-sidebar border border-border-main rounded-lg py-1.5 px-3 text-xs font-bold"
                                  placeholder={`Tier ${tierIndex + 1}`}
                                />
                                <button 
                                  onClick={() => {
                                    const newRanks = [...editFormData.ranks];
                                    const newTiers = [...(rank.tiers || [])];
                                    newTiers.splice(tierIndex, 1);
                                    newRanks[rankIndex] = { ...rank, tiers: newTiers };
                                    setEditFormData({ ...editFormData, ranks: newRanks });
                                  }}
                                  className="p-1.5 text-text-muted hover:text-red-500 transition-all"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!editFormData.ranks || editFormData.ranks.length === 0) && (
                      <div className="py-8 text-center border border-dashed border-border-main rounded-2xl">
                        <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Belum ada rank yang diatur</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:text-text-main transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleUpdateGame}
                  className="flex-1 py-4 rounded-2xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-orange-primary/20 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FinancialsView({ data, withdrawals, onRefresh, adminId }: { data: any, withdrawals: any[], onRefresh: () => void, adminId: number }) {
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!data) return null;

  const handleApprove = async (id: number) => {
    if (!confirm('Setujui penarikan dana ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      alert('Gagal menyetujui penarikan');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason) return;
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${rejectingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, reason: rejectReason })
      });
      if (res.ok) {
        setRejectingId(null);
        setRejectReason('');
        onRefresh();
      }
    } catch (e) {
      alert('Gagal menolak penarikan');
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<DollarSign />} label="Total Revenue" value={`Rp ${data.totalRevenue.toLocaleString()}`} color="blue" trend="Total perputaran uang" />
        <StatCard icon={<TrendingUp />} label="Total Profit" value={`Rp ${data.totalProfit.toLocaleString()}`} color="orange" trend="Keuntungan bersih admin" />
        <StatCard icon={<Clock />} label="Pending Withdrawals" value={`Rp ${data.pendingWithdrawals.toLocaleString()}`} color="red" trend="Menunggu persetujuan" />
        <StatCard icon={<CheckCircle2 />} label="Paid Out" value={`Rp ${data.successWithdrawals.toLocaleString()}`} color="green" trend="Total dana dicairkan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold uppercase tracking-tight">Withdrawal Requests</h3>
          </div>
          <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-main/50 border-b border-border-main">
                    <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">User</th>
                    <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Amount</th>
                    <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Destination</th>
                    <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-bg-main/30 transition-colors">
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold uppercase tracking-tight">{w.full_name}</p>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-widest">@{w.username} • {w.role}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-orange-primary">Rp {w.amount.toLocaleString()}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest leading-relaxed max-w-[200px]">{w.destination}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {w.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setRejectingId(w.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                              <XCircle size={16} />
                            </button>
                            <button onClick={() => handleApprove(w.id)} className="p-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500 hover:text-white transition-all">
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${
                            w.status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {w.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-text-muted font-semibold uppercase tracking-wide opacity-30">No withdrawal requests</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold uppercase tracking-tight">Recent Transactions</h3>
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 shadow-sm space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
            {data.recentTransactions.map((t: any) => (
              <div key={t.id} className="p-4 rounded-2xl bg-bg-main border border-border-main flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-tight truncate">{t.description}</p>
                  <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest mt-1">@{t.username} • {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <div className={`text-xs font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'} Rp {t.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {rejectingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectingId(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl">
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Reject Withdrawal</h3>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mb-6">Berikan alasan penolakan penarikan dana ini.</p>
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Data bank tidak valid"
                className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all h-32 resize-none mb-6"
              />
              <div className="flex gap-3">
                <button onClick={() => setRejectingId(null)} className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest">Batal</button>
                <button onClick={handleReject} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20">Reject Now</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnnouncementsView({ data, onRefresh, adminId }: { data: any[], onRefresh: () => void, adminId: number }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', type: 'info', target: 'all' });

  const handleCreate = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, adminId })
      });
      if (res.ok) {
        setIsAdding(false);
        setFormData({ title: '', content: '', type: 'info', target: 'all' });
        onRefresh();
      }
    } catch (e) {
      alert('Gagal membuat pengumuman');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      alert('Gagal menghapus');
    }
  };

  const handleToggle = async (id: number, current: number) => {
    try {
      const res = await fetchWithAuth(`/api/admin/announcements/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, is_active: !current })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      alert('Gagal mengubah status');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold uppercase tracking-tight">System Banners</h3>
          <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Kelola pengumuman global yang muncul di dashboard user</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="px-8 py-4 bg-orange-primary text-black rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20 flex items-center gap-2">
          <Plus size={18} /> Add New Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((a) => (
          <div key={a.id} className={`bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-sm relative overflow-hidden ${!a.is_active ? 'opacity-50' : ''}`}>
            <div className={`absolute top-0 left-0 w-2 h-full ${
              a.type === 'info' ? 'bg-blue-500' :
              a.type === 'warning' ? 'bg-orange-primary' :
              a.type === 'danger' ? 'bg-red-500' : 'bg-green-500'
            }`} />
            <div className="flex justify-between items-start mb-4">
              <span className="text-[11px] font-bold px-2 py-1 bg-bg-main border border-border-main rounded-full uppercase tracking-widest text-text-muted">Target: {a.target}</span>
              <div className="flex gap-2">
                <button onClick={() => handleToggle(a.id, a.is_active)} className={`p-2 rounded-lg border transition-all ${a.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-bg-main text-text-muted border-border-main'}`}>
                  {a.is_active ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h4 className="text-lg font-bold uppercase tracking-tight mb-2">{a.title}</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-6">{a.content}</p>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest italic">Dibuat: {new Date(a.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl">
              <h3 className="text-xl font-bold uppercase tracking-tight mb-6">Create New Banner</h3>
              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Title</label>
                  <input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all" placeholder="Judul Pengumuman" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Content</label>
                  <textarea value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all h-32 resize-none" placeholder="Isi pengumuman..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Type</label>
                    <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all">
                      <option value="info">Information</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                      <option value="danger">Danger</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Target</label>
                    <select value={formData.target} onChange={(e) => setFormData({...formData, target: e.target.value})} className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all">
                      <option value="all">All Users</option>
                      <option value="kijo">KIJO Only</option>
                      <option value="jokies">Jokies Only</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest">Batal</button>
                <button onClick={handleCreate} className="flex-1 py-4 rounded-2xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20">Publish Banner</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuditLogsView({ data }: { data: any[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold uppercase tracking-tight">Audit Logs</h3>
        <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Riwayat aktivitas administrator sistem</p>
      </div>

      <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-main/50 border-b border-border-main">
                <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Timestamp</th>
                <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Minox</th>
                <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Action</th>
                <th className="px-8 py-6 text-xs font-semibold uppercase tracking-wide text-text-muted">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {data.map((log) => (
                <tr key={log.id} className="hover:bg-bg-main/30 transition-colors">
                  <td className="px-8 py-6 whitespace-nowrap">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{new Date(log.created_at).toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-bold uppercase tracking-tight">@{log.admin_username}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[11px] font-bold px-2 py-1 bg-bg-main border border-border-main rounded-full uppercase tracking-widest text-orange-primary">{log.action}</span>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs text-text-muted leading-relaxed max-w-md">{log.details}</p>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-text-muted font-semibold uppercase tracking-wide opacity-30">No audit logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ userId, onClose, onRefresh }: { userId: number, onClose: () => void, onRefresh: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetchWithAuth(`/api/admin/users/${userId}/full-details`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-bg-sidebar border border-border-main rounded-2xl p-12 shadow-2xl">
          <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">Memuat Detail User...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl max-w-sm text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-text-main mb-2">Gagal Memuat Data</h3>
          <p className="text-text-muted text-sm mb-6">Data user tidak ditemukan atau terjadi kesalahan pada server.</p>
          <button onClick={onClose} className="w-full bg-orange-primary text-black font-bold py-3 rounded-xl">TUTUP</button>
        </div>
      </div>
    );
  }

  const u = data.user;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-border-main flex items-center justify-between bg-bg-main/50">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="Avatar" />
            </div>
            <div>
              <h3 className="text-2xl font-bold uppercase tracking-tight">{u.full_name}</h3>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest">@{u.username} • {u.role} • ID: {u.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 rounded-xl bg-bg-main border border-border-main text-text-muted hover:text-orange-primary transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="p-6 rounded-2xl bg-bg-main border border-border-main">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Wallet / Balance</p>
              <h4 className="text-xl font-bold text-orange-primary">Rp {(u.role === 'kijo' ? (u.balance_active ?? 0) : (u.wallet_jokies ?? 0)).toLocaleString()}</h4>
              {u.role === 'kijo' && <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest mt-1">Held: Rp {(u.balance_held ?? 0).toLocaleString()}</p>}
            </div>
            <div className="p-6 rounded-2xl bg-bg-main border border-border-main">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Contact Info</p>
              <p className="text-xs font-bold truncate">{u.email}</p>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">{u.phone}</p>
            </div>
            <div className="p-6 rounded-2xl bg-bg-main border border-border-main">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Account Status</p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide ${u.is_suspended ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                  {u.is_suspended ? 'Suspended' : 'Active'}
                </span>
                <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide ${u.is_verified ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-bg-sidebar text-text-muted border border-border-main'}`}>
                  {u.is_verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            <div>
              <h4 className="text-lg font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
                <PackageSearch size={20} className="text-orange-primary" /> Order History
              </h4>
              <div className="bg-bg-main border border-border-main rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-sidebar/50 border-b border-border-main">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Order ID</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Game</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Price</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main">
                    {(data.orders || []).map((o: any) => (
                      <tr key={o.id} className="hover:bg-bg-sidebar/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold">#{o.id}</td>
                        <td className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-widest">{o.game_title}</td>
                        <td className="px-6 py-4 text-xs font-bold">Rp {o.total_price.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${
                            o.status === 'completed' ? 'text-green-500' :
                            o.status === 'cancelled' ? 'text-red-500' : 'text-orange-primary'
                          }`}>{o.status}</span>
                        </td>
                      </tr>
                    ))}
                    {data.orders.length === 0 && <tr><td colSpan={4} className="px-6 py-10 text-center text-xs font-semibold uppercase tracking-wide text-text-muted opacity-30">No orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-lg font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
                  <History size={20} className="text-orange-primary" /> Transactions
                </h4>
                <div className="space-y-3">
                  {(data.transactions || []).map((t: any) => (
                    <div key={t.id} className="p-4 rounded-2xl bg-bg-main border border-border-main flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-tight truncate">{t.description}</p>
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest mt-1">{new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className={`text-xs font-bold ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {t.type === 'income' ? '+' : '-'} Rp {t.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {data.transactions.length === 0 && <p className="text-center py-10 text-xs font-semibold uppercase tracking-wide text-text-muted opacity-30">No transactions</p>}
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
                  <DollarSign size={20} className="text-orange-primary" /> Withdrawals
                </h4>
                <div className="space-y-3">
                  {(data.withdrawals || []).map((w: any) => (
                    <div key={w.id} className="p-4 rounded-2xl bg-bg-main border border-border-main flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-tight truncate">{w.destination}</p>
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest mt-1">{new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-500">Rp {w.amount.toLocaleString()}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mt-1">{w.status}</p>
                      </div>
                    </div>
                  ))}
                  {data.withdrawals.length === 0 && <p className="text-center py-10 text-xs font-semibold uppercase tracking-wide text-text-muted opacity-30">No withdrawals</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StarIcon({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function MaintenanceView({ onRefresh }: { onRefresh: () => void }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchSchedules = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/maintenance');
      if (res.ok) setSchedules(await res.json());
    } catch (error) {
      console.error('Fetch Maintenance Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleAddSchedule = async () => {
    if (!newSchedule.start_date || !newSchedule.end_date || !newSchedule.reason) {
      alert('Mohon isi semua field');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewSchedule({ start_date: '', end_date: '', reason: '' });
        fetchSchedules();
        onRefresh();
      }
    } catch (error) {
      alert('Gagal menambah jadwal maintenance');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Hapus jadwal maintenance ini?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/maintenance/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSchedules();
    } catch (error) {
      alert('Gagal menghapus jadwal maintenance');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Maintenance Scheduler</h3>
          <p className="text-text-muted text-xs md:text-xs font-bold uppercase tracking-widest">Atur jadwal pemeliharaan sistem dan pembekuan transaksi</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 rounded-xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-orange-primary/20 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Tambah Jadwal
        </button>
      </div>

      <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-border-main bg-bg-main/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-orange-primary" size={20} />
            <span className="text-xs font-semibold uppercase tracking-wide">Daftar Jadwal Maintenance</span>
          </div>
          <span className="px-3 py-1 bg-bg-main border border-border-main rounded-lg text-xs font-bold text-text-muted uppercase tracking-widest">
            {schedules.length} Jadwal
          </span>
        </div>
        
        <div className="divide-y divide-border-main">
          {schedules.map((s) => (
            <div key={s.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-bg-main/30 transition-colors group">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-bg-main border border-border-main flex items-center justify-center text-orange-primary shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm md:text-lg font-bold uppercase tracking-tight">{s.reason}</h4>
                    {new Date(s.start_date) > new Date() && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[11px] font-bold rounded border border-blue-500/20 uppercase tracking-widest">Upcoming</span>
                    )}
                    {new Date() >= new Date(s.start_date) && new Date() <= new Date(s.end_date) && (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[11px] font-bold rounded border border-red-500/20 uppercase tracking-widest animate-pulse">Active</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-text-muted" />
                      <span className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-widest">
                        Mulai: {new Date(s.start_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-text-muted" />
                      <span className="text-xs md:text-xs font-bold text-text-muted uppercase tracking-widest">
                        Selesai: {new Date(s.end_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteSchedule(s.id)}
                className="p-3 md:p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white flex items-center justify-center"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {schedules.length === 0 && (
            <div className="py-32 text-center">
              <Clock className="mx-auto text-text-muted mb-4 opacity-10" size={64} />
              <p className="text-text-muted text-sm font-semibold uppercase tracking-wide">Belum ada jadwal maintenance</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-orange-primary/5 border border-orange-primary/20 rounded-2xl p-8 flex items-start gap-6">
        <div className="w-12 h-12 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-text-main uppercase tracking-tight mb-2">Aturan Maintenance Sistem</h4>
          <ul className="space-y-2">
            <li className="text-[11px] text-text-muted font-medium flex items-start gap-2">
              <div className="w-1 h-1 bg-orange-primary rounded-full mt-1.5 shrink-0" />
              <span>Satu minggu sebelum maintenance dimulai, sistem akan memasuki fase <span className="text-orange-primary font-bold">FREEZE</span>. Pengguna tidak dapat melakukan pemesanan baru.</span>
            </li>
            <li className="text-[11px] text-text-muted font-medium flex items-start gap-2">
              <div className="w-1 h-1 bg-orange-primary rounded-full mt-1.5 shrink-0" />
              <span>Selama fase <span className="text-orange-primary font-bold">FREEZE</span>, pengguna masih dapat menyelesaikan pekerjaan yang sedang berjalan dan melakukan penarikan dana.</span>
            </li>
            <li className="text-[11px] text-text-muted font-medium flex items-start gap-2">
              <div className="w-1 h-1 bg-orange-primary rounded-full mt-1.5 shrink-0" />
              <span>Saat waktu maintenance tiba, seluruh sistem (kecuali Minox Panel) akan ditutup sepenuhnya.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Tambah Jadwal Maintenance</h3>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mb-8">Tentukan periode pemeliharaan sistem</p>
              
              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Waktu Mulai</label>
                    <input 
                      type="datetime-local"
                      value={newSchedule.start_date}
                      onChange={(e) => setNewSchedule({...newSchedule, start_date: e.target.value})}
                      className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Waktu Selesai</label>
                    <input 
                      type="datetime-local"
                      value={newSchedule.end_date}
                      onChange={(e) => setNewSchedule({...newSchedule, end_date: e.target.value})}
                      className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Alasan / Pesan Maintenance</label>
                  <textarea 
                    value={newSchedule.reason}
                    onChange={(e) => setNewSchedule({...newSchedule, reason: e.target.value})}
                    placeholder="Contoh: Migrasi Server & Update Database"
                    className="w-full bg-bg-main border border-border-main rounded-2xl py-4 px-6 text-text-main font-bold focus:outline-none focus:border-orange-primary transition-all h-32 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 rounded-2xl bg-bg-main border border-border-main text-text-muted font-bold text-xs uppercase tracking-widest hover:text-text-main transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleAddSchedule}
                  disabled={saving}
                  className="flex-1 py-4 rounded-2xl bg-orange-primary text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-orange-primary/20 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Jadwal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MinoxProfileView({ user, onUpdate }: { user: any; onUpdate: (u: any) => void }) {
  const [contactForm, setContactForm] = useState({ email: user.email || '', phone: user.phone || '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passMsg, setPassMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleContactSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactMsg(null);
    setContactLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify({ email: contactForm.email, phone: contactForm.phone }),
      });
      const data = await res.json();
      if (data.success) {
        setContactMsg({ text: data.message, ok: true });
        if (data.user) onUpdate(data.user);
      } else {
        setContactMsg({ text: data.message || 'Gagal menyimpan.', ok: false });
      }
    } catch {
      setContactMsg({ text: 'Tidak dapat terhubung ke server.', ok: false });
    } finally {
      setContactLoading(false);
    }
  };

  const handlePassSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ text: 'Password baru dan konfirmasi tidak cocok.', ok: false });
      return;
    }
    if (passForm.newPassword.length < 8) {
      setPassMsg({ text: 'Password baru minimal 8 karakter.', ok: false });
      return;
    }
    setPassLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPassMsg({ text: data.message, ok: true });
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPassMsg({ text: data.message || 'Gagal mengubah password.', ok: false });
      }
    } catch {
      setPassMsg({ text: 'Tidak dapat terhubung ke server.', ok: false });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h3 className="text-2xl font-bold uppercase tracking-tight">Profil Minox</h3>
        <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">Kelola kredensial akun administrator</p>
      </div>

      {/* Identity */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-bg-main border border-border-main flex items-center justify-center overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`} alt="Minox" className="w-full h-full" />
          </div>
          <div>
            <p className="text-lg font-bold uppercase tracking-tight">{user.full_name}</p>
            <p className="text-xs text-text-muted font-medium">@{user.username}</p>
          </div>
        </div>

        {/* Contact form */}
        <form onSubmit={handleContactSave} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border-main pb-2">Email & Telepon</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted flex items-center gap-1.5"><Mail size={12} /> Email</label>
            <input
              type="email"
              value={contactForm.email}
              onChange={e => { setContactForm(p => ({ ...p, email: e.target.value })); setContactMsg(null); }}
              className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted flex items-center gap-1.5"><Phone size={12} /> Nomor Telepon</label>
            <input
              type="tel"
              value={contactForm.phone}
              onChange={e => { setContactForm(p => ({ ...p, phone: e.target.value })); setContactMsg(null); }}
              className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
          </div>
          {contactMsg && (
            <p className={`text-xs font-medium ${contactMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{contactMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={contactLoading}
            className="flex items-center gap-2 bg-orange-primary hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            {contactLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan Perubahan
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6">
        <form onSubmit={handlePassSave} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border-main pb-2">Ubah Password</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted flex items-center gap-1.5"><Lock size={12} /> Password Saat Ini</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={passForm.currentPassword}
                onChange={e => { setPassForm(p => ({ ...p, currentPassword: e.target.value })); setPassMsg(null); }}
                placeholder="Password saat ini"
                autoComplete="current-password"
                className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 pr-11 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
              />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Password Baru</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={passForm.newPassword}
              onChange={e => { setPassForm(p => ({ ...p, newPassword: e.target.value })); setPassMsg(null); }}
              placeholder="Min. 8 karakter"
              autoComplete="new-password"
              className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Konfirmasi Password Baru</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={passForm.confirmPassword}
              onChange={e => { setPassForm(p => ({ ...p, confirmPassword: e.target.value })); setPassMsg(null); }}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
              className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
            />
          </div>
          {passMsg && (
            <p className={`text-xs font-medium ${passMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{passMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={passLoading}
            className="flex items-center gap-2 bg-orange-primary hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            {passLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Ubah Password
          </button>
        </form>
      </div>
    </div>
  );
}
