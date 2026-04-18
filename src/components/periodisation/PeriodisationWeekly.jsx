import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getCurrentUser, canEditSessionLibrary } from '../../lib/auth';
import { useSessions } from '../../hooks/useSessions';
import { addDays, formatRange, rowMetricKey, weekStartsBetween, computeAcwrSeries, acwrStyle } from '../../lib/periodisationUtils';

const RECOVERY_OPTIONS = ['Ice bath', 'Pool recovery', 'Massage', 'Stretching', 'Other'];

const CAT_STYLES = {
  strength: { bg: '#fef9c3', text: '#713f12', label: 'Strength' },
  speed: { bg: '#dbeafe', text: '#1e40af', label: 'Speed' },
  power: { bg: '#e9d5ff', text: '#5b21b6', label: 'Power' },
  endurance: { bg: '#bbf7d0', text: '#14532d', label: 'Endurance' },
  technical: { bg: '#fce7f3', text: '#9d174d', label: 'Technical' },
  recovery: { bg: '#ccfbf1', text: '#115e59', label: 'Recovery' },
  default: { bg: '#e5e7eb', text: '#374151', label: 'Session' },
};

function normalizeCategory(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('strength')) return 'strength';
  if (s.includes('speed')) return 'speed';
  if (s.includes('power')) return 'power';
  if (s.includes('endurance')) return 'endurance';
  if (s.includes('technical')) return 'technical';
  if (s.includes('recover')) return 'recovery';
  return 'default';
}

function rpeStyle(n) {
  const v = Number(n);
  if (v <= 3) return { bg: '#bbf7d0', text: '#14532d' };
  if (v <= 5) return { bg: '#bbf7d0', text: '#14532d' };
  if (v === 6) return { bg: '#fef9c3', text: '#713f12' };
  if (v === 7) return { bg: '#fbbf24', text: '#78350f' };
  return { bg: '#f97316', text: '#fff' };
}

function slotTimes(slot) {
  return slot === 'am' ? '09:00:00' : '15:00:00';
}

function sessionSlot(s) {
  if (s.session_type === 'am' || s.session_type === 'pm') return s.session_type;
  const t = (s.start_time || '').slice(0, 2);
  return Number(t) < 12 ? 'am' : 'pm';
}

function weekDays(weekStartIso) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStartIso, i);
    const d = new Date(iso + 'T12:00:00');
    const dow = d.getDay();
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.push({
      iso,
      label: names[dow],
      isSunday: dow === 0,
      date: d,
    });
  }
  return days;
}

