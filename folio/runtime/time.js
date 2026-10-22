// Date and time helpers. Dates are plain JavaScript Date objects in the device's time zone.

export const MINUTE = 60000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Monday of the week containing d.
export function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "09:00" (or "9:00 AM", following the phone's settings).
export const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// "5 October" (month: 'long') or "5 Oct" (month: 'short').
export const formatDate = (d, month = 'long') => d.toLocaleDateString([], { day: 'numeric', month });

// "Monday 5 October".
export const formatLongDate = (d) => d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

// "Mon 5 Oct, 09:00".
export const formatDateTime = (d) =>
  d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// "Today", "Tomorrow", "Yesterday", or the weekday name.
export function dayLabel(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long' });
}

// "just now", "5 min ago", "3 h ago", "2 days ago".
export function ago(timestamp) {
  const m = Math.round((Date.now() - timestamp) / MINUTE);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// "in 25 min", "in 2 h 5 min".
export function inTime(ms) {
  const m = Math.max(1, Math.round(ms / MINUTE));
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `in ${h} h${r ? ` ${r} min` : ''}`;
}

// The value format of <input type="datetime-local">.
export function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
