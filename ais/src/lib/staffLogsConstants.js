export const ALL = 'all';

export const DOMAIN_LABELS = {
  s_and_c: 'S&C',
  physio: 'Physio',
  nutrition: 'Nutrition',
  psychology: 'Psychology',
  analysis: 'Analysis',
  coaching: 'Coaching',
};

export const DOMAIN_FILTER_OPTIONS = [
  { value: ALL, label: 'All domains' },
  { value: 's_and_c', label: 'S&C' },
  { value: 'physio', label: 'Physio' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'coaching', label: 'Coaching' },
];

export function normalizeStaffNote(row) {
  const author = Array.isArray(row.users) ? row.users[0] : row.users;
  const athlete = row.athletes
    ? (Array.isArray(row.athletes) ? row.athletes[0] : row.athletes)
    : null;
  return {
    id: row.id,
    team_id: row.team_id,
    athlete_id: row.athlete_id,
    submitted_by: row.author_id,
    role: author?.role ?? null,
    domain: row.domain,
    note_level: row.note_level,
    note_text: row.note,
    observation_date: row.note_date,
    created_at: row.created_at,
    users: author ?? {},
    athletes: athlete,
  };
}

export function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toLocalDateStr(from), to: toLocalDateStr(to) };
}

export function formatRangeLabel(from, to) {
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const f = from ? new Date(`${from}T00:00:00`).toLocaleDateString(undefined, opts) : '—';
  const t = to ? new Date(`${to}T00:00:00`).toLocaleDateString(undefined, opts) : '—';
  return `${f} – ${t}`;
}

export function formatNoteDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function initials(name) {
  return String(name ?? 'A').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function safeFileName(value) {
  return String(value ?? 'staff-logs').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
}
