/** Money is whole naira everywhere (same as the dashboard). */
export const naira = (v: number) => `₦${Math.round(v).toLocaleString('en-NG')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 20, 2025" — the reference's date style. */
export const shortDate = (iso: string) => {
  // A date on its own ("2026-11-01") is that calendar day here, not midnight UTC.
  const d = new Date(/^d{4}-d{2}-d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export const timeOfDay = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? 'Good Morning,' : h < 17 ? 'Good Afternoon,' : 'Good Evening,';
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Person names: every part starts with a capital letter, even with Caps Lock (dashboard rule). */
export const formatPersonName = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^\s/, '')
    .split(' ')
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1).toLowerCase() : p))
    .join(' ');

/** Nigerian mobile number → digits only after +234 (e.g. "8034567890"). */
export const phoneDigits = (s: string) => s.replace(/\D/g, '').replace(/^234/, '').replace(/^0/, '');
export const isValidNgPhone = (s: string) => /^[789][01]\d{8}$/.test(phoneDigits(s));
export const displayPhone = (s: string) => {
  const d = phoneDigits(s);
  return d.length === 10 ? `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : s;
};
