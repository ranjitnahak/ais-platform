import { useState } from 'react';
import { useUser } from '../../context/UserContext';

export default function OrgSwitcher() {
  const { user, activeOrgId, setActiveOrgId } = useUser();
  const [open, setOpen] = useState(false);
  if (!user?.isSuperuser) return null;
  function handleSetActiveOrgId(orgId) {
    setActiveOrgId(orgId);
  }

  const allOrgs = user.allOrgs ?? [];
  const currentOrg = allOrgs.find((org) => org.id === activeOrgId) ?? allOrgs.find((org) => org.id === user.orgId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 text-xs font-bold text-[var(--color-on-surface)]"
      >
        <span className="truncate max-w-[180px]">{currentOrg?.name ?? 'Select organisation'}</span>
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[240px] rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] p-2 shadow-xl">
          {allOrgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                handleSetActiveOrgId(org.id);
                setOpen(false);
                window.location.reload();
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                org.id === activeOrgId
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                  : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
