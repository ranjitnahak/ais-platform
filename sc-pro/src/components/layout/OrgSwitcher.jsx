import { useState } from 'react';
import { useUser } from '../../context/UserContext.jsx';

const buttonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-high)',
  fontSize: 'var(--font-size-body-sm)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--color-text)',
  cursor: 'pointer',
};

const menuStyle = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 4px)',
  zIndex: 50,
  minWidth: 240,
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-high)',
  padding: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
};

export default function OrgSwitcher() {
  const { user, activeOrgId, setActiveOrgId } = useUser();
  const [open, setOpen] = useState(false);

  if (!user?.isSuperuser) return null;

  const allOrgs = user.allOrgs ?? [];
  if (!allOrgs.length) return null;

  const currentOrg = allOrgs.find((org) => org.id === activeOrgId)
    ?? allOrgs.find((org) => org.id === user.orgId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={buttonStyle}
      >
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentOrg?.name ?? 'Select organisation'}
        </span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div style={menuStyle}>
          {allOrgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                setActiveOrgId(org.id);
                setOpen(false);
                window.location.reload();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 'var(--radius-default)',
                border: 'none',
                background: org.id === activeOrgId ? 'var(--color-primary-soft)' : 'transparent',
                color: org.id === activeOrgId ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontSize: 'var(--font-size-body-sm)',
                fontWeight: org.id === activeOrgId ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                cursor: 'pointer',
              }}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
