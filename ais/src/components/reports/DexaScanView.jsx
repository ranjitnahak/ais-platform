import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';
import {
  ageFromDob,
  formatMetric,
  formatScanDate,
  gramsToKg,
  interpretTScore,
} from '../../lib/dexaInterpret';
import DexaMetricCard from './dexa/DexaMetricCard';
import DexaRegionalBarChart from './dexa/DexaRegionalBarChart';
import DexaTrendChart from './dexa/DexaTrendChart';
import DexaIndicesGrid from './dexa/DexaIndicesGrid';

export default function DexaScanView({ athlete, athleteId, effectiveOrgId }) {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadScans() {
      if (!athleteId || !effectiveOrgId) {
        setScans([]);
        setSelectedScanId(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data, error: scanError } = await supabase
          .from('dexa_scans')
          .select('*')
          .eq('org_id', effectiveOrgId)
          .eq('athlete_id', athleteId)
          .order('scan_date', { ascending: false });

        if (scanError) throw scanError;
        const rows = data ?? [];
        if (!mounted) return;
        setScans(rows);
        setSelectedScanId(rows[0]?.id ?? null);
      } catch (err) {
        console.error('[DexaReports]', err);
        if (mounted) {
          setError(err?.message ?? 'Failed to load scans.');
          setScans([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadScans();
    return () => {
      mounted = false;
    };
  }, [athleteId, effectiveOrgId]);

  const selectedScan = useMemo(
    () => scans.find((s) => s.id === selectedScanId) ?? scans[0] ?? null,
    [scans, selectedScanId],
  );

  const latestScan = scans[0] ?? null;
  const age = ageFromDob(athlete?.date_of_birth);
  const tScoreInfo = interpretTScore(selectedScan?.t_score);
  const leanKg = gramsToKg(selectedScan?.total_lean_g);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="app-loading-progress" aria-hidden />
        <p className="text-sm font-bold text-[var(--color-on-surface-variant)]">Loading scans…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
        {error}
      </div>
    );
  }

  if (!scans.length) {
    return (
      <p className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
        No scan records for this athlete.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-4 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
        {athlete?.photo_url ? (
          <img
            src={athlete.photo_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-variant)] text-lg font-black text-[var(--color-on-surface)]">
            {athleteInitialsFromAthlete(athlete)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-[var(--color-on-surface)]">
            {athleteDisplayName(athlete)}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            {athlete?.date_of_birth
              ? `DOB ${formatScanDate(athlete.date_of_birth)}${age != null ? ` · Age ${age}` : ''}`
              : age != null
                ? `Age ${age}`
                : '—'}
          </p>
          {latestScan?.scan_date && (
            <p className="mt-1 text-xs font-bold text-[var(--color-text-muted)]">
              Latest scan: {formatScanDate(latestScan.scan_date)}
            </p>
          )}
        </div>
        <span className="rounded-full bg-[var(--color-primary-container)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-primary)]">
          Latest Scan
        </span>
      </header>

      {scans.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {scans.map((scan) => {
            const active = scan.id === (selectedScan?.id ?? selectedScanId);
            return (
              <button
                key={scan.id}
                type="button"
                onClick={() => setSelectedScanId(scan.id)}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                    : 'border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
                }`}
              >
                {formatScanDate(scan.scan_date)}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          Key Metrics
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DexaMetricCard
            label="Total Body Fat %"
            value={formatMetric(selectedScan?.total_fat_pct, 1)}
            unit="%"
          />
          <DexaMetricCard
            label="Total Lean Mass"
            value={leanKg != null ? formatMetric(leanKg, 1) : '—'}
            unit="kg"
          />
          <DexaMetricCard label="BMI" value={formatMetric(selectedScan?.bmi, 1)} />
          <DexaMetricCard
            label="Android/Gynoid Ratio"
            value={formatMetric(selectedScan?.android_gynoid_ratio, 2)}
          />
        </div>
      </section>

      <DexaRegionalBarChart scan={selectedScan} />

      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          Bone Health
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DexaMetricCard label="Total BMD" value={formatMetric(selectedScan?.total_bmd, 3)} />
          <DexaMetricCard label="Total BMC" value={formatMetric(selectedScan?.total_bmc, 2)} />
          <DexaMetricCard
            label="T-Score"
            value={formatMetric(selectedScan?.t_score, 1)}
            accentColor={tScoreInfo.colorVar}
          />
          <div className="rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-4">
            <p className="text-2xl font-black tabular-nums text-[var(--color-on-surface)]">
              {formatMetric(selectedScan?.z_score, 1)}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Z-Score
            </p>
            <p className="mt-2 text-xs font-bold" style={{ color: tScoreInfo.colorVar }}>
              T-Score: {tScoreInfo.label}
            </p>
          </div>
        </div>
      </section>

      <DexaIndicesGrid scan={selectedScan} />
      <DexaTrendChart scans={scans} />

      <div className="border-t border-[var(--color-outline-variant)] pt-4">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="min-h-11 cursor-not-allowed rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-6 text-sm font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] opacity-50"
        >
          Export PDF
        </button>
      </div>
    </div>
  );
}
