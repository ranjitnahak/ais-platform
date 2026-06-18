import { useState } from 'react';
import { useTestDefinitions } from '../../hooks/useTestDefinitions';
import { useBenchmarkTiers } from '../../hooks/useBenchmarkTiers';
import {
  SCORING_METHODS,
  DEFAULT_TIERS,
  scoringMethodNeedsTiers,
} from '../../lib/assessmentSettingsConstants';

const INPUT_CLASS =
  'w-20 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';

function ColorDot({ colorVar }) {
  const cssVar = colorVar?.startsWith('--') ? colorVar : '--color-avg';
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: `var(${cssVar})` }}
    />
  );
}

function TierRow({
  tier,
  test,
  saving,
  canEdit,
  showCustomWarning,
  onUpsert,
  onDelete,
}) {
  const isExcellent = tier.tier_order === 4;
  const isLowerBetter = test.direction === 'lower_is_better';
  const [minVal, setMinVal] = useState(tier.threshold_min ?? '');
  const [maxVal, setMaxVal] = useState(tier.threshold_max ?? '');

  async function saveMin() {
    const num = minVal === '' ? null : Number(minVal);
    if (num !== tier.threshold_min) {
      await onUpsert(test.id, tier.tier_order, { threshold_min: num });
    }
  }

  async function saveMax() {
    const num = maxVal === '' ? null : Number(maxVal);
    if (num !== tier.threshold_max) {
      await onUpsert(test.id, tier.tier_order, { threshold_max: num });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <ColorDot colorVar={tier.tier_color} />
      <span className="w-28 text-xs font-bold text-[var(--color-on-surface)]">{tier.tier_name}</span>

      {isExcellent ? (
        <div className="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]">
          <span>{isLowerBetter ? '<' : '>'}</span>
          <input
            type="number"
            step="any"
            disabled={!canEdit || saving}
            value={isLowerBetter ? maxVal : minVal}
            onChange={(e) => (isLowerBetter ? setMaxVal(e.target.value) : setMinVal(e.target.value))}
            onBlur={() => void (isLowerBetter ? saveMax() : saveMin())}
            className={INPUT_CLASS}
          />
          {test.unit && (
            <span className="text-[10px] uppercase tracking-widest">{test.unit}</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
          {isLowerBetter ? (
            <>
              <span>≥</span>
              <input
                type="number"
                step="any"
                disabled={!canEdit || saving}
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                onBlur={() => void saveMin()}
                className={INPUT_CLASS}
              />
              {tier.tier_order < 4 && (
                <>
                  <span>and &lt;</span>
                  <input
                    type="number"
                    step="any"
                    disabled={!canEdit || saving}
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    onBlur={() => void saveMax()}
                    className={INPUT_CLASS}
                  />
                </>
              )}
            </>
          ) : (
            <>
              {tier.tier_order > 1 && (
                <>
                  <span>≥</span>
                  <input
                    type="number"
                    step="any"
                    disabled={!canEdit || saving}
                    value={minVal}
                    onChange={(e) => setMinVal(e.target.value)}
                    onBlur={() => void saveMin()}
                    className={INPUT_CLASS}
                  />
                </>
              )}
              {tier.tier_order < 4 && (
                <>
                  <span>and &lt;</span>
                  <input
                    type="number"
                    step="any"
                    disabled={!canEdit || saving}
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    onBlur={() => void saveMax()}
                    className={INPUT_CLASS}
                  />
                </>
              )}
            </>
          )}
          {test.unit && (
            <span className="text-[10px] uppercase tracking-widest">{test.unit}</span>
          )}
        </div>
      )}

      {tier.tier_order > 4 && canEdit && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onDelete(tier.id, tier.tier_order)}
          className="rounded p-1 text-[var(--color-on-surface-variant)] hover:text-[var(--color-error)]"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      )}

      {showCustomWarning && tier.tier_order > 4 && (
        <p className="w-full text-[10px] text-[var(--color-primary-container)]">
          Custom tiers beyond 4 display as nearest standard tier until V2 scoring engine update
        </p>
      )}
    </div>
  );
}

function TestBenchmarkCard({
  test,
  scoringMethod,
  tiers,
  saving,
  canEdit,
  hasCustomTiers,
  onMethodChange,
  onUpsert,
  onAddTier,
  onDeleteTier,
}) {
  const showTiers = scoringMethodNeedsTiers(scoringMethod);

  return (
    <div
      className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-4"
      style={{ border: '1px solid var(--color-outline-variant)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--color-on-surface)]">{test.name}</p>
          {test.unit && (
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              {test.unit} · {test.direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}
            </p>
          )}
        </div>
        <select
          value={scoringMethod}
          disabled={!canEdit || saving}
          onChange={(e) => void onMethodChange(test.id, e.target.value)}
          className="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-on-surface)]"
        >
          {SCORING_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {showTiers && (
        <div className="mt-4 border-t border-[var(--color-outline-variant)] pt-3">
          {(tiers.length ? tiers : DEFAULT_TIERS.map((d) => ({ ...d, id: null }))).map((tier) => (
            <TierRow
              key={tier.id ?? tier.tier_order}
              tier={tier}
              test={test}
              saving={saving}
              canEdit={canEdit}
              showCustomWarning={hasCustomTiers}
              onUpsert={onUpsert}
              onDelete={onDeleteTier}
            />
          ))}
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void onAddTier(test.id)}
              className="mt-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-primary-container)]"
            >
              + Add tier
            </button>
          )}
          {hasCustomTiers && (
            <p className="mt-2 text-[10px] text-[var(--color-on-surface-variant)]">
              Custom tiers beyond 4 display as nearest standard tier until V2 scoring engine update
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BenchmarksTab({ selectedTeamId, onToast }) {
  const onError = (msg) => onToast?.(msg, 'error');

  const { activeTests, loading: testsLoading, canEdit } = useTestDefinitions(selectedTeamId, { onError });
  const {
    loading: tiersLoading,
    saving,
    getScoringMethod,
    getTiersForTest,
    setScoringMethod,
    upsertTier,
    addCustomTier,
    deleteTier,
  } = useBenchmarkTiers(selectedTeamId, activeTests, { onError });

  const loading = testsLoading || tiersLoading;

  async function handleMethodChange(testId, method) {
    try {
      await setScoringMethod(testId, method);
    } catch {
      // toast handled
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--color-on-surface)]">Benchmarks</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-on-surface-variant)]">
          Scoring method and absolute tier thresholds per active test
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[var(--color-primary-container)]">
            progress_activity
          </span>
        </div>
      ) : !selectedTeamId ? (
        <p className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          Select a team to configure benchmarks.
        </p>
      ) : activeTests.length === 0 ? (
        <p className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          No active tests in this team&apos;s battery. Add tests in the Test Battery tab.
        </p>
      ) : (
        <div className="space-y-3">
          {activeTests.map((test) => {
            const tiers = getTiersForTest(test.id);
            const hasCustomTiers = tiers.some((t) => t.tier_order > 4);
            return (
              <TestBenchmarkCard
                key={test.id}
                test={test}
                scoringMethod={getScoringMethod(test.id)}
                tiers={tiers}
                saving={saving}
                canEdit={canEdit}
                hasCustomTiers={hasCustomTiers}
                onMethodChange={handleMethodChange}
                onUpsert={upsertTier}
                onAddTier={addCustomTier}
                onDeleteTier={deleteTier}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
