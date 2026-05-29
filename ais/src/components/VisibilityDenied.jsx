import Sidebar from './Sidebar';
import { TopBarUserMenu } from './layout/TopBar';

/** Shown when a route exists but visibility is disabled for the current user. */
export default function VisibilityDenied({ title = 'Access restricted' }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-['Inter'] text-[var(--color-on-surface)]">
      <Sidebar />
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 px-6 backdrop-blur-xl lg:pl-72">
        <h1 className="text-xl font-black tracking-tight">{title}</h1>
        <TopBarUserMenu showSearch={false} />
      </header>
      <main className="mx-auto max-w-7xl px-6 pb-32 pt-24 lg:pl-72">
        <p className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
          You do not have access to this section. Contact your administrator if you need access.
        </p>
      </main>
    </div>
  );
}
