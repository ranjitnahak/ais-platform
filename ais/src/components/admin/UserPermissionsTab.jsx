import { useState } from 'react';
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../../lib/adminUserConstants';

function PermissionCheckbox({ cell, onToggle }) {
  const { state, value } = cell;
  let boxClass = 'border-[var(--color-outline-variant)] bg-transparent';
  let icon = value ? 'check' : '';
  if (state === 'override_on') {
    boxClass = 'border-[var(--color-primary-container)] bg-[var(--color-primary-container)]';
    icon = 'check';
  } else if (state === 'override_off') {
    boxClass = 'border-[var(--color-error-container)] bg-[var(--color-error-container)]';
    icon = 'close';
  } else if (state === 'inherited') {
    boxClass = value
      ? 'border-[var(--color-outline)] bg-[var(--color-surface-variant)]'
      : 'border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]';
    icon = value ? 'check' : '';
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mx-auto flex h-5 w-5 items-center justify-center rounded border-2 ${boxClass}`}
      title={state === 'inherited' ? 'Inherited from role' : state === 'override_on' ? 'Override: allowed' : 'Override: denied'}
    >
      {icon && (
        <span className={`material-symbols-outlined text-[14px] leading-none ${state === 'override_off' ? 'text-[var(--color-on-error-container)]' : 'text-[var(--color-on-surface)]'}`}>
          {icon}
        </span>
      )}
    </button>
  );
}

export default function UserPermissionsTab({ permissions }) {
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  if (permissions.loading) {
    return <p className="text-sm text-[var(--color-outline)]">Loading permissions…</p>;
  }
  if (permissions.error) {
    return <p className="text-sm text-[var(--color-error)]">{permissions.error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Role: <span className="font-bold text-[var(--color-on-surface)]">{permissions.roleName}</span>
          {' · '}
          <span className="text-[var(--color-outline)]">Grey = inherited</span>
          {' · '}
          <span className="text-[var(--color-primary-container)]">Orange = override on</span>
          {' · '}
          <span className="text-[var(--color-error)]">Red = override off</span>
        </p>
        <div className="flex items-center gap-3">
          {permissions.savedAt && (
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-tertiary-fixed-dim)]">Saved</span>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetAll(true)}
            className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]"
          >
            Reset all overrides
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
            <tr>
              <th className="px-4 py-3 font-black">Resource</th>
              {PERMISSION_ACTIONS.map(([, , label]) => (
                <th key={label} className="px-4 py-3 text-center font-black">{label}</th>
              ))}
              <th className="px-4 py-3 font-black" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-outline-variant)]">
            {PERMISSION_RESOURCES.map((resource) => (
              <tr key={resource}>
                <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">{resource}</td>
                {PERMISSION_ACTIONS.map(([, action]) => (
                  <td key={action} className="px-4 py-3 text-center">
                    <PermissionCheckbox
                      cell={permissions.resolvedMap[resource][action]}
                      onToggle={() => permissions.toggleOverride(resource, action)}
                    />
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  {permissions.overrides[resource] && (
                    <button
                      type="button"
                      onClick={() => permissions.resetResource(resource)}
                      className="text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)] hover:text-[var(--color-on-surface)]"
                    >
                      Reset row
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmResetAll && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
            <h3 className="text-lg font-black text-[var(--color-on-surface)]">Reset all overrides?</h3>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              This will remove all custom permissions for this user. They will revert to their role defaults.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmResetAll(false)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  await permissions.resetAll();
                  setConfirmResetAll(false);
                }}
                className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)]"
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
