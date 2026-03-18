import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { useAlert } from './AlertContext';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

interface PaymentPageProps {
  user: any;
  kijo: any;
  pkg: any;
  bookingData: any;
  onBack: () => void;
  onSuccess: () => void;
}

export default function PaymentPage({ user, kijo, pkg, bookingData, onBack, onSuccess }: PaymentPageProps) {
  const { showAlert } = useAlert();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1); // 1: Select Method, 2: Summary, 3: Processing, 4: Success, 5: Pending
  const [selectedMethod, setSelectedMethod] = useState('Midtrans');
  const [adminFeePercent, setAdminFeePercent] = useState(10);
  const [loadingFee, setLoadingFee] = useState(true);
  const [snapReady, setSnapReady] = useState(false);
  const [midtransClientKey, setMidtransClientKey] = useState('');
  const idempotencyKeyRef = useRef<string>('');
  const snapTokenRef = useRef<string>('');
  const sessionIdRef = useRef<number>(0);

  // Generate idempotency key once per payment session
  useEffect(() => {
    idempotencyKeyRef.current = `idem-${user.id}-${kijo.id}-${pkg.id || pkg.name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, [user.id, kijo.id, pkg.id, pkg.name]);

  // Fetch admin fee from public endpoint
  useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await fetchWithAuth('/api/settings/admin-fee');
        if (res.ok) {
          const data = await res.json();
          setAdminFeePercent(data.admin_fee || 10);
        }
      } catch (e) {
        console.error('Failed to fetch admin fee');
      } finally {
        setLoadingFee(false);
      }
    };
    fetchFee();
  }, []);

  // Fetch Midtrans client key & load Snap.js
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetchWithAuth('/api/payment/client-key');
        if (res.ok) {
          const data = await res.json();
          setMidtransClientKey(data.clientKey);

          // Load Snap.js if not already loaded
          if (!document.getElementById('midtrans-snap-script')) {
            const snapUrl = data.isProduction
              ? 'https://app.midtrans.com/snap/snap.js'
              : 'https://app.sandbox.midtrans.com/snap/snap.js';

            const script = document.createElement('script');
            script.id = 'midtrans-snap-script';
            script.src = snapUrl;
            script.setAttribute('data-client-key', data.clientKey);
            script.onload = () => setSnapReady(true);
            script.onerror = () => {
              console.error('Failed to load Midtrans Snap.js');
              showAlert('Gagal memuat payment gateway. Coba refresh halaman.', 'error');
            };
            document.head.appendChild(script);
          } else {
            setSnapReady(true);
          }
        }
      } catch (e) {
        console.error('Failed to fetch Midtrans client key');
      }
    };
    init();
  }, []);

  const basePrice = pkg.price * (bookingData.quantity || 1);
  const adminFee = Math.round((basePrice * adminFeePercent) / 100);
  const totalPrice = basePrice + adminFee;

  const handleMidtransPayment = useCallback(async () => {
    if (!snapReady || !window.snap) {
      showAlert('Payment gateway belum siap. Tunggu sebentar...', 'error');
      return;
    }

    setIsProcessing(true);
    setPaymentStep(3);

    try {
      // If we already have a snap token from a previous attempt (idempotency), reuse it
      let snapToken = snapTokenRef.current;

      if (!snapToken) {
        const res = await fetchWithAuth('/api/payment/create-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kijoId: kijo.id,
            title: pkg.name,
            price: pkg.price,
            quantity: bookingData.quantity || 1,
            player_count: bookingData.player_count || 2,
            duration: bookingData.duration || pkg.duration || 1,
            scheduledAt: bookingData.scheduledAt,
            gameTitle: bookingData.gameTitle || kijo.games?.[0] || 'Game',
            rankStart: bookingData.rankStart || '',
            rankEnd: bookingData.rankEnd || '',
            jokiesNickname: bookingData.nickname,
            jokiesGameId: bookingData.gameId,
            jokiesGameAccountId: bookingData.gameAccountId,
            kijoGameAccountId: bookingData.kijoGameAccountId,
            categoryId: bookingData.categoryId,
            dynamic_data: bookingData.dynamic_data,
            idempotencyKey: idempotencyKeyRef.current,
          }),
        });

        if (!res.ok) {
          let msg = 'Gagal membuat transaksi pembayaran.';
          try { const err = await res.json(); msg = err.message || msg; } catch {}
          showAlert(msg, 'error');
          setPaymentStep(1);
          setIsProcessing(false);
          return;
        }

        const data = await res.json();
        snapToken = data.snapToken;
        snapTokenRef.current = snapToken;
        if (data.sessionId) sessionIdRef.current = data.sessionId;
      }

      // Open Midtrans Snap popup
      window.snap!.pay(snapToken, {
        onSuccess: async () => {
          setPaymentStep(4);
          setIsProcessing(false);
          // Verify payment with server — retry up to 3 times since Midtrans may need a moment to confirm settlement
          if (sessionIdRef.current) {
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));
                const vRes = await fetchWithAuth(`/api/payment/verify/${sessionIdRef.current}`, { method: 'POST' });
                if (vRes.ok) {
                  const vData = await vRes.json();
                  if (vData.success && vData.status === 'settlement') break;
                }
              } catch {}
            }
          }
        },
        onPending: () => {
          setPaymentStep(5);
          setIsProcessing(false);
        },
        onError: (result: any) => {
          console.error('Midtrans payment error:', result);
          showAlert('Pembayaran gagal. Silakan coba lagi.', 'error');
          setPaymentStep(1);
          setIsProcessing(false);
          // Reset idempotency key for new attempt
          idempotencyKeyRef.current = `idem-${user.id}-${kijo.id}-${pkg.id || pkg.name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          snapTokenRef.current = '';
        },
        onClose: () => {
          // User closed the popup without completing payment
          setPaymentStep(1);
          setIsProcessing(false);
        },
      });

    } catch (error) {
      console.error('Payment error:', error);
      showAlert('Terjadi kesalahan. Silakan coba lagi.', 'error');
      setPaymentStep(1);
      setIsProcessing(false);
    }
  }, [snapReady, kijo, pkg, bookingData, user]);

  const handleWalletPayment = async () => {
    setIsProcessing(true);
    setPaymentStep(3);

    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const res = await fetchWithAuth('/api/jokies/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jokiesId: user.id,
          kijoId: kijo.id,
          title: pkg.name,
          price: pkg.price,
          quantity: bookingData.quantity || 1,
          player_count: bookingData.player_count || 2,
          duration: bookingData.duration || pkg.duration || 1,
          scheduledAt: bookingData.scheduledAt,
          gameTitle: bookingData.gameTitle || kijo.games?.[0] || 'Game',
          rankStart: bookingData.rankStart || '',
          rankEnd: bookingData.rankEnd || '',
          paymentMethod: 'Wallet',
          jokiesNickname: bookingData.nickname,
          jokiesGameId: bookingData.gameId,
          jokiesGameAccountId: bookingData.gameAccountId,
          kijoGameAccountId: bookingData.kijoGameAccountId,
          categoryId: bookingData.categoryId,
          dynamic_data: bookingData.dynamic_data
        })
      });

      if (res.ok) {
        setPaymentStep(4);
      } else {
        let msg = 'Gagal memproses pembayaran.';
        try { const err = await res.json(); msg = err.message || msg; } catch {}
        showAlert(msg, 'error');
        setPaymentStep(1);
      }
    } catch (error) {
      showAlert('Terjadi kesalahan server.', 'error');
      setPaymentStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulasiPayment = async () => {
    setIsProcessing(true);
    setPaymentStep(3);
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await fetchWithAuth('/api/jokies/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jokiesId: user.id,
          kijoId: kijo.id,
          title: pkg.name,
          price: pkg.price,
          quantity: bookingData.quantity || 1,
          player_count: bookingData.player_count || 2,
          duration: bookingData.duration || pkg.duration || 1,
          scheduledAt: bookingData.scheduledAt,
          gameTitle: bookingData.gameTitle || kijo.games?.[0] || 'Game',
          rankStart: bookingData.rankStart || '',
          rankEnd: bookingData.rankEnd || '',
          paymentMethod: 'Simulasi',
          jokiesNickname: bookingData.nickname,
          jokiesGameId: bookingData.gameId,
          jokiesGameAccountId: bookingData.gameAccountId,
          kijoGameAccountId: bookingData.kijoGameAccountId,
          categoryId: bookingData.categoryId,
          dynamic_data: bookingData.dynamic_data
        })
      });

      if (res.ok) {
        setPaymentStep(4);
      } else {
        let msg = 'Gagal memproses pembayaran.';
        try { const err = await res.json(); msg = err.message || msg; } catch {}
        showAlert(msg, 'error');
        setPaymentStep(1);
      }
    } catch (error) {
      showAlert('Terjadi kesalahan server.', 'error');
      setPaymentStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = () => {
    if (selectedMethod === 'Midtrans') {
      handleMidtransPayment();
    } else if (selectedMethod === 'Wallet') {
      handleWalletPayment();
    } else {
      handleSimulasiPayment();
    }
  };

  // ── Step 4: Success ──
  if (paymentStep === 4) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-8 shadow-2xl shadow-green-500/20">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl md:text-4xl font-bold text-text-main mb-4 tracking-tighter">PEMBAYARAN BERHASIL!</h2>
        <p className="text-text-muted text-center max-w-md mb-4 font-medium">
          Pesanan Anda telah diteruskan ke Partner. Dana ditahan dalam Escrow hingga pesanan selesai.
        </p>
        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-6 mb-10 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">ESCROW AKTIF</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Dana Rp {totalPrice.toLocaleString()} ditahan sistem. Akan dicairkan ke Partner setelah kedua pihak mengonfirmasi pesanan selesai.
          </p>
        </div>
        <button 
          onClick={onSuccess}
          className="bg-orange-primary text-black font-bold px-12 py-5 rounded-2xl text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/20"
        >
          LIHAT PESANAN SAYA
        </button>
      </div>
    );
  }

  // ── Step 5: Pending (bank transfer, etc.) ──
  if (paymentStep === 5) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-8 shadow-2xl shadow-amber-500/20">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /><circle cx="12" cy="12" r="10" /></svg>
        </div>
        <h2 className="text-xl md:text-4xl font-bold text-text-main mb-4 tracking-tighter">MENUNGGU PEMBAYARAN</h2>
        <p className="text-text-muted text-center max-w-md mb-10 font-medium">
          Silakan selesaikan pembayaran sesuai instruksi. Pesanan akan aktif otomatis setelah pembayaran dikonfirmasi.
        </p>
        <button 
          onClick={onSuccess}
          className="bg-orange-primary text-black font-bold px-12 py-5 rounded-2xl text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-primary/20"
        >
          LIHAT PESANAN SAYA
        </button>
      </div>
    );
  }

  // ── Step 3: Processing ──
  if (paymentStep === 3) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 border-4 border-orange-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-primary/20" />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-main uppercase tracking-tighter mb-2">Memproses Pembayaran</h2>
          <p className="text-text-muted text-xs font-bold uppercase tracking-widest animate-pulse">Mohon jangan tutup halaman ini...</p>
        </div>
      </div>
    );
  }

  // ── Step 2: Summary ──
  if (paymentStep === 2) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setPaymentStep(1)}
          className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest"
        >
          <ArrowLeft size={16} /> Kembali ke Metode Pembayaran
        </button>

        <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 md:p-12 shadow-2xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-text-main uppercase tracking-tighter mb-2">Ringkasan Pembayaran</h2>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Konfirmasi Detail Pesanan Anda</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Metode Bayar</p>
                <p className="text-sm font-bold text-orange-primary uppercase">{selectedMethod}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Waktu Transaksi</p>
                <p className="text-sm font-bold text-text-main">{new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Jadwal Mabar</p>
                <p className="text-sm font-bold text-text-main">{new Date(bookingData.scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Kijo (Partner)</p>
                <p className="text-sm font-bold text-text-main">{kijo.full_name}</p>
              </div>
            </div>

            <div className="p-6 bg-bg-main rounded-2xl border border-border-main space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Layanan</p>
                <p className="text-sm font-bold text-text-main">{pkg.name} {bookingData.quantity > 1 ? `(x${bookingData.quantity})` : ''}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Game</p>
                <p className="text-sm font-bold text-text-main">{bookingData.gameTitle}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-border-main space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted font-bold">Harga Layanan {bookingData.quantity > 1 ? `(x${bookingData.quantity})` : ''}</span>
                <span className="text-text-main font-bold">Rp {basePrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted font-bold">Biaya Penanganan ({adminFeePercent}%)</span>
                <span className="text-text-main font-bold">Rp {adminFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-border-main">
                <span className="text-lg font-bold text-text-main uppercase">Total Bayar</span>
                <span className="text-3xl font-bold text-orange-primary font-mono">Rp {totalPrice.toLocaleString()}</span>
              </div>
            </div>

            {selectedMethod === 'Midtrans' && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Escrow System</p>
                <p className="text-[11px] text-amber-400/80 leading-relaxed">
                  Dana akan ditahan oleh sistem (Escrow). Dana hanya dicairkan ke Partner setelah kedua pihak mengonfirmasi pesanan selesai.
                </p>
              </div>
            )}

            <button 
              onClick={handlePayment}
              disabled={isProcessing || (selectedMethod === 'Midtrans' && !snapReady)}
              className="w-full bg-orange-primary hover:bg-orange-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-6 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-3 text-lg mt-8"
            >
              {selectedMethod === 'Simulasi' ? 'KONFIRMASI & BUAT PESANAN (SIMULASI)'
                : selectedMethod === 'Wallet' ? 'KONFIRMASI & BAYAR SEKARANG'
                : (snapReady ? 'BAYAR DENGAN MIDTRANS' : 'Memuat Payment Gateway...')}
            </button>
            
            <p className="text-xs text-text-muted text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              Transaksi Aman & Terenkripsi
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Select Payment Method ──
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors font-bold uppercase text-xs tracking-widest"
      >
        <ArrowLeft size={16} /> Kembali ke Detail Kijo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-text-main mb-6 flex items-center gap-3">
              Pilih Metode Pembayaran
            </h3>
            
            <div className="space-y-4">
              {/* Midtrans — Real Payment */}
              <button 
                onClick={() => setSelectedMethod('Midtrans')}
                className={`w-full p-6 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                  selectedMethod === 'Midtrans' ? 'border-orange-primary bg-orange-primary/5' : 'border-border-main bg-bg-main hover:border-orange-primary/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${selectedMethod === 'Midtrans' ? 'bg-orange-primary text-black' : 'bg-bg-sidebar text-text-muted'}`}>
                  PAY
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-main mb-1">Pembayaran Online</p>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-tight">GoPay, QRIS, Bank Transfer, Kartu Kredit & Lainnya</p>
                  {selectedMethod === 'Midtrans' && !snapReady && (
                    <p className="text-[10px] text-amber-400 mt-2 animate-pulse">Memuat payment gateway...</p>
                  )}
                </div>
              </button>

              {/* Wallet */}
              <button 
                onClick={() => setSelectedMethod('Wallet')}
                className={`w-full p-6 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                  selectedMethod === 'Wallet' ? 'border-orange-primary bg-orange-primary/5' : 'border-border-main bg-bg-main hover:border-orange-primary/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${selectedMethod === 'Wallet' ? 'bg-orange-primary text-black' : 'bg-bg-sidebar text-text-muted'}`}>
                  W
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main mb-1">Saldo Refund</p>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-tight">
                    Saldo: Rp {(user.wallet_jokies ?? 0).toLocaleString()}
                    {(user.wallet_jokies ?? 0) < totalPrice && <span className="text-red-400 ml-2">(Tidak cukup)</span>}
                  </p>
                </div>
              </button>

              {/* Simulasi — Demo only */}
              <button 
                onClick={() => setSelectedMethod('Simulasi')}
                className={`w-full p-6 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                  selectedMethod === 'Simulasi' ? 'border-orange-primary bg-orange-primary/5' : 'border-border-main bg-bg-main hover:border-orange-primary/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${selectedMethod === 'Simulasi' ? 'bg-orange-primary text-black' : 'bg-bg-sidebar text-text-muted'}`}>
                  SIM
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main mb-1">Simulasi Pembayaran</p>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-tight">Demo · Tanpa pembayaran nyata</p>
                </div>
              </button>
            </div>

            {selectedMethod === 'Simulasi' && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-start gap-3">
                <div>
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-0.5">Mode Simulasi Aktif</p>
                  <p className="text-[11px] text-yellow-400/80 leading-relaxed">Pesanan akan dibuat tanpa pemotongan saldo. Gunakan untuk demo & testing alur pemesanan.</p>
                </div>
              </div>
            )}

            <div className="mt-4 p-6 bg-bg-main rounded-2xl border border-border-main flex items-start gap-4">
              <div>
                <h4 className="text-sm font-bold text-text-main mb-1">Acinonyx Escrow System</h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Dana Anda akan ditahan oleh sistem kami (Escrow) dan hanya akan dicairkan ke Partner setelah Anda mengonfirmasi pesanan selesai. Aman & terlindungi.
                </p>
              </div>
            </div>

            {/* Refund Policy */}
            <div className="mt-4 p-6 bg-bg-main rounded-2xl border border-border-main">
              <h4 className="text-sm font-bold text-text-main mb-3">Kebijakan Refund</h4>
              <div className="space-y-2 text-[11px] text-text-muted leading-relaxed">
                <p><span className="font-bold text-text-main">Dibatalkan oleh Kijo:</span> Refund 100% (harga + biaya admin) ke Saldo Refund</p>
                <p><span className="font-bold text-text-main">Dibatalkan oleh Jokies:</span> Refund parsial (harga saja, biaya admin tidak dikembalikan) + cooldown 1 jam</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="space-y-6">
          <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 shadow-sm sticky top-24">
            <h3 className="text-lg font-bold text-text-main mb-6 uppercase tracking-tight">Ringkasan Pesanan</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Layanan</p>
                  <p className="text-sm font-bold text-text-main">{pkg.name} {bookingData.quantity > 1 ? `(x${bookingData.quantity})` : ''}</p>
                </div>
                <p className="text-sm font-bold text-text-main font-mono">Rp {basePrice.toLocaleString()}</p>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Partner</p>
                  <p className="text-sm font-bold text-text-main">{kijo.full_name}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border-main space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted font-bold">Biaya Penanganan ({adminFeePercent}%)</span>
                  <span className="text-text-main font-bold">Rp {adminFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-border-main">
                  <span className="text-sm font-bold text-text-main uppercase">Total Bayar</span>
                  <span className="text-2xl font-bold text-orange-primary font-mono">Rp {totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (selectedMethod === 'Wallet' && (user.wallet_jokies ?? 0) < totalPrice) {
                  showAlert('Saldo Wallet tidak mencukupi.', 'error');
                  return;
                }
                setPaymentStep(2);
              }}
              className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-5 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-2"
            >
              LANJUT KE RINGKASAN
            </button>
            
            <p className="text-xs text-text-muted text-center mt-4 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              Cooldown pembatalan 15 menit berlaku
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
