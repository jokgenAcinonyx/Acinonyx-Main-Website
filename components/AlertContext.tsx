import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type AlertType = 'error' | 'success' | 'warning' | 'info';

interface Alert {
  id: number;
  type: AlertType;
  message: string;
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
}

const AlertContext = createContext<AlertContextType>({ showAlert: () => {} });

export const useAlert = () => useContext(AlertContext);

let alertIdCounter = 0;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const showAlert = useCallback((message: string, type: AlertType = 'error') => {
    const id = ++alertIdCounter;
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  }, []);

  const removeAlert = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const iconMap = {
    error: <AlertCircle size={16} />,
    success: <CheckCircle2 size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
  };

  const colorMap = {
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: 'text-red-500' },
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'text-emerald-500' },
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: 'text-yellow-500' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'text-blue-500' },
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
        <AnimatePresence>
          {alerts.map(alert => {
            const colors = colorMap[alert.type];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto ${colors.bg} border ${colors.border} rounded-xl p-3.5 flex items-start gap-3 shadow-2xl backdrop-blur-md`}
              >
                <div className={`${colors.icon} shrink-0 mt-0.5`}>{iconMap[alert.type]}</div>
                <p className={`${colors.text} text-xs font-bold uppercase tracking-wide flex-1 leading-relaxed`}>{alert.message}</p>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className={`${colors.icon} shrink-0 hover:opacity-70 transition-opacity`}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AlertContext.Provider>
  );
}
