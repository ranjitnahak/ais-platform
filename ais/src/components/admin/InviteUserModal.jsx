import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const EMPTY_FORM = { fullName: '', email: '', roleId: '', teamIds: [] };

const ROLE_NAME_TO_ENUM = {
  Superuser: 'superuser',
  Admin: 'admin',
  'S&C Coach': 'sc_coach',
  Physio: 'physio',
  'Head Coach': 'head_coach',
  Analyst: 'analyst',
  Nutritionist: 'analyst', // closest match
  Athlete: 'athlete',
};

export default function InviteUserModal({ user, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.orgId) return;
    let mounted = true;
    async function loadOptions() {
      try {
        const [{ data: roleRows, error: roleError }, { data: teamRows, error: teamError }] = await Promise.all([
          supabase.from('roles').select('id, name').eq('org_id', user.orgId).order('name'),
          supabase.from('teams').select('id, name').eq('org_id', user.orgId).order('name'),
        ]);
        if (roleError) throw roleError;
        if (teamError) throw teamError;
        if (!mounted) return;
        setRoles(roleRows ?? []);
        setTeams(teamRows ?? []);
      } catch (err) {
        console.error('[InviteUserModal] options failed:', err);
        if (mounted) setError('Could not load roles or teams.');
      }
    }
    void loadOptions();
    return () => { mounted = false; };
  }, [user?.orgId]);

  function toggleTeam(teamId) {
    setForm((current) => ({
      ...current,
      teamIds: current.teamIds.includes(teamId)
        ? current.teamIds.filter((id) => id !== teamId)
        : [...current.teamIds, teamId],
    }));
  }

  async function handleSubmit() {
    if (!user?.orgId || !form.fullName.trim() || !form.email.trim() || !form.roleId) {
      setError('Full name, email, and role are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const selectedRole = roles.find((role) => role.id === form.roleId);
      const selectedRoleName = selectedRole?.name;
      const roleEnum = ROLE_NAME_TO_ENUM[selectedRoleName] ?? 'sc_coach';
      const emailValue = form.email.trim();
      const fullNameValue = form.fullName.trim();
      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: emailValue,
          fullName: fullNameValue,
          orgId: user.orgId,
          roleEnum,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);
      const newUserId = fnData.userId;

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ org_id: user.orgId, user_id: newUserId, role_id: form.roleId });
      if (roleError) throw roleError;

      setMessage('User created. Share the login link with them to set their password.');
      setForm(EMPTY_FORM);
      await onCreated?.();
      window.setTimeout(onClose, 1200);
    } catch (err) {
      console.error('[InviteUserModal] create failed:', err);
      setError('Could not create user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--color-on-surface)]">Invite User</h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">Create a pending user profile for this org.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-outline)] hover:text-[var(--color-on-surface)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <input
            value={form.fullName}
            onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
            placeholder="Full Name"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            placeholder="Email"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
          />
          <select
            value={form.roleId}
            onChange={(e) => setForm((current) => ({ ...current, roleId: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none"
          >
            <option value="">Select role</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Teams</p>
            <div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg border border-[var(--color-outline-variant)] p-3">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)]">
                  <input type="checkbox" checked={form.teamIds.includes(team.id)} onChange={() => toggleTeam(team.id)} />
                  {team.name}
                </label>
              ))}
              {!teams.length && <p className="text-sm text-[var(--color-outline)]">No teams found.</p>}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>}
        {message && <p className="mt-4 text-sm text-[var(--color-tertiary-fixed-dim)]">{message}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
