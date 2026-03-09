import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, Shield, AlertCircle, CheckCircle2, CreditCard, Banknote, Landmark } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface WithdrawalPageProps {
  user: any;
  mode: 'jokies' | 'kijo';
  onBack: () => void;
  onSuccess: () => void;
}

export default function WithdrawalPage({ user, mode, onBack, onSuccess }: WithdrawalPageProps) {
  const [step, setStep] = useState(1); // 1: Form, 2: Processing, 3: Success
  const [showTC, setShowTC] = useState(false);
  
  const balance = mode === 'kijo' ? (user.balance_active || 0) : (user.wallet_jokies || 0);
  const [amount, setAmount] = useState<string>(Math.min(balance, 20000).toString());
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    accountNumber: '',
    accountName: ''
  });

  const handleAmountChange = (val: string) => {
    // Remove non-numeric chars
    const numeric = val.replace(/[^0-9]/g, '');
    // Remove leading zeros
    const cleaned = numeric.replace(/^0+/, '');
    setAmount(cleaned || '0');
  };

  const handleWithdraw = async () => {
    const numericAmount = Number(amount);
    if (numericAmount < 20000) {
      alert('Minimal penarikan adalah Rp 20.000');
      return;
    }
    if (numericAmount > balance) {
      alert('Saldo tidak mencukupi');
      return;
    }

    setStep(2);
    try {
      const endpoint = mode === 'kijo' ? '/api/kijo/withdraw' : '/api/jokies/withdraw';
      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: numericAmount,
          method: 'Bank Transfer',
          bankInfo
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStep(3);
      } else {
        alert(data.message || 'Gagal memproses penarikan');
        setStep(1);
      }
    } catch (error) {
      alert('Terjadi kesalahan server');
      setStep(1);
    }
  };

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-8 shadow-2xl shadow-green-500/20">
          <CheckCircle2 size={64} />
        </div>
        <h2 className="text-4xl font-bold text-text-main mb-4 tracking-tighter uppercase">Pengajuan Berhasil!</h2>
        <p className="text-text-muted text-center max-w-md mb-10 font-medium">
          Permintaan penarikan dana Anda sedang diproses. Dana akan masuk ke saldo Anda dalam waktu maksimal 7 hari kerja.
        </p>
        <button 
          onClick={onSuccess}
          className="bg-orange-primary text-black font-bold px-12 py-5 rounded-2xl text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/20"
        >
          KEMBALI KE BERANDA
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 md:px-0">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest"
      >
        <ArrowLeft size={16} /> Kembali
      </button>

      <div className="bg-bg-sidebar border border-border-main rounded-2xl sm:rounded-2xl p-5 sm:p-10 shadow-xl">
        <div className="flex items-center gap-4 mb-6 sm:mb-10">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-orange-primary shadow-lg shadow-orange-primary/5">
            <Wallet size={20} className="sm:size-32" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-bold text-text-main tracking-tighter uppercase">Tarik Dana <span className="text-orange-primary">{mode === 'kijo' ? 'Pendapatan.' : 'Refund.'}</span></h2>
            <p className="text-text-muted text-xs sm:text-sm font-medium">
              {mode === 'kijo' ? 'Tarik pendapatan Anda ke rekening bank.' : 'Pindahkan saldo refund ke saldo aktif Anda.'}
            </p>
          </div>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {/* Balance Info */}
          <div className="bg-bg-main p-6 sm:p-8 rounded-2xl sm:rounded-2xl border border-border-main flex justify-between items-center">
            <div>
              <p className="text-xs sm:text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Saldo Tersedia</p>
              <p className="text-2xl sm:text-3xl font-bold text-text-main font-mono">Rp {balance.toLocaleString() || '0'}</p>
            </div>
            <Banknote size={32} className="text-orange-primary/20 sm:size-40" />
          </div>

          {/* Bank Info Form for Kijo */}
          {mode === 'kijo' && (
            <div className="space-y-4 p-6 bg-bg-main rounded-2xl border border-border-main">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Informasi Rekening</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Nama Bank</label>
                  <input 
                    type="text"
                    value={bankInfo.bankName}
                    onChange={(e) => setBankInfo(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full bg-bg-sidebar border border-border-main rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-orange-primary"
                    placeholder="Contoh: BCA, Mandiri, GoPay"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Nomor Rekening</label>
                  <input 
                    type="text"
                    value={bankInfo.accountNumber}
                    onChange={(e) => setBankInfo(prev => ({ ...prev, accountNumber: e.target.value }))}
                    className="w-full bg-bg-sidebar border border-border-main rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-orange-primary"
                    placeholder="0000000000"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest ml-1">Nama Pemilik Rekening</label>
                  <input 
                    type="text"
                    value={bankInfo.accountName}
                    onChange={(e) => setBankInfo(prev => ({ ...prev, accountName: e.target.value }))}
                    className="w-full bg-bg-sidebar border border-border-main rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-orange-primary"
                    placeholder="Sesuai buku tabungan"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Jumlah Penarikan</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted font-bold">Rp</span>
                <input 
                  type="text" 
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full bg-bg-main border border-border-main rounded-2xl py-5 pl-12 pr-6 text-xl font-bold text-text-main focus:outline-none focus:border-orange-primary transition-all"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Terms & Conditions Toggle */}
          <div className="flex justify-center">
            <button 
              onClick={() => setShowTC(true)}
              className="text-xs font-bold text-orange-primary uppercase tracking-wider border-b border-orange-primary/30 pb-0.5 hover:text-orange-primary/80 transition-all"
            >
              Lihat Syarat & Ketentuan Penarikan
            </button>
          </div>

          {/* T&C Modal */}
          <AnimatePresence>
            {showTC && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowTC(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-text-main tracking-tight uppercase">S&K <span className="text-orange-primary">Penarikan Dana.</span></h3>
                    <button onClick={() => setShowTC(false)} className="p-2 text-text-muted hover:text-orange-primary transition-colors">
                      <ArrowLeft size={20} className="rotate-90" />
                    </button>
                  </div>

                  <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-orange-primary uppercase tracking-widest">Kasus 1: Dibatalkan oleh Partner (KIJO)</h4>
                      <ul className="space-y-2 text-[11px] text-text-muted font-medium leading-relaxed list-disc pl-4">
                        <li>Saldo bertambah sebesar harga paket saja + Admin Fee (Refund 100%).</li>
                        <li>Dana dapat langsung ditarik tanpa cooldown.</li>
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-orange-primary uppercase tracking-widest">Kasus 2: Dibatalkan oleh Anda (Jokies)</h4>
                      <ul className="space-y-2 text-[11px] text-text-muted font-medium leading-relaxed list-disc pl-4">
                        <li>Saldo bertambah sebesar harga paket saja.</li>
                        <li>Admin Fee tidak dikembalikan.</li>
                        <li className="text-orange-primary font-bold">Tidak dapat melakukan pemesanan selama 60 menit setelah pembatalan.</li>
                        <li>Jika dana tidak ditarik selama 7 hari, maka bebas biaya admin transfer.</li>
                        <li>Jika dana ditarik di bawah 7 hari, biaya admin transfer ditanggung oleh Jokies (dipotong dari saldo).</li>
                        <li>Saldo yang dikembalikan akan terkena biaya layanan transfer dari pihak gateway.</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-bg-main rounded-2xl border border-border-main">
                      <p className="text-xs text-text-muted italic leading-relaxed">
                        * Penjelasan Poin 7 Hari: Kami memberikan apresiasi bagi pengguna yang menyimpan dananya di sistem kami. Jika Anda bersedia menunggu 7 hari sebelum menarik dana refund, kami akan menanggung seluruh biaya transfer antar bank. Namun jika ditarik segera, biaya tersebut akan dibebankan kepada Anda.
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowTC(false)}
                    className="w-full mt-8 bg-orange-primary text-black font-bold py-4 rounded-xl text-xs uppercase tracking-widest"
                  >
                    SAYA MENGERTI
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <button 
            onClick={handleWithdraw}
            disabled={step === 2 || Number(amount) <= 0}
            className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-5 sm:py-6 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
          >
            {step === 2 ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                MEMPROSES PENARIKAN...
              </>
            ) : (
              'KONFIRMASI PENARIKAN DANA'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
