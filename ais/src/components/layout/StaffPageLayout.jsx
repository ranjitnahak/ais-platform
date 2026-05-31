import Sidebar from '../Sidebar';
import { TopBarUserMenu } from './TopBar';
import PersonalisedHeader, { HeaderBrandMark } from '../shared/PersonalisedHeader';
import { useUser } from '../../context/UserContext';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function StaffPageLayout({
  title,
  subtitle,
  children,
  showSearch = true,
  personalisedHeader = false,
}) {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const showPersonalisedInBar = personalisedHeader && isMobile;
  const showClassicTitle = title && !showPersonalisedInBar;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-['Inter'] text-[var(--color-on-surface)]">
      <Sidebar />
      <header
        className={`fixed top-0 z-40 w-full border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 px-6 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:pl-72 ${
          showPersonalisedInBar
            ? 'flex flex-col gap-2 pb-2'
            : 'flex min-h-16 items-center justify-between'
        }`}
      >
        {showPersonalisedInBar ? (
          <>
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <PersonalisedHeader user={user} showLogo={false} />
              </div>
              <HeaderBrandMark user={user} className="pt-0.5" />
            </div>
            <div className="w-full">
              <TopBarUserMenu showSearch={showSearch} compact />
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              {showClassicTitle ? (
                <>
                  <h1 className="truncate text-xl font-black tracking-tight text-[var(--color-on-surface)]">{title}</h1>
                  {subtitle && (
                    <p className="mt-0.5 truncate text-sm text-[var(--color-on-surface-variant)]">{subtitle}</p>
                  )}
                </>
              ) : null}
            </div>
            <div className="shrink-0">
              <TopBarUserMenu showSearch={showSearch} />
            </div>
          </>
        )}
      </header>
      <main
        className={`mx-auto max-w-7xl space-y-6 px-6 pb-32 lg:pl-72 ${
          showPersonalisedInBar
            ? 'pt-[calc(7.5rem+env(safe-area-inset-top))]'
            : 'pt-[calc(6rem+env(safe-area-inset-top))]'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
