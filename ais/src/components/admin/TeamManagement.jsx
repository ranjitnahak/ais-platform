import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import TeamDetailModal from './TeamDetailModal';

function teamInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function TeamManagement({ user, effectiveOrgId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const orgId = effectiveOrgId ?? user?.orgId;

  async function loadTeams() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: teamRows, error: teamError } = await supabase
        .from('teams')
        .select('id, name, sport, gender, logo_url')
        .eq('org_id', orgId)
        .order('name');
      if (teamError) throw teamError;

      const teamIds = (teamRows ?? []).map((t) => t.id);
      const { data: memberRows, error: memberErr } = teamIds.length
        ? await supabase.from('athlete_teams').select('team_id').in('team_id', teamIds)
        : { data: [], error: null };
      if (memberErr) throw memberErr;

      const countMap = {};
      for (const row of memberRows ?? []) {
        countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
      }

      setTeams(
        (teamRows ?? []).map((t) => ({
          ...t,
          memberCount: countMap[t.id] ?? 0,
        })),
      );
    } catch (err) {
      console.error('[TeamManagement] load teams failed:', err);
      setError('Could not load teams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, [orgId]);

  function handleCloseModal() {
    setSelectedTeam(null);
    setShowCreateTeam(false);
  }

  function handleSaved() {
    handleCloseModal();
    void loadTeams();
  }

  const modalOpen = selectedTeam !== null || showCreateTeam;

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] p-5">
        <div>
          <h2 className="text-lg font-black text-[var(--color-on-surface)]">Teams</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Create and manage squads, upload team logos
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTeam(true)}
          className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)]"
        >
          + Create team
        </button>
      </div>

      {error && <p className="px-5 pt-4 text-sm text-[var(--color-error)]">{error}</p>}

      <div className="space-y-3 p-5">
        {loading ? (
          <p className="py-12 text-center text-sm text-[var(--color-outline)]">Loading teams...</p>
        ) : teams.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-sm text-[var(--color-outline)]"
            style={{ border: '1px dashed var(--color-outline-variant)' }}
          >
            No teams yet. Click &quot;+ Create team&quot; to get started.
          </div>
        ) : (
          teams.map((team) => {
            const meta = [team.sport, team.gender, `${team.memberCount} athletes`]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeam(team)}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-container-high)]"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: team.logo_url ? undefined : 'var(--color-surface-container-highest)' }}
                >
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-black text-[var(--color-primary-container)]">
                      {teamInitials(team.name)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">{team.name}</p>
                  {meta && (
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-[var(--color-on-surface-variant)]">
                      {meta}
                    </p>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#22C55E]">
                    Active
                  </span>
                  <span className="material-symbols-outlined text-sm text-[var(--color-outline)]">
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {modalOpen && (
        <TeamDetailModal
          team={showCreateTeam ? null : selectedTeam}
          orgId={orgId}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
