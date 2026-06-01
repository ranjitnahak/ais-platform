import { useMemo, useState } from 'react';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';

export default function DexaAthleteSelector({
  athletes,
  loading,
  selectedAthleteId,
  onSelect,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((athlete) => athleteDisplayName(athlete).toLowerCase().includes(q));
  }, [athletes, query]);

  return (
    <div className="space-y-3">
      <label className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">
        Select Athlete
      </label>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name…"
        className="min-h-11 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]"
        aria-label="Search athletes"
      />
      <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
        {loading && (
          <p className="p-4 text-sm text-[var(--color-on-surface-variant)]">Loading athletes…</p>
        )}
        {!loading && !filtered.length && (
          <p className="p-4 text-sm text-[var(--color-on-surface-variant)]">No athletes found.</p>
        )}
        {!loading &&
          filtered.map((athlete) => {
            const selected = athlete.id === selectedAthleteId;
            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => onSelect(athlete.id)}
                className={`flex min-h-12 w-full items-center gap-3 border-b border-[var(--color-outline-variant)] px-3 py-2 text-left last:border-b-0 ${
                  selected
                    ? 'bg-[var(--color-surface)]'
                    : 'hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {athlete.photo_url ? (
                  <img
                    src={athlete.photo_url}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-variant)] text-[10px] font-black text-[var(--color-on-surface)]">
                    {athleteInitialsFromAthlete(athlete)}
                  </span>
                )}
                <span className="truncate text-sm font-bold text-[var(--color-on-surface)]">
                  {athleteDisplayName(athlete)}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
