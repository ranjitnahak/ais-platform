import { BLOOD_GROUP_OPTIONS } from '../../lib/athleteProfileFields';
import TeamChecklist from './TeamChecklist';

const STAFF_ROLES = [
  'S&C Coach',
  'Physiotherapist',
  'Head Coach',
  'Analyst',
  'Nutritionist',
  'Manager',
  'Admin',
];

export const inputClass =
  'w-full rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]';
export const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]';

function PhotoUpload({ preview, onPick, uploading }) {
  return (
    <div className="flex justify-center pb-2">
      <button
        type="button"
        onClick={onPick}
        disabled={uploading}
        className="relative flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] disabled:opacity-50"
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

function AthleteFields({ form, setField }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>First name *</label>
          <input className={inputClass} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input className={inputClass} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Date of birth</label>
        <input type="date" className={inputClass} value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Gender</label>
          <select className={inputClass} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Position</label>
          <select className={inputClass} value={form.position} onChange={(e) => setField('position', e.target.value)}>
            <option value="">Select</option>
            <option value="raider">Raider</option>
            <option value="defender">Defender</option>
            <option value="all_rounder">All-Rounder</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Jersey number</label>
        <input type="number" className={inputClass} value={form.jersey_number} onChange={(e) => setField('jersey_number', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input type="email" className={inputClass} value={form.email} onChange={(e) => setField('email', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Emergency contact</label>
        <input className={inputClass} value={form.emergency_contact_phone} onChange={(e) => setField('emergency_contact_phone', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Blood group</label>
        <select className={inputClass} value={form.blood_group} onChange={(e) => setField('blood_group', e.target.value)}>
          {BLOOD_GROUP_OPTIONS.map((option) => (
            <option key={option.value || 'none'} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <textarea className={`${inputClass} min-h-[72px]`} value={form.address} onChange={(e) => setField('address', e.target.value)} rows={2} />
      </div>
    </>
  );
}

function StaffFields({ form, setField }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>First name *</label>
          <input className={inputClass} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input className={inputClass} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input type="email" className={inputClass} value={form.email} onChange={(e) => setField('email', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <input className={`${inputClass} opacity-70`} value={form.roleLabel || '—'} readOnly />
      </div>
      <div>
        <label className={labelClass}>Department</label>
        <input className={inputClass} placeholder="e.g. Sports Science" value={form.title} onChange={(e) => setField('title', e.target.value)} />
      </div>
    </>
  );
}

export default function UserProfileTab({ profile, onPickPhoto }) {
  const {
    isStaff,
    athleteForm,
    staffForm,
    setAthleteField,
    setStaffField,
    teams,
    selectedTeamIds,
    toggleTeam,
    photoPreview,
    saving,
    saveMsg,
    saveProfile,
  } = profile;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void saveProfile();
      }}
    >
      <PhotoUpload preview={photoPreview} onPick={onPickPhoto} uploading={saving} />
      {isStaff ? (
        <StaffFields form={staffForm} setField={setStaffField} />
      ) : (
        <AthleteFields form={athleteForm} setField={setAthleteField} />
      )}

      <TeamChecklist teams={teams} selectedTeamIds={selectedTeamIds} onToggle={toggleTeam} />

      {saveMsg && (
        <p className={`text-sm ${saveMsg.type === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-tertiary-fixed-dim)]'}`}>
          {saveMsg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[var(--color-primary-container)] py-2.5 text-xs font-black uppercase tracking-widest text-[var(--color-on-primary)] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}

export { STAFF_ROLES };
