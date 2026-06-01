import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { resolveOrgTeamScope } from '../../lib/orgScope';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import DexaScanView from './DexaScanView';

export default function DexaReportsTab({ user, activeOrgId, effectiveOrgId }) {
  const [athletes, setAthletes] = useState([]);
  const [scanMeta, setScanMeta] = useState({});
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadAthletesWithScans() {
      try {
        setLoading(true);
        setError(null);
        const currentUser = user ?? (await getCurrentUser());
        if (!currentUser || !effectiveOrgId) {
          if (mounted) {
            setAthletes([]);
            setScanMeta({});
          }
          return;
        }

        const { data: scanRows, error: scanError } = await supabase
          .from('dexa_scans')
          .select('athlete_id, scan_date')
          .eq('org_id', effectiveOrgId);

        if (scanError) throw scanError;

        const meta = {};
        for (const row of scanRows ?? []) {
          if (!row.athlete_id) continue;
          const existing = meta[row.athlete_id] ?? { count: 0, latestDate: null };
          existing.count += 1;
          if (!existing.latestDate || row.scan_date > existing.latestDate) {
            existing.latestDate = row.scan_date;
          }
          meta[row.athlete_id] = existing;
        }

        const athleteIdsWithScans = Object.keys(meta);
        if (!athleteIdsWithScans.length) {
          if (mounted) {
            setAthletes([]);
            setScanMeta({});
          }
          return;
        }

        const { effectiveTeamIds, isSuperuser } = await resolveOrgTeamScope(
          supabase,
          currentUser,
          activeOrgId,
        );

        let scopedIds = athleteIdsWithScans;

        if (!isSuperuser || activeOrgId) {
          if (!effectiveTeamIds.length) {
            if (mounted) {
              setAthletes([]);
              setScanMeta({});
            }
            return;
          }
          const { data: teamRows, error: teamError } = await supabase
            .from('athlete_teams')
            .select('athlete_id')
            .in('team_id', effectiveTeamIds)
            .in('athlete_id', athleteIdsWithScans);

          if (teamError) throw teamError;
          const teamAthleteSet = new Set((teamRows ?? []).map((r) => r.athlete_id));
          scopedIds = athleteIdsWithScans.filter((id) => teamAthleteSet.has(id));
        }

        if (!scopedIds.length) {
          if (mounted) {
            setAthletes([]);
            setScanMeta({});
          }
          return;
        }

        const { data: athleteRows, error: athleteError } = await supabase
          .from('athletes')
          .select('id, first_name, last_name, full_name, photo_url, date_of_birth')
          .eq('org_id', effectiveOrgId)
          .eq('is_active', true)
          .in('id', scopedIds)
          .order('last_name', { ascending: true });

        if (athleteError) throw athleteError;

        if (!mounted) return;
        const rows = athleteRows ?? [];
        setAthletes(rows);
        setScanMeta(meta);
        setSelectedAthleteId((prev) => {
          if (prev && rows.some((a) => a.id === prev)) return prev;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        console.error('[DexaReports]', err);
        if (mounted) setError(err?.message ?? 'Failed to load DEXA athletes.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAthletesWithScans();
    return () => {
      mounted = false;
    };
  }, [user, activeOrgId, effectiveOrgId]);

  useEffect(() => {
    setSelectedAthleteId(null);
  }, [effectiveOrgId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => athleteDisplayName(a).toLowerCase().includes(q));
  }, [athletes, query]);

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
      <div className="space-y-3 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
        <label className="text-xs font-black uppercase tracking-widest text-[var(--color-outline)]">
          Athletes with DEXA scans
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="min-h-11 w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]"
        />

        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}

        {loading && (
          <div className="space-y-2 py-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton-bone h-12 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && !filtered.length && (
          <p className="py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
            No DEXA scans yet for your teams.
          </p>
        )}

        {!loading && (
          <div className="max-h-[min(480px,60vh)] overflow-y-auto">
            {filtered.map((athlete) => {
              const meta = scanMeta[athlete.id];
              const selected = athlete.id === selectedAthleteId;
              return (
                <button
                  key={athlete.id}
                  type="button"
                  onClick={() => setSelectedAthleteId(athlete.id)}
                  className={`mb-2 flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-surface)]'
                      : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {athlete.photo_url ? (
                    <img
                      src={athlete.photo_url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-variant)] text-[10px] font-black">
                      {athleteInitialsFromAthlete(athlete)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-on-surface)]">
                    {athleteDisplayName(athlete)}
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-black text-[var(--color-outline)]">
                    {meta?.count ?? 0} scan{(meta?.count ?? 0) !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0">
        {!selectedAthleteId ? (
          <p className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
            Select an athlete to view DEXA reports.
          </p>
        ) : (
          <DexaScanView
            athlete={selectedAthlete}
            athleteId={selectedAthleteId}
            effectiveOrgId={effectiveOrgId}
          />
        )}
      </div>
    </div>
  );
}
