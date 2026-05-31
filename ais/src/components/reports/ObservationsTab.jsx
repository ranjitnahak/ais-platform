import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import { athleteDisplayName } from '../../lib/athleteName';
import { formatRoleOrPosition } from '../../lib/adminUserConstants';
import {
  ALL,
  DOMAIN_FILTER_OPTIONS,
  monthBounds,
  normalizeStaffNote,
} from '../../lib/staffLogsConstants';
import StaffLogsReport from './StaffLogsReport';

const selectClass =
  'rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-3 py-2 text-xs font-bold text-[var(--color-on-surface)]';

function relation(row) {
  return Array.isArray(row) ? row[0] : row;
}

export default function ObservationsTab({ user, activeOrgId, effectiveOrgId }) {
  const { activeTeamId, availableTeams } = useUser();
  const defaults = useMemo(() => monthBounds(), []);
  const selectedTeamId = activeTeamId ?? '';
  const teams = availableTeams;
  const [roster, setRoster] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [staffFilter, setStaffFilter] = useState(ALL);
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [domainFilter, setDomainFilter] = useState(ALL);
  const [athleteFilter, setAthleteFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [orgProfile, setOrgProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadOrg() {
      if (!effectiveOrgId) {
        if (mounted) setOrgProfile(null);
        return;
      }
      try {
        const { data, error: orgError } = await supabase
          .from('organisations')
          .select('name, logo_url')
          .eq('id', effectiveOrgId)
          .single();
        if (orgError) throw orgError;
        if (mounted) setOrgProfile(data);
      } catch (err) {
        console.error('[ObservationsTab] org profile failed:', err);
        if (mounted) setOrgProfile(null);
      }
    }
    void loadOrg();
    return () => {
      mounted = false;
    };
  }, [effectiveOrgId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = user ?? await getCurrentUser();
      if (!currentUser || !effectiveOrgId || !selectedTeamId) {
        setRoster([]);
        setNotes([]);
        return;
      }

      const [rosterResult, notesResult] = await Promise.all([
        supabase
          .from('athlete_teams')
          .select(`
            athletes!inner(
              id, first_name, last_name, full_name, photo_url, position, gender, date_of_birth
            )
          `)
          .eq('team_id', selectedTeamId)
          .eq('athletes.org_id', effectiveOrgId),
        supabase
          .from('athlete_staff_notes')
          .select(`
            id, team_id, athlete_id, author_id, domain, note, note_date, note_level, created_at,
            users(full_name, role),
            athletes(id, first_name, last_name, full_name, position, jersey_number)
          `)
          .eq('org_id', effectiveOrgId)
          .eq('team_id', selectedTeamId)
          .order('note_date', { ascending: false }),
      ]);

      if (rosterResult.error) throw rosterResult.error;
      if (notesResult.error) throw notesResult.error;

      const athleteRows = (rosterResult.data ?? [])
        .map((row) => relation(row.athletes))
        .filter(Boolean)
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));

      setRoster(athleteRows);
      setNotes((notesResult.data ?? []).map(normalizeStaffNote));
    } catch (err) {
      console.error('[ObservationsTab]', err);
      setError(err.message ?? 'Failed to load staff logs.');
    } finally {
      setLoading(false);
    }
  }, [user, effectiveOrgId, selectedTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setStaffFilter(ALL);
    setRoleFilter(ALL);
    setDomainFilter(ALL);
    setAthleteFilter(ALL);
  }, [selectedTeamId]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (staffFilter !== ALL && note.submitted_by !== staffFilter) return false;
      if (roleFilter !== ALL && note.role !== roleFilter) return false;
      if (domainFilter !== ALL && note.domain !== domainFilter) return false;
      if (dateFrom && note.observation_date < dateFrom) return false;
      if (dateTo && note.observation_date > dateTo) return false;
      return true;
    });
  }, [notes, staffFilter, roleFilter, domainFilter, dateFrom, dateTo]);

  const { notesByAthleteId, teamNotes } = useMemo(() => {
    const byAthlete = new Map();
    const teamLevel = [];
    for (const note of filteredNotes) {
      if (note.note_level === 'team' || !note.athlete_id) {
        teamLevel.push(note);
        continue;
      }
      const existing = byAthlete.get(note.athlete_id) ?? [];
      existing.push(note);
      byAthlete.set(note.athlete_id, existing);
    }
    return { notesByAthleteId: byAthlete, teamNotes: teamLevel };
  }, [filteredNotes]);

  const filterOptions = useMemo(() => {
    const staffMap = new Map();
    const roleSet = new Set();
    for (const note of notes) {
      if (note.submitted_by) {
        staffMap.set(note.submitted_by, note.users?.full_name ?? 'Unknown');
      }
      if (note.role) roleSet.add(note.role);
    }
    return {
      staff: [...staffMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      roles: [...roleSet].sort(),
      athletes: roster.map((athlete) => [athlete.id, athleteDisplayName(athlete)]),
    };
  }, [notes, roster]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  if (loading && !teams.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">refresh</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
            Staff log entries for the selected squad
          </p>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-[var(--color-on-surface)]">
            Staff Logs
          </h2>
        </div>
      </div>

      {!teams.length && (
        <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          No teams available for staff logs.
        </div>
      )}

      {teams.length > 0 && (
        <>
          <div className="no-print flex flex-wrap gap-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={selectClass}>
              <option value={ALL}>All staff</option>
              {filterOptions.staff.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
              <option value={ALL}>All roles</option>
              {filterOptions.roles.map((role) => (
                <option key={role} value={role}>{formatRoleOrPosition(role)}</option>
              ))}
            </select>
            <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className={selectClass}>
              {DOMAIN_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={athleteFilter} onChange={(e) => setAthleteFilter(e.target.value)} className={selectClass}>
              <option value={ALL}>All athletes</option>
              {filterOptions.athletes.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} />
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--color-error-container)] bg-[var(--color-error-container)]/20 p-4 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">refresh</span>
            </div>
          ) : (
            <StaffLogsReport
              team={selectedTeam}
              org={orgProfile}
              roster={roster}
              notesByAthleteId={notesByAthleteId}
              teamNotes={teamNotes}
              dateFrom={dateFrom}
              dateTo={dateTo}
              athleteFilter={athleteFilter}
              staffFilter={staffFilter}
              roleFilter={roleFilter}
              domainFilter={domainFilter}
              orgId={effectiveOrgId}
              userId={user?.id}
              sharedByName={user?.fullName}
            />
          )}
        </>
      )}
    </div>
  );
}
