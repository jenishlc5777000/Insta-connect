const TZ = 'Asia/Kolkata';

/** All money from the API is in paise */
export function formatINR(paise, { compact = false } = {}) {
  const rupees = Number(paise || 0) / 100;
  if (compact && Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L`;
  }
  // Whole rupees: ₹2,000 · with paise: always two decimals (₹49.50, never ₹49.5)
  const hasPaise = Math.round(Math.abs(rupees) * 100) % 100 !== 0;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const rupeesToPaise = (r) => (r === '' || r === null || r === undefined ? null : Math.round(Number(r) * 100));
export const paiseToRupees = (p) => (p === null || p === undefined ? '' : Number(p) / 100);

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

export const formatDate = (d, opts = {}) =>
  d ? new Date(d).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', ...opts }) : '—';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '');

export const formatLongDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const titleCase = (s = '') => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** For <input type="datetime-local"> in IST */
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}
/** Interprets a datetime-local value as IST */
export const fromLocalInput = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

export function effectivePrice(w) {
  if (!w) return 0;
  return w.discountPrice !== null && w.discountPrice !== undefined && w.discountPrice < w.price ? w.discountPrice : w.price;
}

export const STATUS_TONES = {
  // workshop
  draft: 'slate', published: 'green', completed: 'blue', cancelled: 'rose',
  // registration
  registered: 'amber', confirmed: 'green',
  // payment
  pending: 'amber', paid: 'green', failed: 'rose', refunded: 'slate', partially_refunded: 'purple', not_required: 'blue',
  created: 'slate', authorized: 'blue', captured: 'green',
  none: 'slate', partial: 'purple', full: 'slate',
  // attendance
  attended: 'green', absent: 'rose',
  // commission
  approved: 'blue', rejected: 'rose', reversed: 'slate', not_eligible: 'slate',
  // accounts
  active: 'green', inactive: 'slate', suspended: 'rose',
};

/** "Nov 29–30, 2026" / "Nov 30 – Dec 1, 2026" / "Nov 29, 2026" (IST) */
export function formatDateRange(start, end) {
  if (!start) return '';
  const p = (d) =>
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' })
      .formatToParts(new Date(d))
      .reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
  const a = p(start);
  const b = end ? p(end) : a;
  if (a.year !== b.year) return `${a.month} ${a.day}, ${a.year} – ${b.month} ${b.day}, ${b.year}`;
  if (a.month !== b.month) return `${a.month} ${a.day} – ${b.month} ${b.day}, ${b.year}`;
  if (a.day !== b.day) return `${a.month} ${a.day}–${b.day}, ${a.year}`;
  return `${a.month} ${a.day}, ${a.year}`;
}

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d);
}

export const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || '';
