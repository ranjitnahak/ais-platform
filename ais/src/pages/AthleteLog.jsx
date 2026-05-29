import RPEEntryForm from '../components/log/RPEEntryForm';
import WellnessEntryForm from '../components/log/WellnessEntryForm';

export default function AthleteLog() {
  return (
    <div className="mx-auto max-w-[480px] space-y-5">
      <header className="rounded-3xl bg-[var(--color-surface-container)] p-6 shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">Log</p>
        <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight">Record your session</h1>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Training load and morning readiness.</p>
      </header>
      <RPEEntryForm />
      <WellnessEntryForm />
    </div>
  );
}
