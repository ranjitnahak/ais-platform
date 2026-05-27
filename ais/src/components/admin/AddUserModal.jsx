import ImageCropModal from '../athletes/ImageCropModal';
import { BLOOD_GROUP_OPTIONS } from '../../lib/athleteProfileFields';
import { useAddUser } from '../../hooks/useAddUser';

const STAFF_ROLES = [
  'S&C Coach',
  'Physiotherapist',
  'Head Coach',
  'Analyst',
  'Nutritionist',
  'Manager',
  'Admin',
];

const inputClass =
  'w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none';
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]';

function TeamChecklist({ teams, selectedTeamIds, onToggle }) {
  if (!teams.length) return null;
  return (
    <div>
      <p className={labelClass}>Team assignment</p>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-outline-variant)] divide-y divide-[var(--color-outline-variant)]">
        {teams.map((team) => {
          const checked = selectedTeamIds.includes(team.id);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onToggle(team.id)}
              className="flex w-full items-center gap-3 bg-[var(--color-surface-container-high)] px-3 py-2.5 text-left hover:bg-[var(--color-surface-bright)]"
            >
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                  checked
                    ? 'border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/15'
                    : 'border-[var(--color-outline-variant)]'
                }`}
              >
                {checked && <span className="text-[10px] font-black text-[var(--color-primary-container)]">✓</span>}
              </span>
              <span className="flex-1 text-sm text-[var(--color-on-surface)]">{team.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoUpload({ preview, onPick }) {
  return (
    <div className="flex justify-center pb-2">
      <button
        type="button"
        onClick={onPick}
        className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)]"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-3xl text-[var(--color-outline)]">photo_camera</span>
        )}
      </button>
    </div>
  );
}

export default function AddUserModal({ onClose, onCreated }) {
  const hook = useAddUser({ onSuccess: onCreated, onClose });

  return (
    <>
      {hook.pendingFile && (
        <ImageCropModal file={hook.pendingFile} onCancel={hook.handleCropCancel} onCrop={hook.handleCropDone} />
      )}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-surface-container-lowest)]/90 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] shadow-2xl">
          <div className="flex items-start justify-between border-b border-[var(--color-outline-variant)] p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-container)]">Admin</p>
              <h2 className="mt-1 text-xl font-black text-[var(--color-on-surface)]">Add User</h2>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-outline)] hover:text-[var(--color-on-surface)]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex gap-1 border-b border-[var(--color-outline-variant)] p-2">
            {['athlete', 'staff'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => hook.setPath(tab)}
                className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest ${
                  hook.path === tab
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-on-surface-variant)]'
                }`}
              >
                {tab === 'athlete' ? 'Athlete' : 'Staff'}
              </button>
            ))}
          </div>

          <form onSubmit={hook.handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
            <PhotoUpload
              preview={hook.photoPreview}
              onPick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/webp';
                input.onchange = (e) => {
                  const file = e.target.files?.[0];
                  if (file) hook.handlePhotoChange(file);
                };
                input.click();
              }}
            />

            {hook.path === 'athlete' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First name *</label>
                    <input className={inputClass} value={hook.athleteForm.first_name} onChange={(e) => hook.setAthleteField('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Last name</label>
                    <input className={inputClass} value={hook.athleteForm.last_name} onChange={(e) => hook.setAthleteField('last_name', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Date of birth *</label>
                  <input type="date" required className={inputClass} value={hook.athleteForm.date_of_birth} onChange={(e) => hook.setAthleteField('date_of_birth', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Gender *</label>
                    <select className={inputClass} value={hook.athleteForm.gender} onChange={(e) => hook.setAthleteField('gender', e.target.value)}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Position *</label>
                    <select className={inputClass} value={hook.athleteForm.position} onChange={(e) => hook.setAthleteField('position', e.target.value)}>
                      <option value="">Select</option>
                      <option value="raider">Raider</option>
                      <option value="defender">Defender</option>
                      <option value="all_rounder">All-Rounder</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Jersey number</label>
                  <input type="number" className={inputClass} value={hook.athleteForm.jersey_number} onChange={(e) => hook.setAthleteField('jersey_number', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" required className={inputClass} value={hook.athleteForm.email} onChange={(e) => hook.setAthleteField('email', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input className={inputClass} value={hook.athleteForm.phone} onChange={(e) => hook.setAthleteField('phone', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Emergency contact</label>
                  <input className={inputClass} value={hook.athleteForm.emergency_contact_phone} onChange={(e) => hook.setAthleteField('emergency_contact_phone', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Blood group</label>
                  <select className={inputClass} value={hook.athleteForm.blood_group} onChange={(e) => hook.setAthleteField('blood_group', e.target.value)}>
                    {BLOOD_GROUP_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <textarea className={`${inputClass} min-h-[72px]`} value={hook.athleteForm.address} onChange={(e) => hook.setAthleteField('address', e.target.value)} rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First name *</label>
                    <input className={inputClass} value={hook.staffForm.first_name} onChange={(e) => hook.setStaffField('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Last name</label>
                    <input className={inputClass} value={hook.staffForm.last_name} onChange={(e) => hook.setStaffField('last_name', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" className={inputClass} value={hook.staffForm.email} onChange={(e) => hook.setStaffField('email', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input className={inputClass} value={hook.staffForm.phone} onChange={(e) => hook.setStaffField('phone', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Title</label>
                  <input className={inputClass} placeholder="e.g. Lead Strength Coach" value={hook.staffForm.title} onChange={(e) => hook.setStaffField('title', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Role *</label>
                  <select className={inputClass} value={hook.staffForm.roleLabel} onChange={(e) => hook.setStaffField('roleLabel', e.target.value)}>
                    <option value="">Select role</option>
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}

            <TeamChecklist teams={hook.teams} selectedTeamIds={hook.selectedTeamIds} onToggle={hook.toggleTeam} />

            {hook.error && <p className="text-sm text-[var(--color-error)]">{hook.error}</p>}
            {hook.successMessage && <p className="text-sm text-[var(--color-tertiary-fixed-dim)]">{hook.successMessage}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--color-outline-variant)] py-2.5 text-xs font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={hook.saving}
                className="flex-[2] rounded-lg bg-[var(--color-primary-container)] py-2.5 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
              >
                {hook.saving ? 'Saving…' : hook.path === 'athlete' ? 'Add Athlete' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
