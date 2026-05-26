import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const EMPTY_TEAM = { name: '', sport: '' };

function memberCount(team) {
  const countRow = Array.isArray(team.athlete_teams) ? team.athlete_teams[0] : null;
  return countRow?.count ?? 0;
}

function athleteName(athlete) {
  return athlete.full_name || [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Unnamed athlete';
}

export default function TeamManagement({ user }) {
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState(EMPTY_TEAM);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function loadTeams() {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: teamError } = await supabase
        .from('teams')
        .select('id, name, sport, athlete_teams(count)')
        .eq('org_id', user.orgId)
        .order('name');
      if (teamError) throw teamError;
      setTeams(data ?? []);
    } catch (err) {
      console.error('[TeamManagement] load teams failed:', err);
      setError('Could not load teams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, [user?.orgId]);

  async function createTeam() {
    if (!user?.orgId || !newTeam.name.trim()) {
      setError('Team name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('teams')
        .insert({ org_id: user.orgId, name: newTeam.name.trim(), sport: newTeam.sport.trim() || null });
      if (insertError) throw insertError;
      setNewTeam(EMPTY_TEAM);
      await loadTeams();
    } catch (err) {
      console.error('[TeamManagement] create failed:', err);
      setError('Could not create team.');
    } finally {
      setSaving(false);
    }
  }

  async function loadMembers(team) {
    if (!user?.orgId) return;
    setSelectedTeam(team);
    setMembers([]);
    try {
      const { data, error: memberError } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, full_name, position, athlete_teams!inner(team_id)')
        .eq('org_id', user.orgId)
        .eq('athlete_teams.team_id', team.id)
        .order('full_name');
      if (memberError) throw memberError;
      setMembers(data ?? []);
    } catch (err) {
      console.error('[TeamManagement] load members failed:', err);
      setError('Could not load team members.');
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]">
      <div className="border-b border-[var(--color-outline-variant)] p-5">
        <h2 className="text-lg font-black text-[var(--color-on-surface)]">Teams</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">Create teams and inspect current athlete membership.</p>
      </div>

      <div className="grid gap-3 border-b border-[var(--color-outline-variant)] p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={newTeam.name}
          onChange={(e) => setNewTeam((current) => ({ ...current, name: e.target.value }))}
          placeholder="Team name"
          className="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
        />
        <input
          value={newTeam.sport}
          onChange={(e) => setNewTeam((current) => ({ ...current, sport: e.target.value }))}
          placeholder="Sport"
          className="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
        />
        <button
          type="button"
          disabled={saving}
          onClick={createTeam}
          className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
        >
          Create Team
        </button>
      </div>

      {error && <p className="p-5 text-sm text-[var(--color-error)]">{error}</p>}
      {loading && <p className="p-5 text-sm text-[var(--color-outline)]">Loading teams...</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
              <tr>
                {['Team Name', 'Sport', 'Member Count', 'Actions'].map((header) => (
                  <th key={header} className="px-5 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {teams.map((team) => (
                <tr key={team.id}>
                  <td className="px-5 py-4 font-bold text-[var(--color-on-surface)]">{team.name}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{team.sport || '-'}</td>
                  <td className="px-5 py-4 text-[var(--color-on-surface-variant)]">{memberCount(team)}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => loadMembers(team)}
                      className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface)]"
                    >
                      Manage Members
                    </button>
                  </td>
                </tr>
              ))}
              {!teams.length && (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-[var(--color-outline)]">No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedTeam && (
        <aside className="border-t border-[var(--color-outline-variant)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black text-[var(--color-on-surface)]">{selectedTeam.name} Members</h3>
            <button type="button" onClick={() => setSelectedTeam(null)} className="text-sm text-[var(--color-outline)]">Close</button>
          </div>
          <div className="grid gap-2">
            {members.map((athlete) => (
              <div key={athlete.id} className="rounded-lg bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-on-surface)]">
                {athleteName(athlete)}
                {athlete.position && <span className="ml-2 text-[var(--color-outline)]">{athlete.position}</span>}
              </div>
            ))}
            {!members.length && <p className="text-sm text-[var(--color-outline)]">No members found for this team.</p>}
          </div>
        </aside>
      )}
    </section>
  );
}
