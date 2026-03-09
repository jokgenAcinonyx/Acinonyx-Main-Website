import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Upload, 
  Image as ImageIcon, 
  X, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
  Star
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

interface KijoVerificationPageProps {
  user: any;
  onBack: () => void;
  onSuccess: () => void;
}

export default function KijoVerificationPage({ user, onBack, onSuccess }: KijoVerificationPageProps) {
  const [step, setStep] = useState(1);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [desiredGame, setDesiredGame] = useState('');
  const [identificationPhotos, setIdentificationPhotos] = useState<string[]>([]);
  const [socialMedia, setSocialMedia] = useState('');
  const [experienceType, setExperienceType] = useState<'experienced' | 'newbie' | null>(null);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetchWithAuth('/api/kijo/available-games');
        if (res.ok) {
          const data = await res.json();
          setAvailableGames(data);
          if (data.length > 0) setDesiredGame(data[0].name);
        }
      } catch (e) {
        console.error('Failed to fetch available games');
      }
    };
    fetchGames();
  }, []);

  const handlePhotoUpload = (type: 'id' | 'proof') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (type === 'id') {
          if (identificationPhotos.length < 5) {
            setIdentificationPhotos(prev => [...prev, base64]);
          }
        } else {
          if (proofPhotos.length < 5) {
            setProofPhotos(prev => [...prev, base64]);
          }
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removePhoto = (type: 'id' | 'proof', index: number) => {
    if (type === 'id') {
      setIdentificationPhotos(identificationPhotos.filter((_, i) => i !== index));
    } else {
      setProofPhotos(proofPhotos.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/kijo/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          identificationPhotos,
          socialMedia,
          experienceType,
          proofPhotos,
          desiredGame
        })
      });

      if (res.ok) {
        alert('Pengajuan Anda telah dikirim! Admin akan memverifikasi data Anda dalam 1-3 hari kerja.');
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.message || 'Gagal mengirim pengajuan.');
      }
    } catch (error) {
      alert('Terjadi kesalahan server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-text-muted hover:text-orange-primary transition-colors mb-8 group"
      >
        <X size={20} className="group-hover:rotate-90 transition-transform" />
        <span className="text-xs font-semibold uppercase tracking-wide">Batal</span>
      </button>

      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary border border-orange-primary/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main tracking-tighter uppercase">Verifikasi <span className="text-orange-primary">Kijo.</span></h1>
            <p className="text-text-muted text-sm font-medium">Lengkapi data diri untuk mulai menjoki di Acinonyx.</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 h-1.5 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`flex-1 rounded-full transition-all duration-500 ${
                s <= step ? 'bg-orange-primary' : 'bg-bg-sidebar border border-border-main'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] font-bold text-text-muted uppercase tracking-widest">
          <span>Pilih Game</span>
          <span>Identitas</span>
          <span>Pengalaman</span>
          <span>Konfirmasi</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pilih Game Untuk Menjoki</label>
                <div className="grid grid-cols-1 gap-3">
                  {availableGames.map((game) => (
                    <button 
                      key={game.name}
                      onClick={() => setDesiredGame(game.name)}
                      className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${
                        desiredGame === game.name 
                          ? 'bg-orange-primary/10 border-orange-primary' 
                          : 'bg-bg-main border-border-main hover:border-text-muted/50'
                      }`}
                    >
                      <div>
                        <h4 className={`font-bold text-sm uppercase tracking-tight mb-1 ${desiredGame === game.name ? 'text-orange-primary' : 'text-text-main'}`}>{game.name}</h4>
                        <p className="text-xs text-text-muted font-medium">Jadilah Kijo profesional di game ini.</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        desiredGame === game.name ? 'bg-orange-primary border-orange-primary text-black' : 'border-border-main'
                      }`}>
                        {desiredGame === game.name && <CheckCircle2 size={14} />}
                      </div>
                    </button>
                  ))}
                  {availableGames.length === 0 && (
                    <p className="text-text-muted text-xs italic p-4 text-center border border-dashed border-border-main rounded-2xl">
                      Maaf, saat ini belum ada game yang tersedia untuk pendaftaran.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full bg-orange-primary text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20 hover:scale-[1.02] transition-all uppercase tracking-widest text-xs"
            >
              Lanjutkan
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Foto Identitas Game {desiredGame} (Profil, Rank, Statistik)</label>
                <p className="text-xs text-text-muted italic mb-4">* Unggah maksimal 5 foto yang menunjukkan nickname, rank saat ini, dan statistik (Winrate/KDA).</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {identificationPhotos.map((url, index) => (
                    <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-border-main group">
                      <img src={url} className="w-full h-full object-cover" alt={`ID ${index}`} />
                      <button 
                        onClick={() => removePhoto('id', index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {identificationPhotos.length < 5 && (
                    <button 
                      onClick={() => handlePhotoUpload('id')}
                      className="aspect-video rounded-xl border-2 border-dashed border-border-main flex flex-col items-center justify-center gap-2 text-text-muted hover:border-orange-primary hover:text-orange-primary transition-all bg-bg-main/50"
                    >
                      <Upload size={20} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Unggah Foto</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Sosial Media Aktif</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input 
                    type="text" 
                    placeholder="Instagram / Facebook / Twitter link..."
                    className="w-full bg-bg-main border border-border-main rounded-xl py-4 pl-12 pr-4 text-sm text-text-main focus:outline-none focus:border-orange-primary transition-all"
                    value={socialMedia}
                    onChange={(e) => setSocialMedia(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setStep(1)}
              className="w-full bg-bg-sidebar border border-border-main text-text-muted font-bold py-5 rounded-2xl hover:bg-bg-card transition-all uppercase tracking-widest text-xs mb-4"
            >
              Kembali
            </button>
            <button 
              disabled={identificationPhotos.length === 0 || !socialMedia}
              onClick={() => setStep(3)}
              className="w-full bg-orange-primary text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest text-xs"
            >
              Lanjutkan
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Pengalaman Menjoki</label>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setExperienceType('experienced')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${
                      experienceType === 'experienced' 
                        ? 'bg-orange-primary/10 border-orange-primary' 
                        : 'bg-bg-main border-border-main hover:border-text-muted/50'
                    }`}
                  >
                    <div>
                      <h4 className={`font-bold text-sm uppercase tracking-tight mb-1 ${experienceType === 'experienced' ? 'text-orange-primary' : 'text-text-main'}`}>Pernah Menjoki Sebelumnya</h4>
                      <p className="text-xs text-text-muted font-medium">Saya memiliki riwayat pengerjaan pesanan joki.</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      experienceType === 'experienced' ? 'bg-orange-primary border-orange-primary text-black' : 'border-border-main'
                    }`}>
                      {experienceType === 'experienced' && <CheckCircle2 size={14} />}
                    </div>
                  </button>

                  <button 
                    onClick={() => setExperienceType('newbie')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${
                      experienceType === 'newbie' 
                        ? 'bg-orange-primary/10 border-orange-primary' 
                        : 'bg-bg-main border-border-main hover:border-text-muted/50'
                    }`}
                  >
                    <div>
                      <h4 className={`font-bold text-sm uppercase tracking-tight mb-1 ${experienceType === 'newbie' ? 'text-orange-primary' : 'text-text-main'}`}>Ingin Merasakan Pengalaman Menjoki</h4>
                      <p className="text-xs text-text-muted font-medium">Saya baru ingin memulai karir sebagai Kijo.</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      experienceType === 'newbie' ? 'bg-orange-primary border-orange-primary text-black' : 'border-border-main'
                    }`}>
                      {experienceType === 'newbie' && <CheckCircle2 size={14} />}
                    </div>
                  </button>
                </div>
              </div>

              {experienceType === 'experienced' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-6 border-t border-border-main"
                >
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Bukti Riwayat Menjoki (Testimoni/History)</label>
                  <p className="text-xs text-text-muted italic mb-4">* Unggah maksimal 5 foto bukti pengerjaan atau testimoni pelanggan sebelumnya.</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {proofPhotos.map((url, index) => (
                      <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-border-main group">
                        <img src={url} className="w-full h-full object-cover" alt={`Proof ${index}`} />
                        <button 
                          onClick={() => removePhoto('proof', index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {proofPhotos.length < 5 && (
                      <button 
                        onClick={() => handlePhotoUpload('proof')}
                        className="aspect-video rounded-xl border-2 border-dashed border-border-main flex flex-col items-center justify-center gap-2 text-text-muted hover:border-orange-primary hover:text-orange-primary transition-all bg-bg-main/50"
                      >
                        <Upload size={20} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide">Unggah Bukti</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {experienceType === 'newbie' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-6 border-t border-border-main"
                >
                  <div className="bg-orange-primary/5 border border-orange-primary/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 text-orange-primary">
                      <AlertTriangle size={20} />
                      <h4 className="text-xs font-semibold uppercase tracking-wide">Peringatan & Aturan Kijo Baru</h4>
                    </div>
                    <ul className="space-y-3">
                      {[
                        'Dilarang keras melakukan penipuan atau pencurian akun pelanggan.',
                        'Wajib menjaga etika dan kesopanan saat berinteraksi dengan pelanggan.',
                        'Penyelesaian pesanan harus sesuai dengan durasi yang dijanjikan.',
                        'Pelanggaran aturan akan mengakibatkan banned permanen dan saldo hangus.'
                      ].map((rule, i) => (
                        <li key={i} className="flex gap-3 text-xs text-text-main font-medium leading-relaxed">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-primary mt-1 shrink-0" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(2)}
                className="flex-1 bg-bg-sidebar border border-border-main text-text-muted font-bold py-5 rounded-2xl hover:bg-bg-card transition-all uppercase tracking-widest text-xs"
              >
                Kembali
              </button>
              <button 
                disabled={!experienceType || (experienceType === 'experienced' && proofPhotos.length === 0)}
                onClick={() => setStep(4)}
                className="flex-[2] bg-orange-primary text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest text-xs"
              >
                Lanjutkan
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-bg-sidebar border border-border-main rounded-2xl p-8 space-y-8">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto border border-green-500/20">
                  <Info size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">Konfirmasi Data Diri</h3>
                  <p className="text-text-muted text-xs font-medium">Pastikan semua data yang Anda masukkan sudah benar.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-bg-main rounded-xl border border-border-main">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Game Pilihan</span>
                  <span className="text-xs font-bold text-orange-primary uppercase tracking-widest">{desiredGame}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-bg-main rounded-xl border border-border-main">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Foto Identitas</span>
                  <span className="text-xs font-bold text-text-main">{identificationPhotos.length} Foto</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-bg-main rounded-xl border border-border-main">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Sosial Media</span>
                  <span className="text-xs font-bold text-text-main truncate max-w-[150px]">{socialMedia}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-bg-main rounded-xl border border-border-main">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Tipe Pengalaman</span>
                  <span className="text-xs font-bold text-orange-primary uppercase tracking-widest">
                    {experienceType === 'experienced' ? 'Berpengalaman' : 'Baru'}
                  </span>
                </div>
                {experienceType === 'experienced' && (
                  <div className="flex justify-between items-center p-4 bg-bg-main rounded-xl border border-border-main">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Foto Bukti</span>
                    <span className="text-xs font-bold text-text-main">{proofPhotos.length} Foto</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-orange-primary/5 border border-orange-primary/20 rounded-xl flex gap-3">
                <Info size={16} className="text-orange-primary shrink-0" />
                <p className="text-xs text-text-muted leading-relaxed">
                  Dengan menekan tombol kirim, Anda setuju bahwa data yang diberikan adalah benar dan bersedia mengikuti segala aturan yang berlaku di Acinonyx.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(3)}
                className="flex-1 bg-bg-sidebar border border-border-main text-text-muted font-bold py-5 rounded-2xl hover:bg-bg-card transition-all uppercase tracking-widest text-xs"
              >
                Kembali
              </button>
              <button 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex-[2] bg-orange-primary text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest text-xs"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    KIRIM DATA DIRI
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
