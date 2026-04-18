import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ImageCropModal from '../components/athletes/ImageCropModal';
import Sidebar from '../components/Sidebar';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTier(tier) {
  if (!tier) return null;
  const known = { excellent: 'Excellent', above_average: 'Above Average', average: 'Average', below_average: 'Below Average' };
  return known[String(tier).toLowerCase()] ?? tier;
}

function formatDate(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

const CLASS_STYLE = {
  'Excellent':     { badge: 'bg-[#22C55E]/10 text-[#22C55E]', bar: '#22C55E' },
  'Above Average': { badge: 'bg-[#3B82F6]/10 text-[#3B82F6]', bar: '#3B82F6' },
  'Average':       { badge: 'bg-[#F97316]/10 text-[#F97316]', bar: '#F97316' },
  'Below Average': { badge: 'bg-[#EF4444]/10 text-[#EF4444]', bar: '#EF4444' },
};

const TIER_BAR = { 'Excellent': '100%', 'Above Average': '75%', 'Average': '50%', 'Below Average': '25%' };

const FIELD_STYLE = {
  label: 'block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5',
  input: 'w-full px-3 py-2.5 bg-[#2a2a2c] text-[#e4e2e4] text-sm rounded-lg outline-none focus:ring-1 focus:ring-[#F97316]/50',
  select: 'w-full px-3 py-2.5 bg-[#2a2a2c] text-[#e4e2e4] text-sm rounded-lg outline-none focus:ring-1 focus:ring-[#F97316]/50 appearance-none',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AthleteProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [athlete, setAthlete]         = useState(null);
  const [form, setForm]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null);
  const [scores, setScores]           = useState([]);
  const [sessionDate, setSessionDate] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);     // raw file → triggers crop modal

  useEffect(() => { loadAthlete(); }, [id]);

  async function loadAthlete() {
    setLoading(true);
    const { data, error } = await supabase
      .from('athletes')
      .select('id, full_name, date_of_birth, gender, position, photo_url, org_id, is_active, jersey_number, email, phone, organisations(name, sport, logo_url)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setAthlete(data);
      setForm({
        full_name:     data.full_name ?? '',
        date_of_birth: data.date_of_birth ?? '',
        gender:        data.gender ?? '',
        position:      data.position ?? '',
        jersey_number: data.jersey_number ?? '',
        email:         data.email ?? '',
        phone:         data.phone ?? '',
      });
      await loadLatestScores(data.id, data.gender);
    }
    setLoading(false);
  }

  async function loadLatestScores(athleteId, gender) {
    // Latest session containing this athlete
    const { data: links } = await supabase
      .from('assessment_results')
      .select('session_id')
      .eq('athlete_id', athleteId);

    const sessionIds = [...new Set((links ?? []).map((r) => r.session_id))];
    if (!sessionIds.length) return;

    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, assessed_on, name')
      .in('id', sessionIds)
      .order('assessed_on', { ascending: false })
      .limit(1);

    if (!sessions?.length) return;
    const session = sessions[0];
    setSessionDate(session);

    const { data: results } = await supabase
      .from('assessment_results')
      .select('test_id, value, classification, percentile_rank, test_definitions(name, unit, direction)')
      .eq('athlete_id', athleteId)
      .eq('session_id', session.id);

    setScores(
      (results ?? [])
        .filter((r) => r.test_definitions)
        .map((r) => ({
          name:           r.test_definitions.name,
          unit:           r.test_definitions.unit ?? '',
          value:          r.value,
          classification: formatTier(r.classification),
          percentile:     r.percentile_rank,
        }))
    );
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from('athletes')
      .update({
        full_name:     form.full_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender:        form.gender || null,
        position:      form.position || null,
        jersey_number: form.jersey_number !== '' ? Number(form.jersey_number) : null,
        email:         form.email.trim() || null,
        phone:         form.phone.trim() || null,
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      setSaveMsg({ type: 'error', text: error.message });
    } else {
      setSaveMsg({ type: 'success', text: 'Profile saved.' });
      setAthlete((a) => ({ ...a, ...form }));
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPendingFile(file);
  }

  async function handleCropDone(blob) {
    setPendingFile(null);
    setUploading(true);
    setSaveMsg(null);

    const sanitizedName = pendingFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `${id}/${Date.now()}-${sanitizedName}`;

    const { error: uploadErr } = await supabase.storage
      .from('Athletes')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadErr) {
      setSaveMsg({ type: 'error', text: uploadErr.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('Athletes').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;

    const { error: updateErr } = await supabase
      .from('athletes')
      .update({ photo_url: publicUrl })
      .eq('id', id);

    if (updateErr) {
      setSaveMsg({ type: 'error', text: updateErr.message });
    } else {
      setAthlete((a) => ({ ...a, photo_url: publicUrl }));
      setSaveMsg({ type: 'success', text: 'Photo updated.' });
      setTimeout(() => setSaveMsg(null), 3000);
    }
    setUploading(false);
  }

  if (loading) {
    return (
      <div className="bg-[#131315] min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-[#F97316] animate-spin text-4xl">refresh</span>
      </div>
    );
  }

  if (!athlete || !form) {
    return (
      <div className="bg-[#131315] min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Athlete not found.
      </div>
    );
  }

  const initials = athlete.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <>
    {pendingFile && (
      <ImageCropModal
        file={pendingFile}
        onCancel={() => setPendingFile(null)}
        onCrop={handleCropDone}
      />
    )}
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">

      <Sidebar />

      {/* Top bar */}
      <header className="fixed top-0 w-full z-40 bg-[#131315]/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/athletes')}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Athletes
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#353437] flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="material-symbols-outlined text-sm text-gray-400">person</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 pb-32 px-6 md:pl-72 max-w-4xl mx-auto space-y-8">

        {/* ── Photo + name banner ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backgroundColor: '#1b1b1d' }}>
          <div className="flex flex-col items-center gap-3 shrink-0">
            {athlete.photo_url ? (
              <img
                src={athlete.photo_url}
                alt={athlete.full_name}
                className="rounded-full object-cover"
                style={{ width: 100, height: 100, border: '3px solid #F97316' }}
              />
            ) : (
              <div className="rounded-full bg-[#353437] flex items-center justify-center text-3xl font-black text-white"
                style={{ width: 100, height: 100, border: '3px solid rgba(255,255,255,0.08)' }}>
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">upload</span>
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
              {athlete.organisations?.name ?? 'Athlete'}
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-white uppercase leading-none">
              {athlete.full_name}
            </h2>
            <p className="text-sm text-gray-500 mt-2 uppercase font-bold tracking-tight">
              {[athlete.position, athlete.gender].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Save message */}
        {saveMsg && (
          <div className={`p-3 rounded-lg text-sm font-bold ${
            saveMsg.type === 'success'
              ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
              : 'bg-[#93000a]/20 text-[#EF4444] border border-[#93000a]/40'
          }`}>
            {saveMsg.text}
          </div>
        )}

        {/* ── Edit form ── */}
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backgroundColor: '#1b1b1d' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6">Profile Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className={FIELD_STYLE.label}>Full Name</label>
              <input
                className={FIELD_STYLE.input}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className={FIELD_STYLE.label}>Date of Birth</label>
              <input
                type="date"
                className={FIELD_STYLE.input}
                style={{ border: '1px solid rgba(255,255,255,0.06)', colorScheme: 'dark' }}
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
            </div>

            {/* Jersey Number */}
            <div>
              <label className={FIELD_STYLE.label}>Jersey Number</label>
              <input
                type="number"
                className={FIELD_STYLE.input}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.jersey_number}
                onChange={(e) => setField('jersey_number', e.target.value)}
                min="1" max="99"
              />
            </div>

            {/* Gender */}
            <div>
              <label className={FIELD_STYLE.label}>Gender</label>
              <select
                className={FIELD_STYLE.select}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.gender}
                onChange={(e) => setField('gender', e.target.value)}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Position */}
            <div>
              <label className={FIELD_STYLE.label}>Position</label>
              <select
                className={FIELD_STYLE.select}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.position}
                onChange={(e) => setField('position', e.target.value)}
              >
                <option value="">Select</option>
                <option value="Raider">Raider</option>
                <option value="Defender">Defender</option>
                <option value="All-Rounder">All-Rounder</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className={FIELD_STYLE.label}>Email</label>
              <input
                type="email"
                className={FIELD_STYLE.input}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="athlete@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className={FIELD_STYLE.label}>Phone</label>
              <input
                type="tel"
                className={FIELD_STYLE.input}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] text-[#552100] active:scale-95 transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FFB690, #F97316)' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── Latest Assessment Scores ── */}
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backgroundColor: '#1b1b1d' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Latest Assessment</h3>
            {sessionDate && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                {sessionDate.name ?? ''} · {formatDate(sessionDate.assessed_on)}
              </span>
            )}
          </div>

          {scores.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">No assessment data available.</p>
          ) : (
            <div className="space-y-3">
              {scores.map((s, i) => {
                const cs = CLASS_STYLE[s.classification] ?? { badge: 'bg-white/5 text-gray-400', bar: '#374151' };
                const barW = TIER_BAR[s.classification] ?? '4%';
                return (
                  <div key={i} className="flex items-center gap-4">
                    {/* Test name */}
                    <div className="w-40 shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-gray-400 truncate">{s.name}</p>
                    </div>
                    {/* Score */}
                    <div className="w-20 shrink-0 text-right">
                      <span className="text-sm font-black text-white">{s.value ?? '—'}</span>
                      {s.unit && <span className="text-[10px] text-gray-500 ml-1">{s.unit}</span>}
                    </div>
                    {/* Bar */}
                    <div className="flex-1">
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: barW, backgroundColor: cs.bar }} />
                      </div>
                    </div>
                    {/* Badge */}
                    {s.classification && (
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cs.badge}`}>
                        {s.classification}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-[#2A2A2C]/80 backdrop-blur-2xl border-t border-white/10 z-50 rounded-t-2xl">
        {[
          { icon: 'dashboard', label: 'Home',     to: '/'        },
          { icon: 'person',    label: 'Athletes',  to: '/athletes'},
          { icon: 'edit_note', label: 'Reports',  to: '/reports' },
          { icon: 'settings',  label: 'Settings', to: '/settings'},
        ].map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-2 transition-transform ${isActive ? 'text-[#F97316] scale-110' : 'text-gray-500 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
                <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
    </>
  );
}