export default function PeriodisationWeekly({
  team,
  plan,
  weekStartIso,
  weekIndex,
  weekEndIso,
  rows,
  cells,
  teamId,
  onBack,
  onPrev,
  onNext,
}) {
  const user = getCurrentUser();
  const { sessions, loading, upsertSession, fetchSessions } = useSessions(teamId, plan.id, weekStartIso, weekEndIso);
  const [drawer, setDrawer] = useState(null);
  const [libraryItems, setLibraryItems] = useState([]);
  const [planNotes, setPlanNotes] = useState(plan?.notes ?? '');

  const days = useMemo(() => weekDays(weekStartIso), [weekStartIso]);

  useEffect(() => {
    setPlanNotes(plan?.notes ?? '');
  }, [plan?.notes, plan?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('session_library_items')
        .select('*')
        .or(`is_system.eq.true,org_id.eq.${user.orgId}`)
        .order('name');
      setLibraryItems(data ?? []);
    })();
  }, [user.orgId]);

  const phaseRow = rows.find((r) => rowMetricKey(r) === 'phase' || (r.label || '').toLowerCase().includes('phase'));
  const focusRow = rows.find((r) => rowMetricKey(r) === 'week_focus');
  const volumeRow = rows.find((r) => rowMetricKey(r) === 'volume');
  const intensityRow = rows.find((r) => rowMetricKey(r) === 'intensity');
  const peakRow = rows.find((r) => rowMetricKey(r) === 'peaking_index');

  const phaseName = useMemo(() => {
    if (!phaseRow) return '—';
    const c = cells.find(
      (x) =>
        x.row_id === phaseRow.id &&
        x.value_text &&
        weekStartIso >= x.cell_date &&
        weekStartIso <= (x.span_end_date || x.cell_date)
    );
    return c?.value_text || '—';
  }, [cells, phaseRow, weekStartIso]);

  const weekFocus = useMemo(() => {
    if (!focusRow) return '—';
    const c = cells.find((x) => x.row_id === focusRow.id && x.cell_date === weekStartIso);
    return c?.value_text || '—';
  }, [cells, focusRow, weekStartIso]);

  const allWeeks = useMemo(() => weekStartsBetween(plan.start_date, plan.end_date), [plan.start_date, plan.end_date]);

  const weeklyLoads = useMemo(() => {
    return allWeeks.map((w) => {
      const v = volumeRow ? cells.find((c) => c.row_id === volumeRow.id && c.cell_date === w.monday)?.value_number : null;
      const i = intensityRow ? cells.find((c) => c.row_id === intensityRow.id && c.cell_date === w.monday)?.value_number : null;
      if (v == null && i == null) return null;
      return ((Number(v) || 0) + (Number(i) || 0)) / 2;
    });
  }, [allWeeks, volumeRow, intensityRow, cells]);

  const acwrSeries = useMemo(() => computeAcwrSeries(weeklyLoads), [weeklyLoads]);
  const acwrThisWeek = acwrSeries[weekIndex] ?? null;
  const acwrLabel =
    acwrThisWeek == null ? '—' : acwrThisWeek < 0.8 || acwrThisWeek > 1.5 ? 'danger' : acwrThisWeek > 1.3 ? 'caution' : 'safe zone';

  const peakingNow = peakRow ? cells.find((c) => c.row_id === peakRow.id && c.cell_date === weekStartIso)?.value_number : null;

  const weeksToPeak = useMemo(() => {
    if (!peakRow) return null;
    for (let j = weekIndex; j < allWeeks.length; j++) {
      const v = cells.find((c) => c.row_id === peakRow.id && c.cell_date === allWeeks[j].monday)?.value_number;
      if (v != null && Number(v) >= 6) return Math.max(0, j - weekIndex);
    }
    return null;
  }, [allWeeks, cells, peakRow, weekIndex]);

  const summary = useMemo(() => {
    let planned = 0;
    let actual = 0;
    let rpeP = 0;
    let rpeA = 0;
    let np = 0;
    let na = 0;
    for (const s of sessions) {
      planned += Number(s.duration_planned) || 0;
      actual += Number(s.duration_actual) || 0;
      if (s.rpe_planned != null) {
        rpeP += Number(s.rpe_planned);
        np++;
      }
      if (s.rpe_actual != null) {
        rpeA += Number(s.rpe_actual);
        na++;
      }
    }
    return {
      planned,
      actual,
      avgRpePlanned: np ? (rpeP / np).toFixed(1) : '—',
      avgRpeActual: na ? (rpeA / na).toFixed(1) : '—',
    };
  }, [sessions]);

  function getSession(dayIso, slot) {
    const t = slotTimes(slot);
    return sessions.find((s) => s.session_date === dayIso && (s.start_time === t || sessionSlot(s) === slot));
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  async function savePlanNotes() {
    await supabase.from('periodisation_plans').update({ notes: planNotes }).eq('id', plan.id).eq('org_id', user.orgId);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 text-[#e4e2e4]">
      <div className="flex-1 min-w-0 space-y-3">
        {/* Breadcrumb + nav */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="text-gray-400 truncate">
            <span className="text-white font-semibold">{team?.name ?? 'Team'}</span>
            <span className="mx-1">/</span>
            <span>{plan.name}</span>
            <span className="mx-1">/</span>
            <span className="text-[#F97316] font-bold">
              Week {weekIndex + 1} · {new Date(weekStartIso + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onPrev} className="text-[10px] font-bold uppercase text-gray-400 hover:text-white">
              ← Prev
            </button>
            <span className="text-xs font-bold text-white px-2">{formatRange(weekStartIso, weekEndIso)}</span>
            <button type="button" onClick={onNext} className="text-[10px] font-bold uppercase text-gray-400 hover:text-white">
              Next →
            </button>
            <button
              type="button"
              onClick={onBack}
              className="ml-2 px-3 py-1.5 rounded-lg border border-[#F97316] text-[10px] font-black uppercase text-[#F97316] hover:bg-[#F97316]/10"
            >
              Annual view ↗
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-3xl">refresh</span>
          </div>
        )}

        {!loading && (
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-[720px]">
              {days.map((d) => {
                const isToday = d.iso === todayIso;
                return (
                  <div
                    key={d.iso}
                    className={`flex-1 min-w-[96px] rounded-lg border overflow-hidden ${
                      d.isSunday ? 'opacity-50 border-white/5' : 'border-white/10'
                    } ${isToday ? 'ring-1 ring-[#F97316]' : ''}`}
                  >
                    <div className={`px-2 py-1.5 text-center border-b border-white/10 ${isToday ? 'text-[#F97316]' : 'text-gray-300'}`}>
                      <div className="text-[10px] font-black uppercase">{d.isSunday ? 'Rest day' : d.label}</div>
                      <div className="text-[9px] text-gray-500">
                        {new Date(d.iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                      {!d.isSunday && (
                        <span className="inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">Gym</span>
                      )}
                    </div>
                    {!d.isSunday && (
                      <>
                        <SessionBlock
                          slot="am"
                          dayIso={d.iso}
                          getSession={getSession}
                          onOpen={() => setDrawer({ dayIso: d.iso, slot: 'am' })}
                        />
                        <SessionBlock
                          slot="pm"
                          dayIso={d.iso}
                          getSession={getSession}
                          onOpen={() => setDrawer({ dayIso: d.iso, slot: 'pm' })}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-[#252528] p-3">
          <label className="text-[10px] font-bold uppercase text-gray-500">Week notes</label>
          <textarea
            value={planNotes}
            onChange={(e) => setPlanNotes(e.target.value)}
            onBlur={savePlanNotes}
            rows={2}
            placeholder="Plan-level notes…"
            className="mt-1 w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </div>
      </div>

      {/* Summary */}
      <aside className="w-full lg:w-[190px] shrink-0 space-y-3 lg:border-l border-white/10 lg:pl-4">
        <div>
          <p className="text-lg font-black text-white">Week {weekIndex + 1}</p>
          <p className="text-[10px] text-gray-500">{formatRange(weekStartIso, weekEndIso)}</p>
          <span className="inline-block mt-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
            {phaseName}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Week focus</p>
          <p className="text-xs text-gray-300 leading-snug">{weekFocus}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#252528] p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase text-gray-500">Total volume</p>
          <p className="text-sm text-white">
            {summary.planned} planned <span className="text-gray-500">(min)</span>
          </p>
          <p className="text-sm text-emerald-400">{summary.actual} actual</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#252528] p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase text-gray-500">Avg RPE</p>
          <p className="text-xs text-gray-300">Planned: {summary.avgRpePlanned}</p>
          <p className="text-xs text-gray-300">Actual: {summary.avgRpeActual}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#252528] p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase text-gray-500">ACWR</p>
          <p className="text-lg font-black text-white">{acwrThisWeek == null ? '—' : acwrThisWeek.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400 capitalize">{acwrLabel}</p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${acwrThisWeek == null ? 0 : Math.min(100, (acwrThisWeek / 1.8) * 100)}%`,
                background: acwrStyle(acwrThisWeek).bg,
              }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#252528] p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase text-gray-500">Peaking index</p>
          <p className="text-2xl font-black text-[#F97316]">{peakingNow ?? '—'}</p>
          <p className="text-[10px] text-gray-400">{weeksToPeak != null ? `${weeksToPeak} weeks to peak` : '—'}</p>
        </div>
        <button
          type="button"
          onClick={() => console.log('Ask AI about this week', { weekStartIso, planId: plan.id })}
          className="w-full py-3 rounded-lg border border-[#F97316] text-[10px] font-black uppercase text-[#F97316] hover:bg-[#F97316]/10"
        >
          Ask AI about this week ↗
        </button>
      </aside>

      {drawer && (
        <SessionDrawer
          drawer={drawer}
          getSession={getSession}
          libraryItems={libraryItems}
          onClose={() => setDrawer(null)}
          upsertSession={upsertSession}
          fetchSessions={fetchSessions}
        />
      )}
    </div>
  );
}

function SessionBlock({ slot, dayIso, getSession, onOpen }) {
  const s = getSession(dayIso, slot);
  const items = Array.isArray(s?.content_items) ? s.content_items : [];
  const dominant = items.map((i) => normalizeCategory(i.category || i.name)).sort()[0] || 'default';
  const cat = CAT_STYLES[dominant] || CAT_STYLES.default;
  const header =
    slot === 'am'
      ? { wrap: 'bg-[#fefce8] border-t-2 border-[#fbbf24]', label: 'AM' }
      : { wrap: 'bg-[#1e3a5f] border-t-2 border-[#3b82f6]', label: 'PM' };

  return (
    <div className={header.wrap}>
      <div className="px-2 py-1 text-[9px] font-black uppercase text-gray-600">{header.label}</div>
      <button type="button" onClick={onOpen} className="w-full text-left p-2 space-y-1 hover:bg-black/10 transition-colors">
        <div className="text-[9px] text-gray-600">{slot === 'pm' ? 'Venue' : 'Venue'}</div>
        <div className="text-[10px] text-gray-200 truncate">{s?.venue || '—'}</div>
        {slot === 'pm' && (
          <>
            <div className="text-[9px] text-gray-600 pt-1">Screening</div>
            <div className="text-[10px] text-blue-300 truncate">{s?.screening_notes || 'NA'}</div>
          </>
        )}
        <div className="text-[9px] text-gray-600 pt-1">S&amp;C</div>
        <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cat.bg, color: cat.text }}>
          {cat.label}
        </span>
        <ul className="mt-1 space-y-0.5">
          {items.slice(0, 4).map((it, i) => (
            <li key={i} className="text-[9px] text-gray-400 truncate">
              · {it.name || it.label || 'Item'}
            </li>
          ))}
          {!items.length && <li className="text-[9px] text-gray-600">—</li>}
        </ul>
        <div className="flex items-center gap-2 pt-1">
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded"
            style={{
              background: s?.rpe_planned != null ? rpeStyle(s.rpe_planned).bg : '#374151',
              color: s?.rpe_planned != null ? rpeStyle(s.rpe_planned).text : '#fff',
            }}
          >
            {s?.rpe_planned ?? '—'}
          </span>
          <span className="text-[10px] text-gray-500">{s?.duration_planned != null ? `${s.duration_planned}m` : '—'}</span>
        </div>
        {slot === 'pm' && <div className="text-[9px] text-gray-500 pt-1 truncate">{s?.recovery_modality || '—'}</div>}
      </button>
    </div>
  );
}

function SessionDrawer({ drawer, getSession, libraryItems, onClose, upsertSession, fetchSessions }) {
  const { dayIso, slot } = drawer;
  const existing = getSession(dayIso, slot);
  const [category, setCategory] = useState('strength');
  const [contentItems, setContentItems] = useState([]);
  const [rpePlanned, setRpePlanned] = useState(6);
  const [rpeActual, setRpeActual] = useState('');
  const [durP, setDurP] = useState(90);
  const [durA, setDurA] = useState('');
  const [venue, setVenue] = useState('');
  const [screening, setScreening] = useState('');
  const [recovery, setRecovery] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = existing;
    setVenue(s?.venue ?? '');
    setScreening(s?.screening_notes ?? '');
    setRecovery(s?.recovery_modality ?? '');
    setNotes(s?.notes ?? '');
    setRpePlanned(s?.rpe_planned ?? 6);
    setRpeActual(s?.rpe_actual != null ? String(s.rpe_actual) : '');
    setDurP(s?.duration_planned ?? 90);
    setDurA(s?.duration_actual != null ? String(s.duration_actual) : '');
    const items = Array.isArray(s?.content_items) ? s.content_items : [];
    setContentItems(items);
    const dom = items.map((i) => normalizeCategory(i.category || i.name)).sort()[0] || 'strength';
    setCategory(dom);
  }, [existing, dayIso, slot]);

  const dayLabel = new Date(dayIso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  const filteredLib = useMemo(() => {
    const q = search.toLowerCase();
    const sys = libraryItems.filter((i) => i.is_system && (!q || (i.name || '').toLowerCase().includes(q)));
    const org = libraryItems.filter((i) => !i.is_system && (!q || (i.name || '').toLowerCase().includes(q)));
    return { sys, org };
  }, [libraryItems, search]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertSession({
        id: existing?.id,
        session_date: dayIso,
        start_time: slotTimes(slot),
        session_type: slot,
        venue,
        screening_notes: screening || null,
        content_items: contentItems,
        rpe_planned: rpePlanned,
        rpe_actual: rpeActual === '' ? null : Number(rpeActual),
        duration_planned: durP,
        duration_actual: durA === '' ? null : Number(durA),
        recovery_modality: recovery || null,
        notes: notes || null,
      });
      await fetchSessions();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const canLib = canEditSessionLibrary();

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50 md:bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[95] w-[280px] bg-[#2a2a2c] border-l border-white/10 shadow-2xl flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-white/10 flex justify-between items-start gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">
              {dayLabel} · {slot.toUpperCase()}
            </h2>
            <p className="text-xs text-gray-500">{venue || 'Venue'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-white/10 text-gray-400">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Category</p>
            <span
              className="inline-block text-[10px] font-bold px-2 py-1 rounded-full capitalize"
              style={{
                background: CAT_STYLES[category]?.bg,
                color: CAT_STYLES[category]?.text,
              }}
            >
              {CAT_STYLES[category]?.label}
            </span>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Session content</p>
            <ul className="space-y-1 mb-2">
              {contentItems.map((it, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 text-[11px] bg-[#1C1C1E] rounded px-2 py-1.5 border border-white/5"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_STYLES[normalizeCategory(it.category)]?.bg }} />
                  <span className="flex-1 truncate">{it.name}</span>
                  <button type="button" className="text-gray-500 text-xs" onClick={() => setContentItems((c) => c.filter((_, i) => i !== idx))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library…"
              className="w-full text-xs bg-[#1C1C1E] border border-white/10 rounded px-2 py-2 mb-2"
            />
            <div className="max-h-32 overflow-y-auto text-[10px] space-y-1 border border-white/5 rounded p-2 bg-[#1C1C1E]">
              <p className="text-gray-500 font-bold uppercase text-[9px]">System</p>
              {filteredLib.sys.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="block w-full text-left text-gray-300 hover:text-white py-0.5"
                  onClick={() => {
                    setContentItems((c) => [...c, { name: i.name, category: i.category || 'default', library_item_id: i.id }]);
                    setSearch('');
                  }}
                >
                  {i.name}
                </button>
              ))}
              <p className="text-gray-500 font-bold uppercase text-[9px] pt-1">Organisation</p>
              {filteredLib.org.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="block w-full text-left text-gray-300 hover:text-white py-0.5"
                  onClick={() => {
                    setContentItems((c) => [...c, { name: i.name, category: i.category || 'default', library_item_id: i.id }]);
                    setSearch('');
                  }}
                >
                  {i.name}
                </button>
              ))}
              <button
                type="button"
                className="block w-full text-left text-amber-400/90 py-1 mt-1 border-t border-white/10"
                onClick={() => {
                  const one = window.prompt('One-off item name');
                  if (one) setContentItems((c) => [...c, { name: one, category: 'default', source: 'once' }]);
                }}
              >
                Use once…
              </button>
              {canLib && (
                <button
                  type="button"
                  className="block w-full text-left text-[#F97316] py-1"
                  onClick={() => console.log('+ Add to org library (admin)')}
                >
                  + Add to org library
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Venue</p>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2" />
          </div>
          {slot === 'pm' && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Screening</p>
              <input value={screening} onChange={(e) => setScreening(e.target.value)} className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2" />
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">RPE (planned: {rpePlanned})</p>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpePlanned(n)}
                  className={`w-7 h-7 rounded text-[10px] font-bold ${
                    rpePlanned === n ? 'bg-[#F97316] text-black' : 'bg-[#1C1C1E] border border-white/10 text-gray-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mt-2 mb-1">RPE actual</p>
            <input
              value={rpeActual}
              onChange={(e) => setRpeActual(e.target.value)}
              placeholder="—"
              className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Planned (min)</p>
              <input type="number" value={durP} onChange={(e) => setDurP(Number(e.target.value))} className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Actual (min)</p>
              <input value={durA} onChange={(e) => setDurA(e.target.value)} placeholder="—" className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2" />
            </div>
          </div>

          {slot === 'pm' && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Recovery modality</p>
              <select value={recovery} onChange={(e) => setRecovery(e.target.value)} className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2">
                <option value="">—</option>
                {RECOVERY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Notes</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add notes…" className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2" />
          </div>

          <button type="button" className="w-full py-2 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5">
            Plan this session →
          </button>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full py-3 rounded-lg bg-[#F97316] text-black text-[10px] font-black uppercase disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
