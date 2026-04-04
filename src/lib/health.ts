export function getRacquetHealth(lastStringDate?: string | null) {
  if (!lastStringDate) {
    return { label: 'No service recorded', tone: 'slate' as const, days: 0, statusLabel: 'No service recorded yet', percent: 0 };
  }

  const diffMs = Date.now() - new Date(lastStringDate).getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (days <= 7) return { label: 'Fresh', tone: 'green' as const, days, statusLabel: 'Fresh', percent: 100 };
  if (days <= 21) return { label: 'Optimal', tone: 'green' as const, days, statusLabel: 'Optimal', percent: 65 };
  if (days <= 35) return { label: 'Warning', tone: 'yellow' as const, days, statusLabel: 'Warning', percent: 35 };
  return { label: 'Replace', tone: 'red' as const, days, statusLabel: 'Replace', percent: 10 };
}

export function formatLastStringDate(lastStringDate?: string | null) {
  if (!lastStringDate) return 'No service recorded yet';
  const date = new Date(lastStringDate);
  if (Number.isNaN(date.getTime())) return 'No service recorded yet';
  return date.toLocaleDateString();
}
