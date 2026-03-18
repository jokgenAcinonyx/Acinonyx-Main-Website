import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

type MainView = 'dashboard' | 'etalase' | 'notifications' | 'traits' | 'account' | 'marketplace' | 'orders' | 'kijo-store';

interface MarketplacePageProps {
  user: any;
  setView?: (view: MainView) => void;
  onOrderSuccess?: () => void;
  systemStatus: { status: string, schedule?: any };
  onOpenKijo?: (id: number) => void;
}

export default function MarketplacePage({ user, setView, onOrderSuccess, systemStatus, onOpenKijo }: MarketplacePageProps) {
  const [kijos, setKijos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState('Semua Game');
  const [showGameDropdown, setShowGameDropdown] = useState(false);
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

  useEffect(() => {
    fetchKijos();

    const handleRefresh = () => fetchKijos();
    window.addEventListener('refreshStats', handleRefresh);
    return () => window.removeEventListener('refreshStats', handleRefresh);
  }, []);

  const handleSelectKijo = (kijo: any) => { if (onOpenKijo) onOpenKijo(kijo.id); };

  const filteredKijos = kijos.filter(k => {
    const searchTerms = (search || '').toLowerCase().split(' ').filter(t => t.length > 0);
    const searchableText = `${k?.username || ''} ${k?.full_name || ''} ${(k?.games || []).join(' ')} ${k?.motto || ''}`.toLowerCase();
    
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
    const matchesGame = selectedGame === 'Semua Game' || k.games.includes(selectedGame);
    
    // Only show kijos who have at least 1 active package
    const shouldShowByPackageCount = k.total_package_count > 0;
    
    return matchesSearch && matchesGame && shouldShowByPackageCount;
  });


  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Search Bar Only */}
      <div className="relative group">
        <input 
          type="text" 
          placeholder="Cari username atau nama Kijo..."
          className="w-full bg-bg-sidebar border border-border-main rounded-2xl py-4 pl-4 pr-4 text-text-main placeholder:text-text-muted focus:outline-none focus:border-orange-primary transition-all text-sm font-bold shadow-sm"
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
              {selectedGame}
            </div>
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
                  src={kijo.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kijo.username}`} 
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
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}
