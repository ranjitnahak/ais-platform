import { useEffect, useRef, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { getUserAccountLabels, signOutAndRedirect } from '../../lib/authSession';
import { useIsMobile } from '../../hooks/useIsMobile';
import OrgSwitcher from './OrgSwitcher';

export function TopBarUserMenu({ showSearch = true, showProfile }) {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const showProfileButton = showProfile ?? !isMobile;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const { displayName, roleLabel } = getUserAccountLabels(user);

  return (
    <div className="flex items-center gap-5">
      <OrgSwitcher />
      {showSearch && (
        <span
          className="material-symbols-outlined cursor-pointer text-[var(--color-outline)] transition-opacity hover:opacity-80"
          aria-hidden
        >
          search
        </span>
      )}
      {showProfileButton && (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] text-[var(--color-outline)] transition hover:text-[var(--color-on-surface)]"
          aria-label="Account menu"
          aria-expanded={open}
        >
          <span className="material-symbols-outlined text-sm">person</span>
        </button>
        {open && (
          <div className="absolute right-0 top-10 z-50 min-w-[220px] rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] py-2 shadow-xl">
            <div className="px-4 py-2">
              <p className="text-sm font-bold text-[var(--color-on-surface)]">{displayName}</p>
              <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">{roleLabel}</p>
            </div>
            <div className="my-1 border-t border-[var(--color-outline-variant)]" />
            <button
              type="button"
              onClick={() => void signOutAndRedirect()}
              className="block w-full px-4 py-2 text-left text-sm font-bold text-[var(--color-error)] hover:bg-[var(--color-error-container)]/15"
            >
              Log out
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default function TopBar({ title, children, showSearch = true }) {
  return (
    <header className="fixed top-0 z-40 flex min-h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 px-6 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:pl-72">
      <div className="flex min-w-0 items-center gap-4">{children ?? <h1 className="truncate text-xl font-bold tracking-tight text-[var(--color-on-surface)]">{title}</h1>}</div>
      <TopBarUserMenu showSearch={showSearch} />
    </header>
  );
}
