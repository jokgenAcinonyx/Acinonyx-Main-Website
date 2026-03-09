import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Phone } from 'lucide-react';

interface AdminSetupPageProps {
  onSetupComplete: (user: any, token: string) => void;
}

export default function AdminSetupPage({ onSetupComplete }: AdminSetupPageProps) {
  const [form, setForm] = useState({ email: '', phone: '', password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.phone || !form.password) {
      setError('Email, nomor telepon, dan password wajib diisi.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Password dan konfirmasi tidak cocok.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/setup/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          localStorage.setItem('kijo_token', data.token);
          onSetupComplete(data.user, data.token);
        }, 1500);
      } else {
        setError(data.message || 'Gagal membuat akun Minox.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-bg-sidebar border border-border-main rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-border-main">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-primary/10 border border-orange-primary/20 flex items-center justify-center">
                <ShieldCheck size={20} className="text-orange-primary" />
              </div>
              <div>
                <h1 className="text-base font-bold text-text-main">Pengaturan Awal</h1>
                <p className="text-xs text-text-muted">Buat akun Minox</p>
              </div>
            </div>
            <div className="bg-orange-primary/5 border border-orange-primary/15 rounded-xl p-3">
              <p className="text-xs text-text-muted leading-relaxed">
                Halaman ini hanya muncul sekali. Setelah akun Minox dibuat, halaman ini akan dinonaktifkan secara otomatis.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-text-main">Akun Minox berhasil dibuat</p>
                  <p className="text-xs text-text-muted mt-1">Masuk ke Minox Panel...</p>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="admin@example.com"
                    autoComplete="email"
                    className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">Nomor Telepon</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" />
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+62812xxxx"
                      autoComplete="tel"
                      className="w-full bg-bg-card border border-border-main rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 karakter"
                      autoComplete="new-password"
                      className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 pr-11 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">Konfirmasi Password</label>
                  <input
                    name="confirm_password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirm_password}
                    onChange={handleChange}
                    placeholder="Ulangi password"
                    autoComplete="new-password"
                    className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:outline-none focus:border-orange-primary/50 transition-colors"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-400 leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-primary hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Membuat akun...
                    </>
                  ) : (
                    'Buat Akun Minox'
                  )}
                </button>
              </>
            )}
          </form>

          {/* Footer */}
          <div className="px-8 pb-6">
            <p className="text-center text-xs text-text-faint">
              ACINONYX · First-time Setup
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
