import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, CreditCard, Wallet, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface PaymentPageProps {
  user: any;
  kijo: any;
  pkg: any;
  bookingData: any;
  onBack: () => void;
  onSuccess: () => void;
}

export default function PaymentPage({ user, kijo, pkg, bookingData, onBack, onSuccess }: PaymentPageProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1); // 1: Select Method, 2: Summary, 3: Processing, 4: Success
  const [selectedMethod, setSelectedMethod] = useState('Wallet');
  const [adminFeePercent, setAdminFeePercent] = useState(10);
  const [loadingFee, setLoadingFee] = useState(true);

  React.useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await fetchWithAuth('/api/admin/settings');
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

  const basePrice = pkg.price * (bookingData.quantity || 1);
  const adminFee = Math.round((basePrice * adminFeePercent) / 100);
  const totalPrice = basePrice + adminFee;

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentStep(3);
    
    // Simulate payment processing delay
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
          gameTitle: bookingData.gameTitle || kijo.games[0] || 'Game',
          rankStart: bookingData.rankStart || '',
          rankEnd: bookingData.rankEnd || '',
          paymentMethod: selectedMethod,
          jokiesNickname: bookingData.nickname,
          jokiesGameId: bookingData.gameId,
          jokiesGameAccountId: bookingData.gameAccountId,
          categoryId: bookingData.categoryId,
          dynamic_data: bookingData.dynamic_data
        })
      });

      if (res.ok) {
        setPaymentStep(4);
      } else {
        alert('Gagal memproses pembayaran.');
        setPaymentStep(1);
      }
    } catch (error) {
      alert('Terjadi kesalahan server.');
      setPaymentStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentStep === 4) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-8 shadow-2xl shadow-green-500/20">
          <CheckCircle2 size={64} />
        </div>
        <h2 className="text-xl md:text-4xl font-bold text-text-main mb-4 tracking-tighter">PEMBAYARAN BERHASIL!</h2>
        <p className="text-text-muted text-center max-w-md mb-10 font-medium">
          Pesanan Anda telah diteruskan ke Partner. Silakan cek menu Pesanan untuk memantau status pengerjaan.
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
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Order ID</p>
                <p className="text-sm font-bold text-text-main">Menunggu konfirmasi...</p>
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
              <div className="flex justify-between items-center">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Metode Bayar</p>
                <p className="text-sm font-bold text-orange-primary uppercase">{selectedMethod}</p>
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

            <button 
              onClick={handlePayment}
              className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-6 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-3 text-lg mt-8"
            >
              KONFIRMASI & BAYAR SEKARANG
            </button>
            
            <p className="text-xs text-text-muted text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <Shield size={10} /> Transaksi Aman & Terenkripsi
            </p>
          </div>
        </div>
      </div>
    );
  }

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
              <CreditCard className="text-orange-primary" /> Pilih Metode Pembayaran
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PaymentMethod 
                id="Wallet"
                name="Wallet Jokies"
                balance={`Rp ${user.wallet_jokies?.toLocaleString() || '0'}`}
                icon={<Wallet size={24} />}
                selected={selectedMethod === 'Wallet'}
                onClick={() => setSelectedMethod('Wallet')}
              />
              <PaymentMethod 
                id="QRIS"
                name="QRIS / E-Wallet"
                balance="OVO, Dana, GoPay"
                icon={<Zap size={24} />}
                selected={selectedMethod === 'QRIS'}
                onClick={() => setSelectedMethod('QRIS')}
              />
            </div>

            <div className="mt-8 p-6 bg-bg-main rounded-2xl border border-border-main flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-main mb-1">Acinonyx Escrow System</h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Dana Anda akan ditahan oleh sistem kami dan hanya akan disalurkan ke Partner setelah Anda mengonfirmasi pesanan selesai.
                </p>
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
              onClick={() => setPaymentStep(2)}
              className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-5 rounded-2xl shadow-xl shadow-orange-primary/20 transition-all flex items-center justify-center gap-2"
            >
              BAYAR SEKARANG
            </button>
            
            <p className="text-xs text-text-muted text-center mt-4 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <AlertCircle size={10} /> Cooldown pembatalan 15 menit berlaku
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMethod({ id, name, balance, icon, selected, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-6 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
        selected ? 'border-orange-primary bg-orange-primary/5' : 'border-border-main bg-bg-main hover:border-orange-primary/30'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selected ? 'bg-orange-primary text-black' : 'bg-bg-sidebar text-text-muted'}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-text-main mb-1">{name}</p>
        <p className="text-xs text-text-muted font-bold uppercase tracking-tight">{balance}</p>
      </div>
    </button>
  );
}
