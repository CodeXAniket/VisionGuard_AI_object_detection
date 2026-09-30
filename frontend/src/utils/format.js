export function formatConfidence(confidence) {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

export function formatRelativeTime(value, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDateTime(value);
}

export function formatClassName(name = '') {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// "2026-09-27" (a local calendar day) -> ISO start/end timestamps for the API.
export function localDayRange(dateString) {
  if (!dateString) return {};
  const [year, month, day] = dateString.split('-').map(Number);
  const from = new Date(year, month - 1, day);
  const to = new Date(year, month - 1, day + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
