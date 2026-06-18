import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import { getEffectiveOrgId } from '../../lib/orgScope';
import {
  DEFAULT_PERCENTILE_BANDS,
  validatePercentileBands,
} from '../../lib/assessmentSettingsConstants';

const INPUT_CLASS =
  'w-16 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';

function ColorDot({ colorVar }) {
  const cssVar = colorVar?.startsWith('--') ? colorVar : '--color-avg';
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: `var(${cssVar})` }}
    />
  );
}

function BandRow({ band, index, total, disabled, onChange }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <ColorDot colorVar={band.color} />
      <span className="w-28 text-xs font-bold text-[var(--color-on-surface)]">{band.label}</span>
      {!isFirst && (
        <div className="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]">
          <span>min</span>
          <input
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={band.min}
            onChange={(e) => onChange(index, 'min', Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      )}
      {isFirst && (
        <span className="text-xs text-[var(--color-on-surface-variant)]">0 –</span>
      )}
      {!isLast && (
        <div className="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]">
          <span>max</span>
          <input
            type="number"
            min={0}
            max={100}
            disabled={disabled}
            value={band.max}
            onChange={(e) => onChange(index, 'max', Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      )}
      {isLast && (
        <span className="text-xs text-[var(--color-on-surface-variant)]">– 100</span>
      )}
    </div>
  );
}

export default function PercentileBandsTab({ onToast }) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const canEdit = canSync(user, 'assessments', 'edit') || Boolean(user?.isSuperuser);

  const [bands, setBands] = useState(DEFAULT_PERCENTILE_BANDS);
  const [themeConfig, setThemeConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const load = useCallback(async () => {
    if (!effectiveOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organisations')
        .select('theme_config')
        .eq('id', effectiveOrgId)
        .maybeSingle();
      if (error) throw error;
      const config = data?.theme_config ?? {};
      setThemeConfig(config);
      const stored = config.assessment_percentile_bands;
      if (Array.isArray(stored) && stored.length > 0) {
        setBands(stored);
      } else {
        setBands(DEFAULT_PERCENTILE_BANDS);
      }
    } catch (err) {
      console.error('[PercentileBandsTab] load failed:', err);
      onToast?.(err.message ?? 'Could not load percentile bands', 'error');
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleBandChange(index, field, value) {
    setBands((prev) => {
      const next = prev.map((b, i) => (i === index ? { ...b, [field]: value } : { ...b }));
      if (field === 'max' && index < next.length - 1) {
        next[index + 1] = { ...next[index + 1], min: value };
      }
      if (field === 'min' && index > 0) {
        next[index - 1] = { ...next[index - 1], max: value };
      }
      return next;
    });
    setValidationError(null);
  }

  async function handleSave() {
    if (!effectiveOrgId || !canEdit) return;
    const err = validatePercentileBands(bands);
    if (err) {
      setValidationError(err);
      onToast?.(err, 'error');
      return;
    }
    setSaving(true);
    setValidationError(null);
    try {
      const nextConfig = {
        ...themeConfig,
        assessment_percentile_bands: bands,
      };
      const { error } = await supabase
        .from('organisations')
        .update({ theme_config: nextConfig })
        .eq('id', effectiveOrgId);
      if (error) throw error;
      setThemeConfig(nextConfig);
      onToast?.('Percentile bands saved', 'success');
    } catch (loadErr) {
      console.error('[PercentileBandsTab] save failed:', loadErr);
      onToast?.(loadErr.message ?? 'Could not save percentile bands', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--color-on-surface)]">Percentile Bands</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-on-surface-variant)]">
          Org-wide percentile boundaries for overall classification (must be contiguous, 0–100)
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[var(--color-primary-container)]">
            progress_activity
          </span>
        </div>
      ) : (
        <div
          className="rounded-lg bg-[var(--color-surface-container-high)] px-4 py-4"
          style={{ border: '1px solid var(--color-outline-variant)' }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            void handleSave();
          }}
        >
          {bands.map((band, index) => (
            <BandRow
              key={band.label}
              band={band}
              index={index}
              total={bands.length}
              disabled={!canEdit || saving}
              onChange={handleBandChange}
            />
          ))}

          {validationError && (
            <p className="mt-3 text-sm text-[var(--color-error)]">{validationError}</p>
          )}

          {saving && (
            <p className="mt-2 text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Saving…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
