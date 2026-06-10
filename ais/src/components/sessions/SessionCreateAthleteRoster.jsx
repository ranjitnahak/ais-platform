export default function SessionCreateAthleteRoster({
  athletes,
  includedAthleteIds,
  includedCount,
  totalAthletes,
  loading,
  onToggle,
  onDeselectAll,
}) {
  if (loading) {
    return <p className="text-xs text-[var(--color-outline)]">Loading roster…</p>;
  }

  if (!athletes.length) {
    return <p className="text-xs text-[var(--color-outline)]">No active athletes on this team.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
          {includedCount} of {totalAthletes} selected
        </p>
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-[10px] font-bold uppercase text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
        >
          Deselect all
        </button>
      </div>
      <ul
        className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-[var(--color-outline-variant)] p-2"
        style={{ background: 'var(--color-surface-container-low)' }}
      >
        {athletes.map((athlete) => {
          const included = includedAthleteIds.has(athlete.id);
          return (
            <li
              key={athlete.id}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                included ? 'text-[var(--color-on-surface)]' : 'opacity-50'
              }`}
            >
              {included ? (
                <button
                  type="button"
                  onClick={() => onToggle(athlete.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-primary-container)] bg-[color-mix(in_srgb,var(--color-primary-container)_20%,transparent)] text-[var(--color-primary-container)]"
                  aria-label={`Exclude ${athlete.full_name}`}
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(athlete.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-outline-variant)] text-[var(--color-outline)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
                  aria-label={`Include ${athlete.full_name}`}
                >
                  +
                </button>
              )}
              <span className="flex-1 truncate">{athlete.full_name}</span>
              {athlete.position && (
                <span className="text-[10px] text-[var(--color-outline)]">{athlete.position}</span>
              )}
              {!included && (
                <span className="text-[10px] font-bold uppercase text-[var(--color-outline)]">Excluded</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
