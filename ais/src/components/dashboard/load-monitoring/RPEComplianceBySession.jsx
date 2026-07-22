import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth';
import { getEffectiveOrgId, narrowTeamIds, resolveOrgTeamScope } from '../../../lib/orgScope';
import { useUser } from '../../../context/UserContext';
import { useSessionConfig } from '../../../context/SessionConfigContext';

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function isOnRosterForDate(joinedAt, leftAt, sessionDate) {
  const joined = dateOnly(joinedAt);
  if (joined && joined > sessionDate) return false;
  const left = dateOnly(leftAt);
  if (left && left < sessionDate) return false;
  return true;
}

function rosterSizeForSession(athleteTeams, teamId, sessionDate) {
  const ids = new Set();
  for (const row of athleteTeams) {
    if (row.team_id !== teamId) continue;
    if (row.athletes?.is_active === false) continue;
    if (!isOnRosterForDate(row.joined_at, row.left_at, sessionDate)) continue;
    ids.add(row.athlete_id);
  }
  return ids.size;
}

/** One row per session_type; pooled logged/roster across instances in range. */
export function buildRows({ sessions, linkedLogs, orphanLogs, athleteTeams, sessionTypeLabel }) {
  const instances = [];

  for (const session of sessions) {
    instances.push({
      key: `id:${session.id}`,
      teamId: session.team_id,
      sessionDate: session.session_date,
      sessionType: session.session_type ?? 'unknown',
      loggedAthleteIds: new Set(),
    });
  }

  const bySessionId = new Map(instances.map((inst) => [inst.key, inst]));

  for (const log of linkedLogs) {
    if (!log.session_id) continue;
    const inst = bySessionId.get(`id:${log.session_id}`);
    if (!inst) continue;
    if (log.actual_rpe != null && log.athlete_id) {
      inst.loggedAthleteIds.add(log.athlete_id);
    }
  }

  const orphanByKey = new Map();
  for (const log of orphanLogs) {
    const sessionDate = dateOnly(log.session_date);
    const sessionType = log.session_type ?? 'unknown';
    if (!sessionDate || !log.team_id) continue;
    const key = `orphan:${sessionType}:${sessionDate}:${log.team_id}`;
    let inst = orphanByKey.get(key);
    if (!inst) {
      inst = {
        key,
        teamId: log.team_id,
        sessionDate,
        sessionType,
        loggedAthleteIds: new Set(),
      };
      orphanByKey.set(key, inst);
      instances.push(inst);
    }
    if (log.actual_rpe != null && log.athlete_id) {
      inst.loggedAthleteIds.add(log.athlete_id);
    }
  }

  const byType = new Map();
  for (const inst of instances) {
    const type = inst.sessionType || 'unknown';
    let bucket = byType.get(type);
    if (!bucket) {
      bucket = { sessionType: type, sumLogged: 0, sumRoster: 0 };
      byType.set(type, bucket);
    }
    const roster = rosterSizeForSession(athleteTeams, inst.teamId, inst.sessionDate);
    const logged = inst.loggedAthleteIds.size;
    bucket.sumLogged += logged;
    bucket.sumRoster += roster;
  }

  const rows = [...byType.values()].map((bucket) => {
    const logged = bucket.sumLogged;
    const notLogged = Math.max(0, bucket.sumRoster - logged);
    const percent = bucket.sumRoster ? Math.round((logged / bucket.sumRoster) * 100) : 0;
    const label = sessionTypeLabel(bucket.sessionType) || bucket.sessionType || 'Session';
    return {
      key: bucket.sessionType,
      label,
      logged,
      notLogged,
      percent,
      sortLabel: label,
    };
  });

  return rows.sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    return a.sortLabel.localeCompare(b.sortLabel);
  });
}

