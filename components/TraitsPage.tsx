import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Trophy, 
  Shield, 
  Smile, 
  Zap, 
  Flame, 
  Lock, 
  UserCheck, 
  Moon, 
  Sun, 
  Handshake,
  CheckCircle2,
  LockKeyhole,
  Info
} from 'lucide-react';

import { KIJO_TRAITS, JOKIES_TRAITS, TraitDefinition } from '../constants';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface Trait {
  id: number;
  trait_key: string;
  level: number;
  progress: number;
  earned_at: string;
}

interface TraitsPageProps {
  user: any;
  mode: 'kijo' | 'jokies';
}

export default function TraitsPage({ user, mode }: TraitsPageProps) {
  const [userTraits, setUserTraits] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTrait, setSelectedTrait] = useState<TraitDefinition | null>(null);

  const isKijoUser = user.has_kijo_profile === 1;

  const fetchTraits = async () => {
    try {
      const res = await fetchWithAuth(`/api/kijo/traits/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUserTraits(data);
      }
    } catch (error) {
      console.error('Error fetching traits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraits();
  }, [user.id]);

  const getTraitStatus = (key: string) => {
    return userTraits.find(t => t.trait_key === key);
  };

  const renderTraitSection = (title: string, traits: TraitDefinition[], subtitle: string) => (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-text-main tracking-tighter mb-2 uppercase">
          {title.split(' ')[0]} <span className="text-orange-primary">{title.split(' ')[1]}.</span>
        </h3>
        <p className="text-text-muted text-xs font-medium max-w-md">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {traits.map((trait) => {
          const status = getTraitStatus(trait.key);
          const isEarned = !!status;

          return (
            <motion.div
              key={trait.key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedTrait(trait)}
              className={`relative cursor-pointer group bg-bg-sidebar border rounded-2xl p-4 transition-all duration-300 shadow-sm flex flex-col items-center text-center gap-3 ${
                isEarned ? 'border-orange-primary/30 shadow-lg shadow-orange-primary/5' : 'border-border-main opacity-40 grayscale'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                isEarned ? `bg-bg-main border-orange-primary/20 ${trait.color}` : 'bg-bg-main border-border-main text-text-muted'
              }`}>
                {React.cloneElement(trait.icon as React.ReactElement<{ size?: number }>, { size: 20 })}
              </div>
              
              <div className="space-y-1">
                <h3 className={`text-xs font-bold tracking-tight uppercase ${isEarned ? 'text-text-main' : 'text-text-muted'}`}>
                  {trait.name}
                </h3>
                {isEarned && (
                  <div className="text-[11px] text-green-500 font-bold tracking-widest uppercase">Earned</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-5xl font-bold text-text-main tracking-tighter mb-2 uppercase">
            USER <span className="text-orange-primary">TRAITS.</span>
          </h2>
          <p className="text-text-muted text-sm max-w-md font-medium">
            Reputasi dan pencapaian Anda di ekosistem Acinonyx.
          </p>
        </div>
        
        <div className="bg-orange-primary/5 border border-orange-primary/20 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-14 h-14 bg-orange-primary/10 rounded-2xl flex items-center justify-center border border-orange-primary/20">
            <Trophy className="text-orange-primary" size={28} />
          </div>
          <div>
            <div className="text-xs font-bold text-orange-primary uppercase tracking-widest">Total Badge</div>
            <div className="text-3xl font-bold text-text-main">{userTraits.length} / {JOKIES_TRAITS.length + (isKijoUser ? KIJO_TRAITS.length : 0)}</div>
          </div>
        </div>
      </div>

      {/* Traits Sections */}
      <div className="space-y-16">
        {mode === 'jokies' ? (
          <>
            {renderTraitSection('JOKIES TRAITS', JOKIES_TRAITS, 'Reputasi Anda sebagai pelanggan yang dibangun berdasarkan ulasan dari para KIJO.')}
            {isKijoUser && (
              <>
                <div className="h-px bg-border-main w-full opacity-50" />
                {renderTraitSection('KIJO TRAITS', KIJO_TRAITS, 'Badge pencapaian yang menunjukkan keahlian dan dedikasi Anda sebagai Partner Acinonyx.')}
              </>
            )}
          </>
        ) : (
          <>
            {renderTraitSection('KIJO TRAITS', KIJO_TRAITS, 'Badge pencapaian yang menunjukkan keahlian dan dedikasi Anda sebagai Partner Acinonyx.')}
            <div className="h-px bg-border-main w-full opacity-50" />
            {renderTraitSection('JOKIES TRAITS', JOKIES_TRAITS, 'Reputasi Anda sebagai pelanggan yang dibangun berdasarkan ulasan dari para KIJO.')}
          </>
        )}
      </div>

      {/* Trait Detail Modal */}
      <AnimatePresence>
        {selectedTrait && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrait(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl overflow-hidden"
            >
              {/* Background Icon Watermark */}
              <div className={`absolute -right-10 -bottom-10 opacity-[0.05] ${selectedTrait.color}`}>
                {React.cloneElement(selectedTrait.icon as React.ReactElement<{ size?: number }>, { size: 200 })}
              </div>

              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border bg-bg-main border-orange-primary/20 ${selectedTrait.color}`}>
                    {React.cloneElement(selectedTrait.icon as React.ReactElement<{ size?: number }>, { size: 32 })}
                  </div>
                  <button 
                    onClick={() => setSelectedTrait(null)}
                    className="p-2 text-text-muted hover:text-text-main transition-colors"
                  >
                    <CheckCircle2 size={24} />
                  </button>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-text-main tracking-tight mb-2 uppercase">
                    {selectedTrait.name}
                  </h3>
                  <p className="text-text-muted text-sm leading-relaxed font-medium">
                    {selectedTrait.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-border-main">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Kriteria Perolehan</span>
                  </div>
                  <p className="text-xs text-text-muted italic leading-relaxed">
                    {selectedTrait.logic}
                  </p>
                </div>
                
                <button 
                  onClick={() => setSelectedTrait(null)}
                  className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-primary/20"
                >
                  TUTUP DETAIL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Info (Only for Kijo) */}
      {isKijoUser && (
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-10 flex flex-col md:flex-row items-center gap-10 shadow-sm">
          <div className="w-24 h-24 shrink-0 bg-orange-primary/10 rounded-full flex items-center justify-center border border-orange-primary/20 shadow-inner">
            <Zap className="text-orange-primary" size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-text-main font-bold text-xl mb-2 uppercase tracking-tight">Sistem Kalkulasi Otomatis</h4>
            <p className="text-text-muted text-sm leading-relaxed font-medium">
              Beberapa badge seperti <span className="text-text-main">Iron Wall</span>, <span className="text-text-main">Early Bird</span>, dan <span className="text-text-main">Night Owl</span> dikalkulasi secara otomatis oleh sistem setiap 24 jam berdasarkan performa dan jam aktif Anda.
            </p>
          </div>
          <button 
            onClick={async () => {
              await fetchWithAuth(`/api/kijo/traits/${user.id}/calculate`, { method: 'POST' });
              fetchTraits();
            }}
            className="bg-orange-primary text-black font-bold px-10 py-5 rounded-2xl hover:scale-105 transition-all text-xs uppercase tracking-widest shadow-xl shadow-orange-primary/20"
          >
            REFRESH DATA
          </button>
        </div>
      )}
    </div>
  );
}
