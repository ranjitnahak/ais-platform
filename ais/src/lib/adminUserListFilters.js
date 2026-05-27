export function formatUserListDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function userListStatusBadge(status) {
  if (status === 'ACTIVE') return 'bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary-fixed-dim)]';
  if (status === 'INACTIVE') return 'bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]';
  return 'bg-[var(--color-primary-container)]/20 text-[var(--color-primary-container)]';
}

function isAthleteRow(row) {
  return row.kind === 'athlete_auth' || row.kind === 'athlete_pending';
}

export function filterUserListRows(items, { searchQuery, typeFilter, statusFilter }) {
  const query = searchQuery.trim().toLowerCase();
  return items.filter((row) => {
    if (query) {
      const name = String(row.fullName ?? '').toLowerCase();
      const email = String(row.email ?? '').toLowerCase();
      if (!name.includes(query) && !email.includes(query)) return false;
    }
    if (typeFilter === 'staff' && row.kind !== 'staff') return false;
    if (typeFilter === 'athlete' && !isAthleteRow(row)) return false;
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    return true;
  });
}
