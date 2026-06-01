import { useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';

export default function TeamSwitcher() {
  const { activeTeamId, setActiveTeamId, availableTeams } = useUser();
  const [open, setOpen] = useState(false);

  if (!availableTeams?.length) return null;

  const currentTeam = availableTeams.find((team) => team.id === activeTeamId) ?? availableTeams[0];

  if (availableTeams.length <= 1) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 36,
          padding: '0 12px',
          borderRadius: 'var(--radius-default)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-high)',
          fontSize: 'var(--font-size-body-sm)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
        }}
      >
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTeam?.name ?? 'Team'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 36,
          padding: '0 12px',
          borderRadius: 'var(--radius-default)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-high)',
          fontSize: 'var(--font-size-body-sm)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
          cursor: 'pointer',
        }}
      >
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTeam?.name ?? 'Select team'}
        </span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 50,
            minWidth: 240,
            borderRadius: 'var(--radius-default)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-high)',
            padding: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {availableTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => {
                setActiveTeamId(team.id);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 'var(--radius-default)',
                border: 'none',
                background: team.id === activeTeamId ? 'var(--color-primary-soft)' : 'transparent',
                color: team.id === activeTeamId ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body-sm)',
                fontWeight: team.id === activeTeamId ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                cursor: 'pointer',
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
