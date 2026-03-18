import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDuration } from '@/utils/formatters';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number | string;
}

export const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        active
          ? 'text-orange-primary bg-orange-primary/10'
          : 'text-text-muted hover:text-text-main hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      {badge && (
        <span className="bg-orange-primary text-black text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  status?: 'active' | 'busy';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, status }) => {
  return (
    <div className="bg-bg-card border border-border-main rounded-xl p-4 md:p-5 hover:border-orange-primary/20 transition-all duration-200">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">{label}</p>
      <h3 className={`text-lg md:text-xl font-semibold tracking-tight ${
        status === 'active' ? 'text-emerald-400' : status === 'busy' ? 'text-orange-primary' : 'text-amber-primary'
      }`}>
        {value}
      </h3>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title }) => {
  return (
    <div className="flex items-center gap-2 mb-4 md:mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
    </div>
  );
}

export const TopNavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number | string }> = ({ icon, label, active, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all relative ${
        active
          ? 'bg-orange-primary/10 text-orange-primary'
          : 'text-text-muted hover:text-text-main hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center border-2 border-bg-sidebar">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[13px] font-medium">{label}</span>
      {active && <motion.div layoutId="topNav" className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-primary rounded-full" />}
    </button>
  );
};

export const BottomNavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number | string }> = ({ icon, label, active, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 relative transition-colors ${active ? 'text-orange-primary' : 'text-text-muted'}`}
    >
      <div className="relative">
        {badge && (
          <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium">{label}</span>
      {active && <motion.div layoutId="bottomNav" className="absolute -bottom-1.5 w-5 h-0.5 bg-orange-primary rounded-full" />}
    </button>
  );
};

interface OrderItemProps {
  title: string;
  user: string;
  price: string;
  time: string;
  active?: boolean;
  completed?: boolean;
  hoverEffect?: boolean;
  onRate?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
  onStart?: () => void;
  onClick?: () => void;
  details?: {
    id: number;
    kijoId: number;
    jokiesId: number;
    duration: number;
    startTime: string;
    hasProofs?: boolean;
  };
}

export const OrderItem: React.FC<OrderItemProps> = ({ title, user, price, time, active = false, completed = false, hoverEffect = false, onRate, onFinish, onCancel, onStart, onClick, details }) => {
  const [canFinish, setCanFinish] = useState(false);
  const [canCancelNow, setCanCancelNow] = useState(true);
  const [canStartNow, setCanStartNow] = useState(false);
  const [timerText, setTimerText] = useState('');
  const [cancelTimerText, setCancelTimerText] = useState('');
  const [startTimerText, setStartTimerText] = useState('');

  useEffect(() => {
    const checkTime = () => {
      const now = new Date().getTime();

      if (active && details?.startTime) {
        const start = new Date(details.startTime).getTime();
        const diffMs = now - start;
        const diffMins = diffMs / (1000 * 60);

        // Finish button: 15 min elapsed
        if (diffMins >= 15) {
          setCanFinish(true);
          setTimerText('');
        } else {
          setCanFinish(false);
          const remainingMs = (15 * 60 * 1000) - diffMs;
          const mins = Math.floor(remainingMs / 60000);
          const secs = Math.floor((remainingMs % 60000) / 1000);
          setTimerText(`${mins}:${secs.toString().padStart(2, '0')}`);
        }

        // Cancel button: disabled for 15 min after session starts
        if (diffMins >= 15) {
          setCanCancelNow(true);
          setCancelTimerText('');
        } else {
          setCanCancelNow(false);
          const remainingMs = (15 * 60 * 1000) - diffMs;
          const mins = Math.floor(remainingMs / 60000);
          const secs = Math.floor((remainingMs % 60000) / 1000);
          setCancelTimerText(`(${mins}:${secs.toString().padStart(2, '0')})`);
        }
      }

      if (onStart && !active && !completed) {
        const scheduledTime = new Date(time).getTime();
        const diffMs = scheduledTime - now;
        const diffMins = diffMs / (1000 * 60);
        if (diffMins <= 15) {
          setCanStartNow(true);
        } else {
          setCanStartNow(false);
          const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
          const hours = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          if (hours > 0) {
            setStartTimerText(`(${hours}j ${mins}m)`);
          } else {
            setStartTimerText(`(${mins}:${secs.toString().padStart(2, '0')})`);
          }
        }
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [active, details?.startTime, onStart, completed, time]);

  return (
    <div
      onClick={onClick}
      className={`bg-bg-card p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
      active ? 'border-orange-primary/40 shadow-sm shadow-orange-primary/5' :
      completed ? 'opacity-50 hover:opacity-80 border-border-main' : 'border-border-main hover:border-text-faint/30'
    } ${hoverEffect ? 'hover:translate-x-0.5' : ''}`}>
      <div className="flex justify-between items-start mb-1">
        <strong className="text-text-main text-sm font-semibold truncate max-w-[70%]">{title}</strong>
        <span className="text-orange-primary text-xs font-semibold font-mono">{price}</span>
      </div>
      <p className="text-text-muted text-xs mb-3">Oleh: <span className="text-text-main/70">{user}</span></p>

      {active && details && (
        <div className="mb-3 p-3 bg-bg-main rounded-lg border border-border-main/50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-text-muted font-medium">ID Pesanan</p>
              <p className="text-xs font-semibold text-text-main">#{details.id}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-medium">ID Kijo</p>
              <p className="text-xs font-semibold text-text-main">#{details.kijoId}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-medium">ID Jokies</p>
              <p className="text-xs font-semibold text-text-main">#{details.jokiesId}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-medium">Durasi</p>
              <p className="text-xs font-semibold text-text-main">{formatDuration(details.duration)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-orange-primary animate-pulse' : completed ? 'bg-emerald-500' : 'bg-text-faint'}`} />
          <span className={`text-xs font-medium ${active ? 'text-orange-primary' : 'text-text-muted'}`}>
            {time}
          </span>
        </div>

        {active && (
          <div className="flex gap-2">
            <button
              disabled={!canCancelNow}
              onClick={(e) => { if (!canCancelNow) return; e.stopPropagation(); onCancel?.(); }}
              className={`text-[11px] font-semibold border px-2.5 py-1 rounded-lg transition-all ${
                canCancelNow
                  ? 'text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white hover:border-red-500'
                  : 'text-text-faint border-border-main opacity-40 cursor-not-allowed'
              }`}
            >
              {canCancelNow ? 'Batal' : `Batal ${cancelTimerText}`}
            </button>
            <button
              disabled={!canFinish || !details?.hasProofs}
              onClick={(e) => { e.stopPropagation(); onFinish?.(); }}
              className={`text-[11px] font-semibold border px-2.5 py-1 rounded-lg transition-all ${
                canFinish && details?.hasProofs
                  ? 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                  : 'text-text-faint border-border-main opacity-50 cursor-not-allowed'
              }`}
              title={!details?.hasProofs ? 'Upload bukti sebelum & sesudah terlebih dahulu' : !canFinish ? `Tunggu ${timerText} lagi` : ''}
            >
              {canFinish && details?.hasProofs ? 'Selesai' : !details?.hasProofs ? 'Selesai (butuh bukti)' : `Selesai (${timerText})`}
            </button>
          </div>
        )}

        {onStart && !active && !completed && (
          <button
            disabled={!canStartNow}
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className={`text-[11px] font-semibold border px-3 py-1 rounded-lg transition-all ${
              canStartNow
                ? 'text-orange-primary border-orange-primary/20 hover:bg-orange-primary hover:text-black hover:border-orange-primary cursor-pointer'
                : 'text-text-faint border-border-main opacity-40 cursor-not-allowed'
            }`}
          >
            {canStartNow ? 'Mulai Sesi' : `Mulai Sesi ${startTimerText}`}
          </button>
        )}

        {completed && onRate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRate();
            }}
            className="text-[11px] font-semibold text-orange-primary border border-orange-primary/20 px-2.5 py-1 rounded-lg hover:bg-orange-primary hover:text-black hover:border-orange-primary transition-all"
          >
            Beri Badge
          </button>
        )}
      </div>
    </div>
  );
}