export default function RPEComplianceBySession({ dateFrom, dateTo }) {
  const { user, activeOrgId, activeTeamId } = useUser();
  const { sessionTypeLabel } = useSessionConfig();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!dateFrom || !dateTo) {
        if (mounted) {
          setRows([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const currentUser = user ?? (await getCurrentUser());
        const orgId = getEffectiveOrgId(currentUser, activeOrgId);
        if (!currentUser || !orgId) {
          if (mounted) {
            setRows([]);
          }
          return;
        }

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        const teamIds = narrowTeamIds(effectiveTeamIds, activeTeamId);
        if (!teamIds.length) {
          if (mounted) setRows([]);
          return;
        }

        const { data: sessionRows, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, session_date, session_type, team_id, name')
          .eq('org_id', orgId)
          .in('team_id', teamIds)
          .gte('session_date', dateFrom)
          .lte('session_date', dateTo);
        if (sessionsError) throw sessionsError;
        const sessions = sessionRows ?? [];
        const sessionIds = sessions.map((s) => s.id);

        let linkedLogs = [];
        if (sessionIds.length) {
          const { data, error: logsError } = await supabase
            .from('session_athlete_logs')
            .select('session_id, athlete_id, actual_rpe')
            .eq('org_id', orgId)
            .in('session_id', sessionIds);
          if (logsError) throw logsError;
          linkedLogs = data ?? [];
        }

        const { data: orphanData, error: orphanError } = await supabase
          .from('session_athlete_logs')
          .select('session_id, athlete_id, actual_rpe, session_date, session_type, team_id')
          .eq('org_id', orgId)
          .in('team_id', teamIds)
          .is('session_id', null)
          .eq('source', 'teamworks_import')
          .not('session_date', 'is', null)
          .gte('session_date', dateFrom)
          .lte('session_date', dateTo);
        if (orphanError) throw orphanError;
        const orphanLogs = orphanData ?? [];

        const { data: athleteTeamRows, error: athleteTeamsError } = await supabase
          .from('athlete_teams')
          .select('athlete_id, team_id, joined_at, left_at, athletes!inner(id, org_id, is_active)')
          .in('team_id', teamIds)
          .eq('athletes.org_id', orgId)
          .eq('athletes.is_active', true);
        if (athleteTeamsError) throw athleteTeamsError;

        const athleteTeams = (athleteTeamRows ?? []).map((row) => ({
          athlete_id: row.athlete_id,
          team_id: row.team_id,
          joined_at: row.joined_at,
          left_at: row.left_at,
          athletes: Array.isArray(row.athletes) ? row.athletes[0] : row.athletes,
        }));

        const nextRows = buildRows({
          sessions,
          linkedLogs,
          orphanLogs,
          athleteTeams,
          sessionTypeLabel,
        });

        if (mounted) setRows(nextRows);
      } catch (err) {
        console.error('[RPEComplianceBySession]', err);
        if (mounted) {
          setError(err.message ?? 'Could not load RPE compliance.');
          setRows([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [user, activeOrgId, activeTeamId, dateFrom, dateTo, sessionTypeLabel]);

  return (
    <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
          RPE Compliance
        </h3>
        {!loading && !error && rows.length > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
            Sorted by rate ↑
          </span>
        )}
      </div>

      {loading && (
        <p className="mt-4 text-xs text-[var(--color-on-surface-variant)]">Loading…</p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-[var(--color-error-container)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-4 text-xs italic text-[var(--color-on-surface-variant)]">
          No sessions in range
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <ul className="mt-3 max-h-[7.5rem] space-y-1.5 overflow-y-auto">
            {rows.map((row) => {
              const total = row.logged + row.notLogged;
              const loggedPct = total ? (row.logged / total) * 100 : 0;
              return (
                <li key={row.key} className="flex h-6 items-center gap-2">
                  <span className="w-[7.5rem] shrink-0 truncate text-[11px] font-bold text-[var(--color-on-surface)]" title={row.label}>
                    {row.label}
                  </span>
                  <div
                    className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-outline-variant)]"
                    role="img"
                    aria-label={`${row.label}: ${row.percent}% logged`}
                  >
                    <span
                      className="h-full bg-[var(--color-excellent)]"
                      style={{ width: `${loggedPct}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-black text-[var(--color-on-surface)]">
                    {row.percent}%
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-[var(--color-on-surface-variant)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-excellent)]" />
              Logged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-outline-variant)]" />
              Not logged
            </span>
          </div>
        </>
      )}
    </div>
  );
}
