import { useEffect, useState } from 'react';
import { useWellness } from '../../hooks/useWellness';
import { WellnessField, formatScore, getCompositeScore, midpoint } from './wellnessFormFields';
import LogSkeleton from '../shared/skeletons/LogSkeleton';

export default function WellnessEntryForm() {
  const wellness = useWellness();
  const [responses, setResponses] = useState({});
  const readinessScore = wellness.todayLog?.composite_score ?? getCompositeScore(wellness.formItems, responses);

  useEffect(() => {
    setResponses((current) => {
      const next = { ...current };
      wellness.formItems.forEach((item) => {
        if (item.input_type === 'slider' && next[item.key] == null) next[item.key] = midpoint(item);
      });
      return next;
    });
  }, [wellness.formItems]);

  async function handleWellnessSubmit() {
    try {
      await wellness.submitWellness(responses);
    } catch (err) {
      console.error('[WellnessEntryForm] submit failed:', err);
    }
  }

  function updateResponse(key, value) {
    setResponses((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="space-y-4 rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Daily Check-in</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Morning Wellness</h2>
        </div>

        {wellness.loading && <LogSkeleton />}

        {wellness.error && (
          <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-error)]">
            {wellness.error}
          </div>
        )}

        {!wellness.loading && wellness.submitted && (
          <div className="rounded-2xl bg-[var(--color-tertiary-container)] p-5 text-[var(--color-on-tertiary)]">
            <p className="text-sm font-black uppercase tracking-widest">Wellness logged for today ✓</p>
            <p className="mt-2 text-3xl font-black">Readiness Score: {formatScore(readinessScore)} / 5</p>
          </div>
        )}

        {!wellness.loading && !wellness.submitted && (
          <div className="space-y-5">
            {wellness.formItems.map((item) => (
              <WellnessField key={item.id} item={item} value={responses[item.key]} onChange={updateResponse} />
            ))}
            <button
              type="button"
              disabled={wellness.submitting}
              onClick={handleWellnessSubmit}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-container)] text-sm font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
            >
              {wellness.submitting && <span className="material-symbols-outlined animate-spin text-base">refresh</span>}
              {wellness.submitting ? 'Submitting...' : 'Submit Wellness'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
