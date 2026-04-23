import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';

function AthleteInitials({ athlete, size = 28 }) {
  const initials = athleteInitialsFromAthlete(athlete);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: '#353437',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.3) + 'px', fontWeight: 900, color: '#e4e2e4',
        border: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export default function TeamDetailModal({ team, onClose, onSaved }) {
  const isEdit = team !== null;

  const [name, setName]                     = useState(team?.name ?? '');
  const [sport, setSport]                   = useState(team?.sport ?? '');
  const [gender, setGender]                 = useState(team?.gender ?? '');
  const [logoFile, setLogoFile]             = useState(null);
  const [logoPreview, setLogoPreview]       = useState(null);
  const [existingLogoUrl]                   = useState(team?.logo_url ?? null);
  const [athletes, setAthletes]             = useState([]);
  const [originalMemberIds, setOriginalMemberIds] = useState(new Set());
  const [memberIds, setMemberIds]           = useState(new Set());
  const [athleteSearch, setAthleteSearch]   = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState(null);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  const logoInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    loadAthletesAndMembers();
  }, []);

  async function loadAthletesAndMembers() {
    setLoadingAthletes(true);
    try {
      const { orgId } = getCurrentUser();

      const { data: athRows, error: athErr } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, full_name, gender, position, photo_url')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('full_name');
      if (athErr) throw athErr;
      setAthletes(athRows ?? []);

      const { data: memberRows, error: memErr } = await supabase
        .from('athlete_teams')
        .select('athlete_id')
        .eq('team_id', team.id);
      if (memErr) throw memErr;

      const ids = new Set((memberRows ?? []).map((r) => r.athlete_id));
      setOriginalMemberIds(new Set(ids));
      setMemberIds(new Set(ids));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAthletes(false);
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function toggleMember(athleteId) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId);
      else next.add(athleteId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      if (!name.trim()) {
        setError('Team name is required');
        setSaving(false);
        return;
      }

      const { orgId } = getCurrentUser();
      let finalLogoUrl = existingLogoUrl;

      if (logoFile) {
        const path = `logos/teams/${orgId}/${Date.now()}-${logoFile.name}`;
        const { error: upErr } = await supabase.storage.from('Logos').upload(path, logoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('Logos').getPublicUrl(path);
        finalLogoUrl = urlData.publicUrl;
      }

      if (!isEdit) {
        const { error: insErr } = await supabase.from('teams').insert({
          org_id: orgId,
          name: name.trim(),
          sport: sport.trim() || null,
          gender: gender || null,
          logo_url: finalLogoUrl,
        });
        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabase
          .from('teams')
          .update({
            name: name.trim(),
            sport: sport.trim() || null,
            gender: gender || null,
            logo_url: finalLogoUrl,
          })
          .eq('id', team.id);
        if (updErr) throw updErr;

        const added   = [...memberIds].filter((id) => !originalMemberIds.has(id));
        const removed = [...originalMemberIds].filter((id) => !memberIds.has(id));

        if (added.length > 0) {
          const { error: addErr } = await supabase
            .from('athlete_teams')
            .insert(added.map((athleteId) => ({ athlete_id: athleteId, team_id: team.id })));
          if (addErr) throw addErr;
        }

        if (removed.length > 0) {
          const { error: delErr } = await supabase
            .from('athlete_teams')
            .delete()
            .eq('team_id', team.id)
            .in('athlete_id', removed);
          if (delErr) throw delErr;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const displayLogo = logoPreview || existingLogoUrl;

  const filteredAthletes = athletes.filter((a) =>
    athleteDisplayName(a).toLowerCase().includes(athleteSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1c] rounded-2xl border border-white/[0.08] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-white font-bold text-base">
            {isEdit ? team.name : 'Create team'}
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Section A — Logo + basic info */}
          <div className="flex gap-4 items-start">

            {/* Logo zone */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div
                className="w-16 h-16 rounded-xl cursor-pointer overflow-hidden relative group"
                style={!displayLogo ? {
                  border: '2px dashed rgba(249,115,22,0.3)',
                  background: 'rgba(249,115,22,0.05)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '4px',
                } : {}}
                onClick={() => logoInputRef.current?.click()}
              >
                {displayLogo ? (
                  <>
                    <img
                      src={displayLogo}
                      alt="Team logo"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold">Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-icons text-[#F97316]/50 text-xl">upload</span>
                    <span className="text-[9px] text-[#F97316]/50 uppercase tracking-widest">Logo</span>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*,image/svg+xml"
                ref={logoInputRef}
                onChange={handleLogoChange}
                className="hidden"
              />
              <span className="text-[9px] text-gray-600">Shown in PDF reports</span>
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                  Team name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Senior Squad"
                  className="w-full bg-[#2a2a2c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#F97316]/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                    Sport
                  </label>
                  <input
                    type="text"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    placeholder="e.g. Kabaddi"
                    className="w-full bg-[#2a2a2c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#F97316]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-[#2a2a2c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]/50 transition-colors"
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Mixed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section B — Athletes (edit mode only) */}
          {isEdit && (
            <div>
              <div className="flex justify-between items-center">
                <span className="text-white text-sm font-bold">
                  Athletes{' '}
                  <span className="text-gray-500 text-xs font-normal">
                    ({memberIds.size} {memberIds.size === 1 ? 'member' : 'members'})
                  </span>
                </span>
              </div>

              <input
                type="text"
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
                placeholder="Search athletes…"
                className="w-full bg-[#2a2a2c] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none mt-2 mb-3"
              />

              <div className="max-h-52 overflow-y-auto space-y-1">
                {loadingAthletes ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-[#F97316] rounded-full animate-spin" />
                  </div>
                ) : athletes.length === 0 ? (
                  <p className="text-gray-500 text-xs px-3 py-4 text-center">
                    No athletes found. Add athletes first.
                  </p>
                ) : filteredAthletes.length === 0 ? (
                  <p className="text-gray-500 text-xs px-3 py-4 text-center">
                    No athletes match your search.
                  </p>
                ) : (
                  filteredAthletes.map((athlete) => {
                    const checked = memberIds.has(athlete.id);
                    return (
                      <div
                        key={athlete.id}
                        onClick={() => toggleMember(athlete.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#2a2a2c] transition-colors"
                      >
                        {/* Checkbox */}
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded"
                          style={{
                            width: 16, height: 16,
                            border: checked ? '2px solid #F97316' : '2px solid rgba(255,255,255,0.2)',
                            background: checked ? 'rgba(249,115,22,0.15)' : 'transparent',
                          }}
                        >
                          {checked && (
                            <span style={{ color: '#F97316', fontSize: '10px', fontWeight: 900, lineHeight: 1 }}>
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        {athlete.photo_url ? (
                          <img
                            src={athlete.photo_url}
                            alt={athleteDisplayName(athlete)}
                            className="rounded-full object-cover flex-shrink-0"
                            style={{ width: 28, height: 28 }}
                          />
                        ) : (
                          <AthleteInitials athlete={athlete} size={28} />
                        )}

                        {/* Name */}
                        <span className="text-white text-sm flex-1 truncate">
                          {athleteDisplayName(athlete)}
                        </span>

                        {/* Position badge */}
                        {athlete.position && (
                          <span className="text-[9px] text-gray-500 bg-[#353437] px-2 py-0.5 rounded text-center flex-shrink-0">
                            {athlete.position}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-[10px] text-gray-600 mt-2">
                Athletes can belong to multiple teams simultaneously
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-[#EF4444] text-xs px-3 py-2 bg-[#EF4444]/10 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 border border-white/10 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#F97316] text-[#552100] font-black text-[10px] uppercase tracking-widest px-5 py-2 rounded-lg disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}
