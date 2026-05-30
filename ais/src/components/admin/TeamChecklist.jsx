const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]';

export default function TeamChecklist({ teams, selectedTeamIds, onToggle }) {
  if (!teams.length) return null;
  return (
    <div>
      <p className={labelClass}>Team assignment</p>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-outline-variant)] divide-y divide-[var(--color-outline-variant)]">
        {teams.map((team) => {
          const checked = selectedTeamIds.includes(team.id);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onToggle(team.id)}
              className="flex w-full items-center gap-3 bg-[var(--color-surface-container-high)] px-3 py-2.5 text-left hover:bg-[var(--color-surface-bright)]"
            >
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                  checked
                    ? 'border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/15'
                    : 'border-[var(--color-outline-variant)]'
                }`}
              >
                {checked && <span className="text-[10px] font-black text-[var(--color-primary-container)]">✓</span>}
              </span>
              <span className="flex-1 text-sm text-[var(--color-on-surface)]">{team.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
