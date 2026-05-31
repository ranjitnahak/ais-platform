import { useState } from 'react';
import { useUser } from '../../context/UserContext';

export default function TeamSwitcher() {
  const { activeTeamId, setActiveTeamId, availableTeams } = useUser();
  const [open, setOpen] = useState(false);

  if (!availableTeams?.length) return null;

  const currentTeam = availableTeams.find((team) => team.id === activeTeamId) ?? availableTeams[0];

  if (availableTeams.length <= 1) {
    return (
      <div className="flex min-h-9 items-center rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]">
        <span className="truncate max-w-[180px]">{currentTeam?.name ?? 'Team'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]"
      >
        <span className="truncate max-w-[180px]">{currentTeam?.name ?? 'Select team'}</span>
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[240px] rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] p-2 shadow-xl">
          {availableTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => {
                setActiveTeamId(team.id);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                team.id === activeTeamId
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                  : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]'
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
