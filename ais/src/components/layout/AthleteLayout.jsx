import BottomNav from './BottomNav';

export default function AthleteLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)] font-['Inter']">
      <main className="px-4 pb-28 pt-10 lg:pb-10">{children}</main>
      <BottomNav variant="athlete" />
    </div>
  );
}
