import Sidebar from '../Sidebar';
import { TopBarUserMenu } from './TopBar';

export default function StaffPageLayout({ title, subtitle, children, showSearch = true }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-['Inter'] text-[var(--color-on-surface)]">
      <Sidebar />
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 px-6 backdrop-blur-xl md:pl-72">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-[var(--color-on-surface)]">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-sm text-[var(--color-on-surface-variant)]">{subtitle}</p>
          )}
        </div>
        <TopBarUserMenu showSearch={showSearch} />
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-6 pb-32 pt-24 md:pl-72">{children}</main>
    </div>
  );
}
