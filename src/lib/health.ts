export function getRacquetHealth(lastStringDate?: string | null) {
  if (!lastStringDate) return { label: 'Fresh', tone: 'green' as const, days: 0, statusLabel: 'Fresh' };
  const diffMs = Date.now() - new Date(lastStringDate).getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (days >= 60) return { label: 'Red', tone: 'red' as const, days, statusLabel: 'Needs restring' };
  if (days >= 30) return { label: 'Yellow', tone: 'yellow' as const, days, statusLabel: 'Due soon' };
  return { label: 'Fresh', tone: 'green' as const, days, statusLabel: 'Fresh' };
}

export function formatLastStringDate(lastStringDate?: string | null) {
  if (!lastStringDate) return 'Not set yet';
  const date = new Date(lastStringDate);
  if (Number.isNaN(date.getTime())) return 'Not set yet';
  return date.toLocaleDateString();
}
