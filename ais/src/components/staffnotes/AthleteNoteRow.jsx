export default function AthleteNoteRow({ athlete, count, expanded, onToggle, children }) {
  return (
    <div
      className={`rounded-2xl border ${
        expanded
          ? 'border-[var(--color-primary)] bg-[var(--color-surface)]'
          : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]'
      }`}
    >
      <button type="button" onClick={onToggle} className="flex min-h-16 w-full items-center gap-3 p-3 text-left">
        {athlete.photo_url ? (
          <img src={athlete.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] font-black">
            {(athlete.full_name ?? '?').slice(0, 1)}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-black">{athlete.full_name}</span>
        <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[10px] font-black text-[var(--color-outline)]">
          {count}
        </span>
        <span
          className={`material-symbols-outlined shrink-0 text-[var(--color-on-surface-variant)] transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
          aria-hidden
        >
          chevron_right
        </span>
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-[var(--color-outline-variant)] px-3 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
