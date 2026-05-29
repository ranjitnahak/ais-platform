import { Fragment, useState } from 'react';
import { PERMISSION_ACTIONS, PERMISSION_CATEGORIES } from '../../lib/adminUserConstants';

function PermissionCheckbox({ cell, onToggle, dimmed = false }) {
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
      disabled={dimmed}
      className={`mx-auto flex h-5 w-5 items-center justify-center rounded border-2 ${boxClass} ${dimmed ? 'opacity-[0.35] pointer-events-none' : ''}`}
      title={
        state === 'inherited'
          ? 'Inherited from role'
          : state === 'override_on'
            ? 'Override: allowed'
            : 'Override: denied'
      }
    >
      {icon && (
        <span className={`material-symbols-outlined text-[14px] leading-none ${state === 'override_off' ? 'text-[var(--color-on-error-container)]' : 'text-[var(--color-on-surface)]'}`}>
          {icon}
        </span>
      )}
    </button>
  );
}

function shouldDimCrud(resolvedMap, resource) {
  return resolvedMap[resource]?.visible?.state === 'override_off';
}

function hasMisconfiguration(resolvedMap, resource) {
  const visible = resolvedMap[resource]?.visible;
  const view = resolvedMap[resource]?.view;
  return visible?.value === true && view?.value === false;
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
          {permissions.isDirty && !permissions.saving && (
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">Unsaved changes</span>
          )}
          {permissions.savedAt && !permissions.isDirty && (
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-tertiary-fixed-dim)]">Saved</span>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetAll(true)}
            className="rounded-lg border border-[var(--color-outline-variant)] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]"
          >
            Reset to Role Defaults
          </button>
        </div>
      </div>

      {!permissions.isSelfEdit && (
        <p className="rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-3 py-2 text-xs text-[var(--color-on-surface-variant)]">
          You are editing another user&apos;s permissions. Dashboard and Log tabs update for them after they refresh the page or sign in again.
        </p>
      )}

      {permissions.saveError && (
        <p className="text-sm text-[var(--color-error)]">{permissions.saveError}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-[var(--color-outline)]">
            <tr>
              <th className="px-4 py-3 font-black">Resource</th>
              <th className="px-4 py-3 text-center font-black">Visible</th>
              {PERMISSION_ACTIONS.map(([, , label]) => (
                <th key={label} className="px-4 py-3 text-center font-black">{label}</th>
              ))}
              <th className="px-4 py-3 font-black" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-outline-variant)]">
            {PERMISSION_CATEGORIES.map((category) => (
              <Fragment key={category.label}>
                <tr key={`cat-${category.label}`} className="bg-[var(--color-surface-container-high)]">
                  <td colSpan={PERMISSION_ACTIONS.length + 3} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">
                    {category.label}
                  </td>
                </tr>
                {category.resources.map((resource) => {
                  const hidden = shouldDimCrud(permissions.resolvedMap, resource);
                  const warn = hasMisconfiguration(permissions.resolvedMap, resource);
                  return (
                    <tr
                      key={resource}
                      className={warn ? 'border-l-2 border-l-[var(--color-primary-container)]' : undefined}
                      title={warn ? 'Tab will show but user cannot view data' : undefined}
                    >
                      <td className="px-4 py-3 font-bold text-[var(--color-on-surface)]">
                        <span className="inline-flex items-center gap-2">
                          {warn && (
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-container)]"
                              title="Tab will show but user cannot view data"
                              aria-label="Tab will show but user cannot view data"
                            />
                          )}
                          {resource}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PermissionCheckbox
                          cell={permissions.resolvedMap[resource]?.visible ?? { state: 'inherited', value: true }}
                          onToggle={() => permissions.toggleOverride(resource, 'visible')}
                        />
                      </td>
                      {PERMISSION_ACTIONS.map(([, action]) => (
                        <td key={action} className="px-4 py-3 text-center">
                          <PermissionCheckbox
                            cell={permissions.resolvedMap[resource]?.[action] ?? { state: 'inherited', value: false }}
                            onToggle={() => permissions.toggleOverride(resource, action)}
                            dimmed={hidden}
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
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={!permissions.isDirty || permissions.saving}
            onClick={() => permissions.discardDraft()}
            className="rounded-lg border border-[var(--color-outline-variant)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={!permissions.isDirty || permissions.saving}
            onClick={() => permissions.saveAll()}
            className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-40"
          >
            {permissions.saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {confirmResetAll && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
            <h3 className="text-lg font-black text-[var(--color-on-surface)]">Reset to role defaults?</h3>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              This will remove all custom permissions for this user, including visibility overrides.
              They will revert to their role defaults.
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
