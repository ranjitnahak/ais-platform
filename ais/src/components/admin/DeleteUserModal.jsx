import { useEffect, useState } from 'react';
import { userHasOperationalData, deleteUser } from '../../lib/adminUserActions';

export default function DeleteUserModal({ target, orgId, onClose, onDeleted }) {
  const [hasData, setHasData] = useState(false);
  const [checking, setChecking] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const result = await userHasOperationalData(orgId, target.email);
        if (mounted) setHasData(result);
      } catch (err) {
        console.error('[DeleteUserModal] check', err);
      } finally {
        if (mounted) setChecking(false);
      }
    }
    void check();
    return () => { mounted = false; };
  }, [orgId, target.email]);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteUser(orgId, target.id);
      await onDeleted?.();
      onClose();
    } catch (err) {
      console.error('[DeleteUserModal] delete', err);
      setError('Could not delete user.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6">
        <h3 className="text-lg font-black text-[var(--color-on-surface)]">Delete user?</h3>
        <p className="mt-2 text-sm font-bold text-[var(--color-on-surface)]">{target.full_name || target.email}</p>
        {checking ? (
          <p className="mt-4 text-sm text-[var(--color-outline)]">Checking linked data…</p>
        ) : hasData ? (
          <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">
            This user has existing data. Deactivating is recommended to preserve data integrity. Are you sure you want to permanently delete?
          </p>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">Are you sure? This cannot be undone.</p>
        )}
        {error && <p className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
          <button
            type="button"
            disabled={deleting || checking}
            onClick={confirmDelete}
            className="rounded-lg bg-[var(--color-error-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-error-container)] disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
