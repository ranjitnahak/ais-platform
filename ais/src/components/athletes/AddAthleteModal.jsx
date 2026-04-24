import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { canonicalFullName } from '../../lib/athleteName';
import { BLOOD_GROUP_OPTIONS, normalizeGenderForDb, normalizePositionForDb } from '../../lib/athleteProfileFields';
import ImageCropModal from './ImageCropModal';

const ORG_ID = 'a1000000-0000-0000-0000-000000000001';

const FIELD = {
  label: (l) => ({ fontSize: '9px', fontWeight: 700, color: '#a78b7d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }),
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#1b1b1d',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e4e2e4',
    fontSize: '13px',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#1b1b1d',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e4e2e4',
    fontSize: '13px',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'none',
  },
};

export default function AddAthleteModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    position: '',
    jersey_number: '',
    email: '',
    phone: '',
    emergency_contact_phone: '',
    blood_group: '',
    address: '',
  });
  const [pendingFile, setPendingFile]   = useState(null);   // raw file → triggers crop modal
  const [photoBlob, setPhotoBlob]       = useState(null);   // cropped JPEG blob to upload
  const [photoName, setPhotoName]       = useState('');     // sanitized original filename
  const [photoPreview, setPhotoPreview] = useState(null);   // object URL for avatar preview
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [teams, setTeams]               = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const fileInputRef                    = useRef(null);

  useEffect(() => {
    async function loadTeams() {
      const user = getCurrentUser()
      const { data } = await supabase
        .from('teams')
        .select('id, name, sport, gender')
        .eq('org_id', user.orgId)
        .order('name')
      if (data) setTeams(data)
    }
    loadTeams()
  }, [])

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';  // reset so re-selecting the same file still fires onChange
    setPendingFile(file);
  }

  function handleCropDone(blob) {
    const sanitizedName = pendingFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    setPhotoBlob(blob);
    setPhotoName(sanitizedName);
    setPhotoPreview(URL.createObjectURL(blob));
    setPendingFile(null);
  }

  function handleCropCancel() {
    setPendingFile(null);
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.first_name.trim()) { setError('First name is required.'); return; }
    if (!form.gender)           { setError('Gender is required.'); return; }
    if (!form.position)         { setError('Position is required.'); return; }

    setSaving(true);
    setError(null);

    let photo_url = null;
    if (photoBlob) {
      const path = `${Date.now()}-${photoName}`;
      const { error: uploadErr } = await supabase.storage
        .from('Athletes')
        .upload(path, photoBlob, { contentType: 'image/jpeg' });
      if (uploadErr) { setSaving(false); setError(uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from('Athletes').getPublicUrl(path);
      photo_url = urlData?.publicUrl ?? null;
    }

    const first_name = form.first_name.trim();
    const last_name = form.last_name.trim();
    const full_name = canonicalFullName(first_name, last_name);

    const payload = {
      first_name,
      last_name: last_name || null,
      full_name,
      date_of_birth:  form.date_of_birth || null,
      gender:         normalizeGenderForDb(form.gender),
      position:       normalizePositionForDb(form.position),
      jersey_number:  form.jersey_number ? Number(form.jersey_number) : null,
      email:          form.email.trim() || null,
      phone:          form.phone.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
      blood_group:             form.blood_group?.trim() || null,
      address:                 form.address?.trim() || null,
      org_id:         ORG_ID,
      is_active:      true,
      ...(photo_url ? { photo_url } : {}),
    };

    const { data: athleteData, error: err } = await supabase.from('athletes').insert(payload).select('id').single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    const newAthleteId = athleteData.id;

    if (selectedTeamIds.length > 0) {
      const teamRows = selectedTeamIds.map(teamId => ({
        athlete_id: newAthleteId,
        team_id: teamId,
      }))
      const { error: teamErr } = await supabase
        .from('athlete_teams')
        .insert(teamRows)
      if (teamErr) console.error('[AddAthleteModal] team assignment failed:', teamErr)
      // Do not block success — athlete was created even if assignment fails
    }

    onSuccess();
  }

  return (
    <>
    {pendingFile && (
      <ImageCropModal
        file={pendingFile}
        onCancel={handleCropCancel}
        onCrop={handleCropDone}
      />
    )}
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#1b1b1d',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#a78b7d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Roster
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
              Add Athlete
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Photo Upload */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                backgroundColor: '#2a2a2c',
                border: '2px dashed rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', padding: 0, position: 'relative',
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#6b7280' }}>photo_camera</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Photo</span>
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          {/* First + Last name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={FIELD.label()}>First Name *</div>
              <input
                style={FIELD.input}
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="e.g. Arjun"
              />
            </div>
            <div>
              <div style={FIELD.label()}>Last Name</div>
              <input
                style={FIELD.input}
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="e.g. Sharma"
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <div style={FIELD.label()}>Date of Birth</div>
            <input
              type="date"
              style={{ ...FIELD.input, colorScheme: 'dark' }}
              value={form.date_of_birth}
              onChange={(e) => set('date_of_birth', e.target.value)}
            />
          </div>

          {/* Gender + Position row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={FIELD.label()}>Gender *</div>
              <select style={FIELD.select} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <div style={FIELD.label()}>Position *</div>
              <select style={FIELD.select} value={form.position} onChange={(e) => set('position', e.target.value)}>
                <option value="">Select</option>
                <option value="raider">Raider</option>
                <option value="defender">Defender</option>
                <option value="all_rounder">All-Rounder</option>
              </select>
            </div>
          </div>

          {/* Jersey Number */}
          <div>
            <div style={FIELD.label()}>Jersey Number</div>
            <input
              type="number"
              style={FIELD.input}
              value={form.jersey_number}
              onChange={(e) => set('jersey_number', e.target.value)}
              placeholder="e.g. 7"
              min="1"
              max="99"
            />
          </div>

          {/* Email */}
          <div>
            <div style={FIELD.label()}>Email</div>
            <input
              type="email"
              style={FIELD.input}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="athlete@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <div style={FIELD.label()}>Phone</div>
            <input
              type="tel"
              style={FIELD.input}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <div style={FIELD.label()}>Emergency contact number</div>
            <input
              type="tel"
              style={FIELD.input}
              value={form.emergency_contact_phone}
              onChange={(e) => set('emergency_contact_phone', e.target.value)}
              placeholder="Next of kin / doctor"
            />
          </div>

          <div>
            <div style={FIELD.label()}>Blood group</div>
            <select style={FIELD.select} value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)}>
              {BLOOD_GROUP_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={FIELD.label()}>Address</div>
            <textarea
              style={{ ...FIELD.input, minHeight: '88px', resize: 'vertical' }}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Street, city, postal code…"
              rows={3}
            />
          </div>

          {/* Team Assignment */}
          {teams.length > 0 && (
            <div>
              <div style={FIELD.label()}>Assign to teams</div>
              <div className="mt-2 rounded-lg overflow-hidden divide-y divide-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {teams.map(team => {
                  const isSelected = selectedTeamIds.includes(team.id)
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamIds(prev =>
                        isSelected ? prev.filter(id => id !== team.id) : [...prev, team.id]
                      )}
                      className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#2a2a2c] hover:bg-[#39393b] transition-colors text-left"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        isSelected
                          ? 'bg-[#F97316]/15 border-[#F97316]'
                          : 'border-white/20 bg-transparent'
                      }`}>
                        {isSelected && (
                          <span className="text-[#F97316] text-[10px] font-black leading-none">✓</span>
                        )}
                      </div>
                      <span className="text-white text-sm flex-1">{team.name}</span>
                      <span className="text-[10px] text-gray-500">
                        {[team.sport, team.gender].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">
                Athletes can belong to multiple teams simultaneously
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ backgroundColor: 'rgba(147,0,10,0.15)', border: '1px solid rgba(147,0,10,0.4)', borderRadius: '8px', padding: '10px 14px', color: '#EF4444', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '12px',
                backgroundColor: '#353437',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#e4e2e4',
                fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2, padding: '12px',
                background: saving ? '#555' : 'linear-gradient(135deg, #FFB690, #F97316)',
                border: 'none',
                borderRadius: '8px',
                color: '#552100',
                fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {saving ? 'Saving…' : 'Add Athlete'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
