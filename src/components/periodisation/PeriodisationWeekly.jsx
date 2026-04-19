import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getCurrentUser, canEditSessionLibrary } from '../../lib/auth';
import { useSessions } from '../../hooks/useSessions';
import { addDays, formatRange, rowMetricKey, weekStartsBetween, computeAcwrSeries, acwrStyle } from '../../lib/periodisationUtils';

const CAT_STYLES = {
  strength: { bg: '#fef9c3', text: '#713f12', label: 'Strength' },
  speed: { bg: '#dbeafe', text: '#1e40af', label: 'Speed' },
  power: { bg: '#e9d5ff', text: '#5b21b6', label: 'Power' },
  endurance: { bg: '#bbf7d0', text: '#14532d', label: 'Endurance' },
  technical: { bg: '#fce7f3', text: '#9d174d', label: 'Technical' },
  recovery: { bg: '#ccfbf1', text: '#115e59', label: 'Recovery' },
  default: { bg: '#e5e7eb', text: '#374151', label: 'Session' },
};

// ── Calendar grid constants & helpers
const SESSION_TYPES = [
  { label: 'Strength session', value: 'strength', venue: 'Gym' },
  { label: 'Conditioning session', value: 'conditioning', venue: 'Ground' },
  { label: 'Mat session', value: 'mat', venue: 'Mat hall' },
  { label: 'Physiotherapy session', value: 'physio', venue: 'Physio room' },
  { label: 'Match', value: 'match', venue: 'Ground' },
  { label: 'Testing', value: 'testing', venue: 'Gym' },
];

const VENUES = ['Gym', 'Ground', 'Mat hall', 'Physio room', 'Pool', 'Other'];

const DEFAULT_AM_TIME = '06:30:00';
const DEFAULT_PM_TIME = '16:00:00';

// Height in px per 30-minute slot
const SLOT_HEIGHT = 28;

// Given a start_time string like "06:30:00", return offset in px from 05:00
function timeToOffset(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const minutesFrom5 = (h - 5) * 60 + (m || 0);
  return Math.max(0, (minutesFrom5 / 30) * SLOT_HEIGHT);
}

// Given duration_planned in minutes, return height in px (min 28px)
function durationToHeight(mins) {
  const slots = Math.max(1, (mins || 60) / 30);
  return slots * SLOT_HEIGHT - 4;
}

