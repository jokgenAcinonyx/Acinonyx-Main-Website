/** Format duration (in hours) as "X jam Y menit" */
export function formatDuration(durationHours: number): string {
  if (!durationHours || durationHours <= 0) return '-';
  const hours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - hours) * 60);
  if (hours === 0) return `${minutes} menit`;
  if (minutes === 0) return `${hours} jam`;
  return `${hours} jam ${minutes} menit`;
}

/** Tailwind classes for a session status badge */
export function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'ongoing': case 'pending_completion': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'cancelled': case 'pending_cancellation': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'pending_payment': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    default: return 'bg-orange-primary/10 text-orange-primary border-orange-primary/20';
  }
}

/** Indonesian display label for a session status */
export function statusLabel(status: string): string {
  switch (status) {
    case 'upcoming': return 'Menunggu';
    case 'pending_payment': return 'Menunggu Pembayaran';
    case 'ongoing': return 'Sedang Berjalan';
    case 'pending_completion': return 'Menunggu Konfirmasi';
    case 'pending_cancellation': return 'Menunggu Pembatalan';
    case 'completed': return 'Selesai';
    case 'cancelled': return 'Dibatalkan';
    default: return status;
  }
}

/** Format a date-time string to Jakarta date+time (e.g. "14 Mar 2026, 09:00") */
export function toJakartaDT(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
}

/** Format a date-time string to Jakarta date only */
export function toJakartaDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/** Format a date-time string to Jakarta time only */
export function toJakartaTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}
