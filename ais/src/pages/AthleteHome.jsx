import RPEEntryForm from '../components/log/RPEEntryForm';
import WellnessEntryForm from '../components/log/WellnessEntryForm';

export default function AthleteHome() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] px-4 py-8 font-['Inter'] text-[var(--color-on-surface)]">
      <main className="mx-auto max-w-[480px] space-y-5">
        <header className="rounded-3xl bg-[var(--color-surface-container)] p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">AIS Athlete</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight">How was your session today?</h1>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Log training load and your morning readiness.</p>
        </header>
        <RPEEntryForm />
        <WellnessEntryForm />
      </main>
    </div>
  );
}
