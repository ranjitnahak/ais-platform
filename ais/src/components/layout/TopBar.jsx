import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';

function formatRole(role) {
  if (!role) return 'User';
  return role
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function TopBarUserMenu({ showSearch = true }) {
  const { user, activeOrgId, setActiveOrgId } = useUser();
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

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const displayName = user?.fullName?.trim() || 'Signed in user';
  const roleLabel = formatRole(user?.role);
  const isSuperuser = Boolean(user?.isSuperuser);
  const currentOrg = isSuperuser
    ? user?.allOrgs?.find((org) => org.id === activeOrgId || org.id === user?.orgId)
    : null;

  return (
    <div className="flex items-center gap-5">
      {isSuperuser && (
        <select
          value={activeOrgId ?? user?.orgId ?? ''}
          onChange={(event) => setActiveOrgId(event.target.value)}
          className="min-h-9 max-w-[220px] rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)] outline-none"
          aria-label="Switch organisation"
        >
          {(user?.allOrgs ?? []).map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      )}
      {showSearch && (
        <span
          className="material-symbols-outlined cursor-pointer text-[var(--color-outline)] transition-opacity hover:opacity-80"
          aria-hidden
        >
          search
        </span>
      )}
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
              {isSuperuser && currentOrg && (
                <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                  {currentOrg.name}
                </p>
              )}
            </div>
            <div className="my-1 border-t border-[var(--color-outline-variant)]" />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="block w-full px-4 py-2 text-left text-sm font-bold text-[var(--color-error)] hover:bg-[var(--color-error-container)]/15"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TopBar({ title, children, showSearch = true }) {
  return (
    <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 px-6 backdrop-blur-xl md:pl-72">
      <div className="flex min-w-0 items-center gap-4">{children ?? <h1 className="truncate text-xl font-bold tracking-tight text-[var(--color-on-surface)]">{title}</h1>}</div>
      <TopBarUserMenu showSearch={showSearch} />
    </header>
  );
}