// Given a Y pixel position relative to the top of the time grid
// element, return the nearest 30-min snapped time string "HH:MM:00"
// Grid starts at 05:00. Each SLOT_HEIGHT px = 30 minutes.
function pixelToSnappedTime(offsetPx) {
  const totalSlots = Math.round(offsetPx / SLOT_HEIGHT);
  const totalMins = 5 * 60 + totalSlots * 30;
  const clamped = Math.min(Math.max(totalMins, 5 * 60), 22 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// Get default venue for a session type value
function defaultVenueFor(typeValue) {
  return SESSION_TYPES.find((t) => t.value === typeValue)?.venue ?? 'Gym';
}

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

function SessionCalBlock({ session: s, segFrom, onOpen, onPointerDown, onContextMenu, isDragging }) {
  const segStartTime = `${String(segFrom).padStart(2, '0')}:00:00`;
  const top = timeToOffset(s.start_time || DEFAULT_AM_TIME) - timeToOffset(segStartTime) + 2;
  const height = durationToHeight(s.duration_planned);
  const typeConfig = SESSION_TYPES.find((t) => t.value === s.session_type) || SESSION_TYPES[0];
  const rpeColor =
    s.rpe_planned == null ? '#374151' : s.rpe_planned >= 8 ? '#f97316' : s.rpe_planned >= 6 ? '#fbbf24' : '#22c55e';

  const bgMap = {
    strength: { bg: '#fef9c3', text: '#713f12' },
    conditioning: { bg: '#dbeafe', text: '#1e40af' },
    mat: { bg: '#e9d5ff', text: '#5b21b6' },
    physio: { bg: '#bbf7d0', text: '#14532d' },
    match: { bg: '#fee2e2', text: '#991b1b' },
    testing: { bg: '#e0e7ff', text: '#3730a3' },
  };
  const colors = bgMap[s.session_type] || { bg: '#374151', text: '#fff' };

  return (
    <div
      className={`absolute left-1 right-1 rounded cursor-grab active:cursor-grabbing hover:brightness-110 hover:z-10 transition-all select-none touch-none ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{ top, height, background: colors.bg, color: colors.text, zIndex: 2 }}
      onPointerDown={onPointerDown}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className="p-1 overflow-hidden h-full flex flex-col">
        <div className="text-[8px] opacity-70">{(s.start_time || '').slice(0, 5)}</div>
        <div className="text-[9px] font-bold truncate">{typeConfig.label}</div>
        {height > 36 && <div className="text-[8px] opacity-70 truncate">{s.venue}</div>}
        {height > 48 && s.rpe_planned != null && (
          <div className="mt-auto text-[8px] font-bold px-1 rounded self-start" style={{ background: rpeColor, color: '#fff' }}>
            RPE {s.rpe_planned}
          </div>
        )}
      </div>
    </div>
  );
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
  const { sessions, loading: initialLoading, upsertSession } = useSessions(teamId, plan.id, weekStartIso, weekEndIso);
  const [drawer, setDrawer] = useState(null);
  const [libraryItems, setLibraryItems] = useState([]);
  const [planNotes, setPlanNotes] = useState(plan?.notes ?? '');

  const [clipboard, setClipboard] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [dragSession, setDragSession] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [dragOverTime, setDragOverTime] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragOrigin, setDragOrigin] = useState(null);
  const dragOriginRef = useRef(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const timeGridRef = useRef(null);

  const [expandedZones, setExpandedZones] = useState({});

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

  const activeHours = useMemo(() => {
    const hours = new Set();
    sessions.forEach((s) => {
      const h = parseInt((s.start_time || '06:30').split(':')[0], 10);
      for (let i = Math.max(5, h - 1); i <= Math.min(23, h + 2); i++) {
        hours.add(i);
      }
    });
    [5, 6, 15, 16, 17].forEach((h) => hours.add(h));
    return Array.from(hours).sort((a, b) => a - b);
  }, [sessions]);

  const timeSegments = useMemo(() => {
    const segments = [];
    for (let i = 0; i < activeHours.length - 1; i++) {
      const from = activeHours[i];
      const to = activeHours[i + 1];
      segments.push({ from, to, isDead: to - from >= 2 });
    }
    return segments;
  }, [activeHours]);

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

  const todayIso = new Date().toISOString().slice(0, 10);

  async function savePlanNotes() {
    await supabase.from('periodisation_plans').update({ notes: planNotes }).eq('id', plan.id).eq('org_id', user.orgId);
  }

  async function handleDropOnDay(targetDayIso, targetTime = null, sessionToMove = null) {
    const sess = sessionToMove ?? dragSession;
    if (!sess) {
      setDragSession(null);
      setDragOverDay(null);
      setDragOverTime(null);
      return;
    }
    // Only skip if BOTH day and time are unchanged
    const timeUnchanged = !targetTime || targetTime === sess.start_time;
    if (sess.session_date === targetDayIso && timeUnchanged) {
      setDragSession(null);
      setDragOverDay(null);
      setDragOverTime(null);
      return;
    }
    try {
      await upsertSession({
        ...sess,
        session_date: targetDayIso,
        start_time: targetTime ?? sess.start_time,
      });
    } catch (e) {
      console.error(e);
    }
    setDragSession(null);
    setDragOverDay(null);
    setDragOverTime(null);
  }

  function handleCopy(session) {
    const rest = { ...session };
    delete rest.id;
    delete rest.session_date;
    setClipboard(rest);
    setCtxMenu(null);
  }

  async function handlePaste(targetDayIso, targetTime = null) {
    if (!clipboard) return;
    try {
      await upsertSession({
        ...clipboard,
        session_date: targetDayIso,
        start_time: targetTime ?? clipboard.start_time ?? DEFAULT_AM_TIME,
        id: undefined,
      });
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!dragSession) return undefined;
    function onPointerMove(e) {
      setDragPos({ x: e.clientX, y: e.clientY });
      const ox = dragOriginRef.current?.x ?? e.clientX;
      const oy = dragOriginRef.current?.y ?? e.clientY;
      if (Math.hypot(e.clientX - ox, e.clientY - oy) > 8) {
        dragMovedRef.current = true;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const col = el?.closest('[data-day-iso]');
      if (col?.dataset?.dayIso) setDragOverDay(col.dataset.dayIso);

      // Compute snapped time from Y position relative to time grid
      if (timeGridRef.current) {
        const gridRect = timeGridRef.current.getBoundingClientRect();
        const offsetPx = e.clientY - gridRect.top;
        setDragOverTime(pixelToSnappedTime(offsetPx));
      }
    }
    function onPointerUp(e) {
      if (dragMovedRef.current) {
        suppressClickRef.current = true;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const col = el?.closest('[data-day-iso]');
      const sess = dragSession;
      let snapTime = dragOverTime;
      if (timeGridRef.current) {
        const gridRect = timeGridRef.current.getBoundingClientRect();
        snapTime = pixelToSnappedTime(e.clientY - gridRect.top);
      }
      setDragPos(null);
      setDragOrigin(null);
      dragOriginRef.current = null;
      dragMovedRef.current = false;
      if (col && col.dataset.dayIso && sess) {
        const targetDay = col.dataset.dayIso;
        const timeUnchanged = !snapTime || snapTime === sess.start_time;
        if (sess.session_date === targetDay && timeUnchanged) {
          setDragSession(null);
          setDragOverDay(null);
          setDragOverTime(null);
          return;
        }
        setDragSession(null);
        setDragOverDay(null);
        void handleDropOnDay(targetDay, snapTime, sess);
        setDragOverTime(null);
        return;
      }
      setDragSession(null);
      setDragOverDay(null);
      setDragOverTime(null);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragSession]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col text-[#e4e2e4]" onClick={() => setCtxMenu(null)}>
      {/* Breadcrumb + nav */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-3">
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

      {initialLoading && (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined text-[#F97316] animate-spin text-3xl">refresh</span>
        </div>
      )}

      {!initialLoading && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          {/* Day header row */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))' }}>
            <div className="bg-[#252528]" />
            {days.map((d) => {
              const isToday = d.iso === todayIso;
              const daySessions = sessions.filter((s) => s.session_date === d.iso);
              const totalMins = daySessions.reduce((a, s) => a + (s.duration_planned || 0), 0);
              const avgRpe = daySessions.length
                ? daySessions.reduce((a, s) => a + (s.rpe_planned || 0), 0) / daySessions.length
                : null;
              const rpeColor =
                avgRpe == null ? 'transparent' : avgRpe >= 8 ? '#f97316' : avgRpe >= 6 ? '#fbbf24' : '#22c55e';
              return (
                <div
                  key={d.iso}
                  data-day-iso={d.iso}
                  className={`text-center px-1 py-1.5 border-r border-white/10 last:border-r-0 bg-[#252528] ${
                    isToday ? 'border-b-2 border-b-[#F97316]' : ''
                  }`}
                >
                  <div className={`text-[9px] font-bold uppercase ${isToday ? 'text-[#F97316]' : 'text-gray-400'}`}>{d.label}</div>
                  <div
                    className={`text-sm font-bold mx-auto w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-[#F97316] text-black' : 'text-white'
                    }`}
                  >
                    {new Date(d.iso + 'T12:00:00').getDate()}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div className="h-[3px] rounded-full bg-[#F97316]" style={{ width: Math.min(36, totalMins / 5) + 'px' }} />
                    {avgRpe != null && <div className="w-2 h-2 rounded-full" style={{ background: rpeColor }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative" ref={timeGridRef}>
            {timeSegments.map((seg, i) => {
              if (seg.isDead) {
                const zoneKey = `${seg.from}-${seg.to}`;
                const isExpanded = expandedZones[zoneKey];
                return (
                  <div key={zoneKey}>
                    <div
                      className="flex items-center gap-2 border-b border-white/10 bg-[#1a1a1c] cursor-pointer px-3 py-1.5 hover:bg-[#252528] transition-colors"
                      onClick={() => setExpandedZones((z) => ({ ...z, [zoneKey]: !z[zoneKey] }))}
                    >
                      <span className="text-[9px] text-gray-500">{isExpanded ? '▾' : '▸'}</span>
                      <span className="text-[9px] text-gray-500">
                        {String(seg.from).padStart(2, '0')}:00 – {String(seg.to).padStart(2, '0')}:00 · no sessions · click to{' '}
                        {isExpanded ? 'collapse' : 'expand'}
                      </span>
                    </div>
                    {isExpanded &&
                      Array.from({ length: (seg.to - seg.from) * 2 }, (_, j) => {
                        const totalMins = seg.from * 60 + j * 30;
                        const h = Math.floor(totalMins / 60);
                        const label = j % 2 === 0 ? String(h).padStart(2, '0') + ':00' : '';
                        return (
                          <div
                            key={j}
                            className="grid border-b border-white/5"
                            style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))', height: SLOT_HEIGHT + 'px' }}
                          >
                            <div className="text-[8px] text-gray-600 text-right pr-1 pt-1 bg-[#1a1a1c] border-r border-white/10">{label}</div>
                            {days.map((d) => (
                              <div key={d.iso} className="border-r border-white/5 last:border-r-0" />
                            ))}
                          </div>
                        );
                      })}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="grid border-b border-white/10"
                  style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))', height: SLOT_HEIGHT * 2 + 'px' }}
                >
                  <div className="text-[8px] text-gray-600 text-right pr-1 pt-1 bg-[#1a1a1c] border-r border-white/10">
                    {String(seg.from).padStart(2, '0')}:00
                  </div>
                  {days.map((d) => {
                    const daySess = sessions.filter((s) => {
                      const h = parseInt((s.start_time || '06:30').split(':')[0], 10);
                      return s.session_date === d.iso && h >= seg.from && h < seg.to;
                    });
                    return (
                      <div
                        key={d.iso}
                        data-day-iso={d.iso}
                        className={`relative border-r border-white/10 last:border-r-0 ${dragOverDay === d.iso ? 'bg-[#F97316]/10' : ''}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (clipboard) {
                            let slotTime = DEFAULT_AM_TIME;
                            if (timeGridRef.current) {
                              const gridRect = timeGridRef.current.getBoundingClientRect();
                              slotTime = pixelToSnappedTime(e.clientY - gridRect.top);
                            }
                            setCtxMenu({
                              x: e.clientX,
                              y: e.clientY,
                              session: null,
                              pasteTargetDay: d.iso,
                              pasteTargetTime: slotTime,
                            });
                          }
                        }}
                      >
                        {daySess.map((s) => (
                          <SessionCalBlock
                            key={s.id}
                            session={s}
                            segFrom={seg.from}
                            isDragging={dragSession?.id === s.id}
                            onOpen={() => {
                              if (suppressClickRef.current) {
                                suppressClickRef.current = false;
                                return;
                              }
                              setDrawer({ dayIso: d.iso, sessionId: s.id });
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              dragOriginRef.current = { x: e.clientX, y: e.clientY };
                              setDragOrigin({ x: e.clientX, y: e.clientY });
                              setDragPos({ x: e.clientX, y: e.clientY });
                              dragMovedRef.current = false;
                              setDragSession(s);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCtxMenu({ x: e.clientX, y: e.clientY, session: s });
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Add session row */}
          <div className="grid border-t border-white/10" style={{ gridTemplateColumns: '38px repeat(7, minmax(0,1fr))' }}>
            <div className="bg-[#1a1a1c] border-r border-white/10" />
            {days.map((d) => (
              <div key={d.iso} className="border-r border-white/10 last:border-r-0 p-1.5">
                <button
                  type="button"
                  onClick={() => setDrawer({ dayIso: d.iso, sessionId: null })}
                  className="w-full text-[9px] text-gray-500 border border-dashed border-white/20 rounded py-1 hover:border-[#F97316] hover:text-[#F97316] transition-colors"
                >
                  + add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week notes */}
      <div className="mt-3 rounded-lg border border-white/10 bg-[#252528] p-3">
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

      {/* Summary strip */}
      <div className="mt-3 rounded-lg border border-white/10 bg-[#252528] p-3 flex flex-wrap gap-6 items-start">
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Phase</p>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
            {phaseName}
          </span>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Week focus</p>
          <p className="text-xs text-gray-300">{weekFocus}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Total volume</p>
          <p className="text-sm text-white">
            {summary.planned} <span className="text-gray-500">planned (min)</span>
          </p>
          <p className="text-sm text-emerald-400">{summary.actual} actual</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Avg RPE</p>
          <p className="text-xs text-gray-300">Planned: {summary.avgRpePlanned}</p>
          <p className="text-xs text-gray-300">Actual: {summary.avgRpeActual}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">ACWR</p>
          <p className="text-lg font-black text-white">{acwrThisWeek == null ? '—' : acwrThisWeek.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400 capitalize">{acwrLabel}</p>
          <div className="h-1.5 rounded-full bg-white/10 w-24 mt-1 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: (acwrThisWeek == null ? 0 : Math.min(100, (acwrThisWeek / 1.8) * 100)) + '%',
                background: acwrStyle(acwrThisWeek).bg,
              }}
            />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Peaking index</p>
          <p className="text-2xl font-black text-[#F97316]">{peakingNow ?? '—'}</p>
          <p className="text-[10px] text-gray-400">{weeksToPeak != null ? `${weeksToPeak} weeks to peak` : '—'}</p>
        </div>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-[200] bg-[#2a2a2c] border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.session && (
            <>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white"
                onClick={() => handleCopy(ctxMenu.session)}
              >
                Copy session
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[11px] text-red-400 hover:bg-white/10"
                onClick={() => setCtxMenu(null)}
              >
                Delete session
              </button>
            </>
          )}
          {!ctxMenu.session && ctxMenu.pasteTargetDay && clipboard && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[11px] text-[#F97316] hover:bg-white/10"
              onClick={() => {
                handlePaste(ctxMenu.pasteTargetDay, ctxMenu.pasteTargetTime);
                setCtxMenu(null);
              }}
            >
              Paste session
            </button>
          )}
        </div>
      )}

      {dragSession && dragPos && dragOrigin && (
        <div
          className="fixed z-[250] pointer-events-none rounded border border-white/20 bg-[#2a2a2c]/95 px-2 py-1 text-[10px] font-bold text-white shadow-lg max-w-[200px]"
          style={{ left: dragPos.x, top: dragPos.y, transform: 'translate(8px, 8px)' }}
          aria-hidden
        >
          <span className="truncate block">
            {(SESSION_TYPES.find((t) => t.value === dragSession.session_type) || SESSION_TYPES[0]).label}
            {dragOverDay
              ? ` → ${days.find((d) => d.iso === dragOverDay)?.label ?? ''}${dragOverTime ? ` ${dragOverTime.slice(0, 5)}` : ''}`
              : ''}
          </span>
        </div>
      )}

      {drawer && (
        <SessionDrawer
          drawer={drawer}
          sessions={sessions}
          libraryItems={libraryItems}
          onClose={() => setDrawer(null)}
          upsertSession={upsertSession}
        />
      )}
    </div>
  );
}

const TIME_SLOTS = Array.from({ length: 35 }, (_, i) => {
  const totalMins = 5 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

function TimePicker({ value, onChange }) {
  const display = (value || '06:30:00').slice(0, 5);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-1">
      <select
        value={TIME_SLOTS.includes(display) ? display : '__custom__'}
        onChange={(e) => {
          if (e.target.value === '__custom__') {
            setShowCustom(true);
          } else {
            setShowCustom(false);
            onChange(e.target.value + ':00');
          }
        }}
        className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2"
      >
        {TIME_SLOTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value="__custom__">Custom time…</option>
      </select>
      {(showCustom || !TIME_SLOTS.includes(display)) && (
        <input
          type="text"
          placeholder="HH:MM"
          value={custom || display}
          onChange={(e) => {
            setCustom(e.target.value);
            const match = e.target.value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
            if (match) onChange(e.target.value + ':00');
          }}
          className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2"
        />
      )}
    </div>
  );
}

function SessionDrawer({ drawer, sessions, libraryItems, onClose, upsertSession }) {
  const existing = drawer.sessionId ? sessions.find((s) => s.id === drawer.sessionId) : null;
  const [sessionType, setSessionType] = useState('strength');
  const [startTime, setStartTime] = useState(DEFAULT_AM_TIME);
  const [contentItems, setContentItems] = useState([]);
  const [rpePlanned, setRpePlanned] = useState(6);
  const [rpeActual, setRpeActual] = useState('');
  const [durP, setDurP] = useState(90);
  const [durA, setDurA] = useState('');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = existing;
    setSessionType(s?.session_type || 'strength');
    setStartTime(s?.start_time || DEFAULT_AM_TIME);
    setVenue(s?.venue ?? defaultVenueFor(s?.session_type || 'strength'));
    setNotes(s?.notes ?? '');
    setRpePlanned(s?.rpe_planned ?? 6);
    setRpeActual(s?.rpe_actual != null ? String(s.rpe_actual) : '');
    setDurP(s?.duration_planned ?? 90);
    setDurA(s?.duration_actual != null ? String(s.duration_actual) : '');
    const items = Array.isArray(s?.content_items) ? s.content_items : [];
    setContentItems(items);
  }, [existing, drawer.dayIso, drawer.sessionId]);

  const dayLabel = new Date(drawer.dayIso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const startLabel = (startTime || DEFAULT_AM_TIME).slice(0, 5);

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
        session_date: drawer.dayIso,
        start_time: startTime,
        session_type: sessionType,
        venue,
        content_items: contentItems,
        rpe_planned: rpePlanned,
        rpe_actual: rpeActual === '' ? null : Number(rpeActual),
        duration_planned: durP,
        duration_actual: durA === '' ? null : Number(durA),
        notes: notes || null,
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const canLib = canEditSessionLibrary();
  const typeLabel = SESSION_TYPES.find((t) => t.value === sessionType)?.label ?? 'Session';
  const venueOptions = venue && !VENUES.includes(venue) ? [...VENUES, venue] : VENUES;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50 md:bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[95] w-[280px] bg-[#2a2a2c] border-l border-white/10 shadow-2xl flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-white/10 flex justify-between items-start gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">
              {dayLabel} · {startLabel}
            </h2>
            <p className="text-xs text-gray-500">{typeLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-white/10 text-gray-400">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Time</p>
            <TimePicker value={startTime} onChange={(val) => setStartTime(val)} />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Session type</p>
            <select
              value={sessionType}
              onChange={(e) => {
                const v = e.target.value;
                setSessionType(v);
                if (!existing) setVenue(defaultVenueFor(v));
              }}
              className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
            <select value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full text-sm bg-[#1C1C1E] border border-white/10 rounded px-2 py-2">
              {venueOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

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
