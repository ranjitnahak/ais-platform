import { useState } from 'react';
import { STAFF_ROLES } from './UserProfileTab';

export default function UserDangerZone({ profile, onRoleChanged }) {
  const { isStaff, isAthlete, isActive, deactivateUser, reactivateUser, changeRole, staffForm } = profile;
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [confirmRole, setConfirmRole] = useState(false);
  const [nextRole, setNextRole] = useState(staffForm.roleLabel || '');
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function handleDeactivate() {
    setWorking(true);
    setActionError(null);
    try {
      await deactivateUser();
      setConfirmDeactivate(false);
    } catch (err) {
      setActionError(err.message || 'Could not deactivate user.');
    } finally {
      setWorking(false);
    }
  }

  async function handleChangeRole() {
    if (!nextRole || nextRole === staffForm.roleLabel) {
      setConfirmRole(false);
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await changeRole(nextRole);
      await onRoleChanged?.();
      setConfirmRole(false);
    } catch (err) {
      setActionError(err.message || 'Could not change role.');
    } finally {
      setWorking(false);
    }
  }

  async function handleReactivate() {
    setWorking(true);
    setActionError(null);
    try {
      await reactivateUser();
      setConfirmReactivate(false);
    } catch (err) {
      setActionError(err.message || 'Could not reactivate user.');
    } finally {
      setWorking(false);
    }
  }

  const offboardCopy = isAthlete
    ? 'They will be removed from all teams, lose app access, and disappear from operational dashboards. Historical data is preserved. Re-assign them to a team after reactivating.'
    : 'They will lose access immediately. You can reactivate them from the users list.';

  return (
    <div className="mt-6 border-t border-[var(--color-outline-variant)] pt-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-error)]">Danger Zone</p>
      <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
        Destructive or significant actions require confirmation.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!isActive || working}
          onClick={() => setConfirmDeactivate(true)}
          className="rounded-lg border border-[var(--color-error)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-error)] disabled:opacity-40"
        >
          {isAthlete ? 'Offboard Athlete' : 'Deactivate User'}
        </button>
        {!isActive && (
          <button
            type="button"
            disabled={working}
            onClick={() => setConfirmReactivate(true)}
            className="rounded-lg border border-[var(--color-tertiary-fixed-dim)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-tertiary-fixed-dim)] disabled:opacity-40"
          >
            Reactivate
          </button>
        )}
        {isStaff && (
          <button
            type="button"
            disabled={working}
            onClick={() => {
              setNextRole(staffForm.roleLabel || '');
              setConfirmRole(true);
            }}
            className="rounded-lg border border-[var(--color-outline-variant)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] disabled:opacity-40"
          >
            Change Role
          </button>
        )}
      </div>

      {actionError && <p className="mt-3 text-sm text-[var(--color-error)]">{actionError}</p>}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
            <h3 className="text-lg font-black text-[var(--color-on-surface)]">
              {isAthlete ? 'Offboard this athlete?' : 'Deactivate this user?'}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              {offboardCopy}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDeactivate(false)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
              <button
                type="button"
                disabled={working}
                onClick={() => void handleDeactivate()}
                className="rounded-lg bg-[var(--color-error)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-error)] disabled:opacity-50"
              >
                {working ? 'Working…' : (isAthlete ? 'Offboard' : 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReactivate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
            <h3 className="text-lg font-black text-[var(--color-on-surface)]">Reactivate this user?</h3>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              {isAthlete
                ? 'Account access will be restored. Re-assign them to a team to show them in Wellness, RPE, and Assessment views again.'
                : 'They will regain access immediately.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmReactivate(false)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
              <button
                type="button"
                disabled={working}
                onClick={() => void handleReactivate()}
                className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
              >
                {working ? 'Working…' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRole && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
            <h3 className="text-lg font-black text-[var(--color-on-surface)]">Change role?</h3>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              This updates the user&apos;s role and their default permissions.
            </p>
            <select
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value)}
              className="mt-4 w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
            >
              <option value="">Select role</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmRole(false)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
              <button
                type="button"
                disabled={working || !nextRole}
                onClick={() => void handleChangeRole()}
                className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
              >
                {working ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
