import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAlert } from './AlertContext';

interface AuthPageProps {
  onLogin: (user: any) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const { showAlert } = useAlert();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [step, setStep] = useState(1); // 1: Form, 2: OTP
  const initialFormData = {
    identity: '', // for login
    username: '',
    email: '',
    phone: '',
    password: '',
    full_name: '',
    role: 'jokies',
    birth_date: '',
    otp: '',
    otp_method: 'email' as 'email' | 'phone'
  };

  const [formData, setFormData] = useState(initialFormData);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [tempToken, setTempToken] = useState<string>('');
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone'>('email');
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle potential multiple characters if not from paste
      value = value[0];
    }
    if (!/^\d*$/.test(value)) return;

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);
    setFormData({ ...formData, otp: newOtpValues.join('') });

    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    
    const newOtpValues = [...otpValues];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtpValues[i] = char;
    });
    setOtpValues(newOtpValues);
    setFormData({ ...formData, otp: newOtpValues.join('') });
    
    const nextIndex = Math.min(pastedData.length, 5);
    otpRefs[nextIndex].current?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const validateEmail = (email: string) => {
    return email.endsWith('@gmail.com') || email.endsWith('@yahoo.com');
  };

  const validatePassword = (pass: string) => {
    // Larang Emoji (Unicode Property Escape)
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (emojiRegex.test(pass)) return false;

    // Require min 8 chars, uppercase, lowercase, number, symbol
    return pass.length >= 8 && /[A-Z]/.test(pass) && /[a-z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass);
  };

  const validateName = (name: string) => {
    return /^[a-zA-Z\s]*$/.test(name);
  };

  const validateAge = (date: string) => {
    if (!date) return false;
    const birth = new Date(date);
    const age = new Date().getFullYear() - birth.getFullYear();
    return age >= 17;
  };

  const handleSendOTP = async (identifier: string, type: 'email' | 'phone') => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type })
      });
      const data = await res.json();
      if (data.success) {
        setOtpIdentifier(data.identifier || identifier);
        setStep(2);
        setOtpTimer(120);
        setIsOtpSent(true);
        setOtpValues(['', '', '', '', '', '']);
        setFormData(prev => ({ ...prev, otp: '' }));
        return true;
      } else {
        setError(data.message);
        showAlert(`Gagal mengirim OTP: ${data.message}`);
        return false;
      }
    } catch (err) {
      setError('Gagal mengirim OTP');
      showAlert('Gagal mengirim OTP. Silakan periksa koneksi Anda.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (forgotStep === 1) {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        });
        const data = await res.json();
        if (data.success) {
          setForgotStep(2);
          setOtpTimer(120);
          setOtpValues(['', '', '', '', '', '']);
        } else {
          setError(data.message);
        }
      } else if (forgotStep === 2) {
        // Resend forgot password OTP
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        });
        const data = await res.json();
        if (data.success) {
          setOtpTimer(120);
          setOtpValues(['', '', '', '', '', '']);
          setFormData(prev => ({ ...prev, otp: '' }));
        } else {
          setError(data.message);
        }
      } else if (forgotStep === 3) {
        if (!validatePassword(formData.password)) {
          setError('Password minimal 8 karakter dengan huruf besar, kecil, angka, dan simbol (tanpa emoji)');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/auth/reset-password-forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: formData.email, 
            otp: formData.otp, 
            newPassword: formData.password 
          })
        });
        const data = await res.json();
        if (data.success) {
          showAlert('Password berhasil diperbarui, silakan login kembali', 'success');
          setIsForgot(false);
          setForgotStep(1);
          setIsLogin(true);
          setFormData(initialFormData);
        } else {
          setError(data.message);
        }
      }
    } catch (err) {
      setError('Terjadi kesalahan server');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpVerify = async () => {
    setForgotStep(3);
  };

  const handleVerifyOTP = async () => {
    if (isForgot) {
      handleForgotOtpVerify();
      return;
    }
    setError('');
    setLoading(true);
    const identifier = otpIdentifier || (isLogin ? targetIdentifier : (formData.otp_method === 'email' ? formData.email : formData.phone));
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code: formData.otp })
      });
      const data = await res.json();
      if (data.success) {
        if (isLogin) {
          if (tempToken) localStorage.setItem('kijo_token', tempToken);
          onLogin(tempUser);
        } else {
          // Finalize Signup
          const signupRes = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
          const signupData = await signupRes.json();
          if (signupData.success) {
            showAlert('Pendaftaran berhasil! Silakan login untuk melanjutkan.', 'success');
            setIsLogin(true);
            setStep(1);
            setFormData(initialFormData);
            setOtpValues(['', '', '', '', '', '']);
          } else {
            setError(signupData.message);
            showAlert(`Gagal mendaftar: ${signupData.message}`);
            setStep(1);
          }
        }
      } else {
        setError(data.message);
        showAlert(`Verifikasi OTP gagal: ${data.message}`);
      }
    } catch (err) {
      setError('Gagal verifikasi OTP');
      showAlert('Terjadi kesalahan saat verifikasi OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: formData.identity, password: formData.password })
        });
        const data = await res.json();
        if (data.success) {
          setTempUser(data.user);
          if (data.token) setTempToken(data.token);
          setTargetIdentifier(data.targetIdentifier);
          setOtpMethod(data.method);
          // Auto-send OTP for login
          const sent = await handleSendOTP(data.targetIdentifier, data.method);
          if (sent) setStep(2);
        } else {
          setError(data.message);
          showAlert(`Login gagal: ${data.message}`);
        }
      } catch (err) {
        setError('Kesalahan koneksi');
        showAlert('Gagal terhubung ke server. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    } else {
      // Signup Validation
      if (!validateEmail(formData.email)) {
        const msg = 'Hanya domain @gmail.com dan @yahoo.com yang diizinkan';
        setError(msg);
        showAlert(msg);
        return;
      }
      if (!validatePassword(formData.password)) {
        const msg = 'Password minimal 8 karakter dengan huruf besar, kecil, angka, dan simbol (tanpa emoji)';
        setError(msg);
        showAlert(msg);
        return;
      }
      if (!validateName(formData.full_name)) {
        const msg = 'Nama asli tidak boleh mengandung angka atau simbol';
        setError(msg);
        showAlert(msg);
        return;
      }
      if (!validateAge(formData.birth_date)) {
        const msg = 'Usia minimal adalah 17 tahun';
        setError(msg);
        showAlert(msg);
        return;
      }
      
      // Send OTP for Signup
      const identifier = formData.otp_method === 'email' ? formData.email : formData.phone;
      setTargetIdentifier(identifier);
      setOtpMethod(formData.otp_method);
      await handleSendOTP(identifier, formData.otp_method);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 overflow-hidden relative">

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-primary/5 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[1100px] bg-bg-sidebar rounded-2xl border border-border-main overflow-hidden flex flex-col md:flex-row shadow-2xl min-h-[650px]"
      >
        {/* Left Side */}
        <div className="md:w-5/12 bg-gradient-to-br from-bg-sidebar to-bg-main p-8 md:p-12 flex flex-col justify-between relative overflow-hidden border-r border-border-main">
          <div className="relative z-10">
            <div className="mb-8" />

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login-text' : 'signup-text'}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-text-main mb-6 leading-tight">
                  {isLogin ? (
                    <>Akses Panel <br /> <span className="text-orange-primary text-4xl md:text-5xl">Keamanan.</span></>
                  ) : (
                    <>Daftar Akun <br /> <span className="text-orange-primary text-4xl md:text-5xl">Baru.</span></>
                  )}
                </h2>
                <p className="text-text-muted text-base md:text-lg leading-relaxed">
                  {isLogin 
                    ? 'Gunakan Username, Email atau Nomor Telepon Anda untuk masuk ke sistem manajemen Acinonyx.' 
                    : 'Lengkapi data diri Anda untuk bergabung dalam ekosistem joki game profesional.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative z-10 mt-12 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-bg-main/50 rounded-2xl border border-border-main backdrop-blur-sm">
              <div>
                <h4 className="text-text-main font-semibold text-sm">Login aman via Email OTP</h4>
                <p className="text-text-muted text-xs">Verifikasi identitas Anda dengan kode 6-digit.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-bg-sidebar">
          <div className="max-w-md mx-auto w-full">
            {isForgot ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-text-main tracking-tighter uppercase">
                    {forgotStep === 1 ? 'Lupa' : forgotStep === 2 ? 'Verifikasi' : 'Reset'} <span className="text-orange-primary">Password.</span>
                  </h2>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {forgotStep === 1 ? 'Masukkan email bisnis Anda' : forgotStep === 2 ? `Kode OTP dikirim ke ${formData.email}` : 'Buat password baru Anda'}
                  </p>
                </div>

                {forgotStep === 1 && (
                  <form onSubmit={handleForgotSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Email Bisnis</label>
                      <div className="relative">
                        <input 
                          type="email" 
                          required
                          placeholder="email@acinonyx.com"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 animate-shake">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg shadow-orange-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'KIRIM OTP'}
                    </button>

                    <button 
                      type="button"
                      onClick={() => { setIsForgot(false); setForgotStep(1); setError(''); }}
                      className="w-full text-text-muted text-xs font-semibold uppercase tracking-wide hover:text-text-main transition-colors"
                    >
                      KEMBALI KE LOGIN
                    </button>
                  </form>
                )}

                {forgotStep === 2 && (
                  <div className="space-y-8">
                    <div className="flex justify-center gap-2">
                      {otpValues.map((value, index) => (
                        <input
                          key={index}
                          ref={otpRefs[index]}
                          type="text"
                          maxLength={1}
                          value={value}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={handlePaste}
                          className="w-10 h-12 md:w-12 md:h-14 bg-bg-main border border-border-main rounded-xl text-center text-xl font-bold text-orange-primary focus:outline-none focus:border-orange-primary transition-all shadow-lg"
                        />
                      ))}
                    </div>

                    <button 
                      onClick={handleVerifyOTP}
                      disabled={formData.otp.length !== 6 || loading}
                      className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg shadow-orange-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'VERIFIKASI OTP'}
                    </button>

                    <div className="text-center">
                      <button 
                        disabled={otpTimer > 0}
                        onClick={() => handleForgotSubmit({ preventDefault: () => {} } as any)}
                        className="text-xs font-semibold uppercase tracking-wide text-orange-primary disabled:text-text-muted transition-colors"
                      >
                        {otpTimer > 0 ? `KIRIM ULANG DALAM ${otpTimer}S` : 'KIRIM ULANG OTP'}
                      </button>
                    </div>
                  </div>
                )}

                {forgotStep === 3 && (
                  <form onSubmit={handleForgotSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">Password Baru</label>
                      <div className="relative">
                        <input 
                          type="password" 
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                        />
                      </div>
                      
                      {/* Password Strength Indicator */}
                      <div className="px-1 pt-2 space-y-2">
                        <div className="flex gap-1 h-1">
                          {[1, 2, 3, 4, 5].map((level) => {
                            const hasEmoji = /\p{Extended_Pictographic}/u.test(formData.password);
                            const strength = 
                              (formData.password.length >= 8 ? 1 : 0) +
                              (/[A-Z]/.test(formData.password) ? 1 : 0) +
                              (/[a-z]/.test(formData.password) ? 1 : 0) +
                              (/[0-9]/.test(formData.password) ? 1 : 0) +
                              (/[^A-Za-z0-9]/.test(formData.password) && !hasEmoji ? 1 : 0);
                            
                            let color = 'bg-border-main';
                            if (hasEmoji) {
                              color = 'bg-red-500';
                            } else if (level <= strength) {
                              if (strength === 5) color = 'bg-green-500';
                              else if (strength >= 3) color = 'bg-yellow-500';
                              else color = 'bg-red-500';
                            }
                            
                            return <div key={level} className={`flex-1 rounded-full transition-all duration-500 ${color}`} />;
                          })}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <RequirementItem met={formData.password.length >= 8} label="Min. 8 Karakter" />
                          <RequirementItem met={/[A-Z]/.test(formData.password)} label="Huruf Besar" />
                          <RequirementItem met={/[a-z]/.test(formData.password)} label="Huruf Kecil" />
                          <RequirementItem met={/[0-9]/.test(formData.password)} label="Angka" />
                          <RequirementItem met={/[^A-Za-z0-9]/.test(formData.password) && !/\p{Extended_Pictographic}/u.test(formData.password)} label="Simbol" />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 animate-shake">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-primary text-black font-bold py-4 rounded-xl shadow-lg shadow-orange-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'RESET PASSWORD'}
                    </button>
                  </form>
                )}
              </motion.div>
            ) : step === 1 ? (
              <>
                <div className="flex bg-bg-main p-1 rounded-xl border border-border-main mb-8 shadow-inner">
                  <button 
                    type="button"
                    onClick={() => { setIsLogin(true); setError(''); setFormData(prev => ({ ...prev, password: '' })); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
                  >
                    LOGIN
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsLogin(false); setError(''); setFormData(prev => ({ ...prev, password: '' })); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-orange-primary text-black shadow-lg' : 'text-text-muted hover:text-text-main'}`}
                  >
                    SIGN UP
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isLogin ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Username / Email / No. Telepon</label>
                        <div className="relative group">
                          <input 
                            type="text"
                            required
                            placeholder="username, user@gmail.com, atau 0812..."
                            className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                            value={formData.identity}
                            onChange={(e) => setFormData({...formData, identity: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Password</label>
                        <div className="relative group">
                          <input 
                            type="password"
                            required
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className="w-full bg-bg-main border border-border-main rounded-xl py-3.5 px-4 text-text-main focus:outline-none focus:border-orange-primary transition-all"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                        </div>
                        <div className="flex justify-end">
                          <button 
                            type="button"
                            onClick={() => { setIsForgot(true); setForgotStep(1); setError(''); }}
                            className="text-xs font-bold text-orange-primary uppercase tracking-widest hover:underline"
                          >
                            Lupa Password?
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Nama Asli</label>
                        <input 
                          type="text"
                          required
                          placeholder="Nama Tanpa Simbol"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                          value={formData.full_name}
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Username</label>
                        <input 
                          type="text"
                          required
                          placeholder="Username Akun"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Email (@gmail/@yahoo)</label>
                        <input 
                          type="email"
                          required
                          placeholder="email@gmail.com"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">No. Telepon</label>
                        <input 
                          type="tel"
                          required
                          placeholder="08123456789"
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Password</label>
                        <div className="relative group">
                          <input 
                            type="password"
                            required
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                        </div>
                        
                        {/* Password Strength Gauge */}
                        <div className="px-1 pt-2 space-y-2">
                          <div className="flex gap-1 h-1">
                            {[1, 2, 3, 4, 5].map((level) => {
                              const hasEmoji = /\p{Extended_Pictographic}/u.test(formData.password);
                              const strength = 
                                (formData.password.length >= 8 ? 1 : 0) +
                                (/[A-Z]/.test(formData.password) ? 1 : 0) +
                                (/[a-z]/.test(formData.password) ? 1 : 0) +
                                (/[0-9]/.test(formData.password) ? 1 : 0) +
                                (/[^A-Za-z0-9]/.test(formData.password) && !hasEmoji ? 1 : 0);
                              
                              let color = 'bg-border-main';
                              if (hasEmoji) {
                                color = 'bg-red-500';
                              } else if (level <= strength) {
                                if (strength === 5) color = 'bg-green-500';
                                else if (strength >= 3) color = level <= 2 ? 'bg-yellow-500' : 'bg-yellow-500';
                                else color = 'bg-red-500';
                              }
                              
                              return <div key={level} className={`flex-1 rounded-full transition-all duration-500 ${color}`} />;
                            })}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <RequirementItem met={formData.password.length >= 8} label="Min. 8 Karakter" />
                            <RequirementItem met={/[A-Z]/.test(formData.password)} label="Huruf Besar" />
                            <RequirementItem met={/[a-z]/.test(formData.password)} label="Huruf Kecil" />
                            <RequirementItem met={/[0-9]/.test(formData.password)} label="Angka" />
                            <RequirementItem met={/[^A-Za-z0-9]/.test(formData.password) && !/\p{Extended_Pictographic}/u.test(formData.password)} label="Simbol" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Tgl Lahir</label>
                        <input 
                          type="date"
                          required
                          className="w-full bg-bg-main border border-border-main rounded-xl py-3 px-4 text-text-main focus:outline-none focus:border-orange-primary text-sm"
                          value={formData.birth_date}
                          onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Metode Verifikasi OTP</label>
                        <div className="flex gap-4">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, otp_method: 'email'})}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${formData.otp_method === 'email' ? 'bg-orange-primary/10 border-orange-primary text-orange-primary' : 'bg-bg-main border-border-main text-text-muted'}`}
                          >
                            <span className="text-xs font-bold">EMAIL</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="text-red-500 text-xs font-bold uppercase tracking-wider bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-4 rounded-xl shadow-[0_10px_20px_rgba(255,159,28,0.2)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? 'MEMPROSES...' : (isLogin ? 'MASUK KE PANEL' : 'BUAT AKUN')}
                  </button>
                </form>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 text-center"
              >
                <div>
                  <h3 className="text-2xl font-bold text-text-main mb-2">Verifikasi OTP</h3>
                  <p className="text-text-muted text-sm mb-4">
                    Pilih metode pengiriman kode 6-digit:
                  </p>
                  
                  <div className="flex flex-col gap-3 mb-6">
                    {otpMethod === 'email' ? (
                      <div 
                        onClick={() => otpTimer === 0 && handleSendOTP(targetIdentifier, 'email')}
                        className={`w-full bg-bg-main border border-orange-primary/30 p-4 rounded-xl flex items-center justify-between group ${otpTimer === 0 ? 'cursor-pointer hover:border-orange-primary' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                              {isOtpSent ? 'OTP terkirim ke email' : 'Kirim ke Email'}
                            </p>
                            <p className="text-sm font-bold text-text-main">{targetIdentifier}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => otpTimer === 0 && handleSendOTP(targetIdentifier, 'phone')}
                        className={`w-full bg-bg-main border border-orange-primary/30 p-4 rounded-xl flex items-center justify-between group ${otpTimer === 0 ? 'cursor-pointer hover:border-orange-primary' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                              {isOtpSent ? 'OTP terkirim ke email terdaftar' : 'Kirim ke Nomor Telepon'}
                            </p>
                            <p className="text-sm font-bold text-text-main">
                              {isOtpSent ? 'Email terdaftar' : `${targetIdentifier.substring(0, 3)}---`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-center gap-2 md:gap-3">
                    {otpValues.map((val, i) => (
                      <input
                        key={i}
                        ref={otpRefs[i]}
                        type="text"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={handlePaste}
                        className="w-10 h-12 md:w-14 md:h-16 bg-bg-main border border-border-main rounded-xl text-center text-xl md:text-2xl font-bold text-orange-primary focus:outline-none focus:border-orange-primary transition-all shadow-inner"
                      />
                    ))}
                  </div>
                  
                  {error && (
                    <div className="text-red-500 text-xs font-bold uppercase tracking-wider bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <button 
                      onClick={handleVerifyOTP}
                      disabled={loading || formData.otp.length !== 6}
                      className="w-full bg-orange-primary hover:bg-orange-primary/90 text-black font-bold py-4 rounded-xl shadow-[0_10px_20px_rgba(255,159,28,0.2)] transition-all disabled:opacity-50"
                    >
                      {loading ? 'VERIFIKASI...' : 'KONFIRMASI OTP'}
                    </button>
                    
                    <div className="flex flex-col items-center gap-4">
                      {otpTimer > 0 ? (
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                          Kirim ulang dalam <span className="text-orange-primary">{otpTimer}s</span>
                        </p>
                      ) : (
                        <button 
                          onClick={() => handleSendOTP(targetIdentifier, otpMethod)}
                          disabled={loading}
                          className="text-xs font-bold text-orange-primary uppercase tracking-widest hover:underline"
                        >
                          Kirim Ulang Kode
                        </button>
                      )}
                      
                      <button 
                        onClick={() => setStep(1)}
                        className="text-text-muted text-xs font-semibold uppercase tracking-wide hover:text-text-main transition-colors"
                      >
                        KEMBALI KE FORM
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <p className="text-center text-text-muted text-xs font-bold uppercase tracking-widest mt-8">
                {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'} 
                <button 
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); setFormData(prev => ({ ...prev, password: '' })); }}
                  className="text-orange-primary ml-2 hover:underline cursor-pointer relative z-50"
                >
                  {isLogin ? 'Buat Akun' : 'Login Sekarang'}
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const RequirementItem: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-1 h-1 rounded-full ${met ? 'bg-green-500' : 'bg-gray-700'}`} />
    <span className={`text-xs font-bold uppercase tracking-tight ${met ? 'text-green-500' : 'text-gray-600'}`}>
      {label}
    </span>
  </div>
);
