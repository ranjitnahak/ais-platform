import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser, canSync } from '../../lib/auth';
import { useUser } from '../../context/UserContext';
import { useSessions, toSessionUpsertRow } from '../../hooks/useSessions';
import { addDays, formatRange, rowMetricKey, weekStartsBetween, computeAcwrSeries, acwrStyle } from '../../lib/periodisationUtils';
import { getEffectiveOrgId } from '../../lib/orgScope';
import { copyWeekSessionsToNext } from '../../lib/periodisationWeekCopy';
import { copySessionAthleteLogs } from '../../lib/sessionAthleteLogSync';
import { supabase } from '../../lib/supabaseClient';
import { dayIsoFromPointer, gridOffsetYFromPointer, normalizeDbTime } from '../../lib/weeklyTimeGrid';
import WeekNotesEditor from '../ui/WeekNotesEditor';
import SessionCreateModal from '../sessions/SessionCreateModal';
import WeeklyTimeGrid from './WeeklyTimeGrid';
import { useSessionConfig } from '../../context/SessionConfigContext';

const DEFAULT_AM_TIME = '06:30:00';

function weekDays(weekStartIso) {
  // Always anchor to the Monday of the week containing weekStartIso
  const d = new Date(weekStartIso + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = dow === 0 ? -6 : 1 - dow;
  const mondayIso = addDays(weekStartIso, daysFromMonday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(mondayIso, i);
    const date = new Date(iso + 'T12:00:00');
    const dayOfWeek = date.getDay();
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.push({
      iso,
      label: names[dayOfWeek],
      isSunday: dayOfWeek === 0,
      date,
    });
  }
  return days;
}

/**
 * @param {string|null} [defaultWeek] — when `"current"`, parent (`Periodisation.jsx`) resolves
 *   the plan week containing today before mount; this component receives `weekStartIso` / `weekIndex`.
 */
export default function PeriodisationWeekly({
  team,
  plan,
  weekStartIso,
  weekIndex,
  weekEndIso,
  rows,
  cells,
  teamId,
  defaultWeek = null,
  onBack,
  onPrev,
  onNext,
}) {
  const { sessionTypeLabel } = useSessionConfig();
  const { activeOrgId } = useUser();
  const [user, setUser] = useState(null);
  const { sessions, loading: initialLoading, fetchSessions, upsertSession, deleteSession } = useSessions(
    teamId,
    plan.id,
    weekStartIso,
    weekEndIso,
  );
  const [sessionModal, setSessionModal] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [copyNotice, setCopyNotice] = useState(null);
  const [copyWeekBusy, setCopyWeekBusy] = useState(false);
  const [copyWeekNotice, setCopyWeekNotice] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [dragSession, setDragSession] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [dragOverTime, setDragOverTime] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragOrigin, setDragOrigin] = useState(null);
  const dragOriginRef = useRef(null);
  const dragCaptureRef = useRef(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const timeGridRef = useRef(null);
  const offsetToTimeRef = useRef(() => '06:30:00');

  const handleOffsetToTime = useCallback((fn) => {
    offsetToTimeRef.current = fn;
  }, []);

  const days = useMemo(() => weekDays(weekStartIso), [weekStartIso]);

  const editSession = useMemo(() => {
    if (sessionModal?.mode !== 'edit') return null;
    return sessions.find((s) => s.id === sessionModal.sessionId) ?? null;
  }, [sessionModal, sessions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const currentUser = await getCurrentUser();
      if (!cancelled) setUser(currentUser);
    })();
    return () => { cancelled = true; };
  }, []);

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
  const canEdit = canSync(user, 'periodisation', 'edit');
  const canCopyWeek = canEdit && sessions.length > 0 && weekIndex + 1 < allWeeks.length;
  const copyWeekDisabledTitle = !canEdit
    ? ''
    : sessions.length === 0
      ? 'No sessions to copy'
      : weekIndex + 1 >= allWeeks.length
        ? 'Already on last week of plan'
        : '';

  useEffect(() => {
    if (!copyWeekNotice) return undefined;
    const t = setTimeout(() => setCopyWeekNotice(null), 4000);
    return () => clearTimeout(t);
  }, [copyWeekNotice]);

  async function handleCopyWeekToNext() {
    if (!canCopyWeek || copyWeekBusy) return;
    const orgId = getEffectiveOrgId(user, activeOrgId);
    if (!orgId || !teamId || !plan?.id) return;

    setCopyWeekBusy(true);
    try {
      const { count } = await copyWeekSessionsToNext({
        supabase,
        orgId,
        teamId,
        planId: plan.id,
        sessions,
      });
      if (count === 0) {
        setCopyWeekNotice({ type: 'error', text: 'Nothing to copy.' });
        return;
      }
      onNext();
      setCopyWeekNotice({
        type: 'success',
        text: `${count} session${count === 1 ? '' : 's'} copied to next week`,
      });
    } catch (e) {
      console.error(e);
      setCopyWeekNotice({ type: 'error', text: e.message ?? 'Could not copy week.' });
    } finally {
      setCopyWeekBusy(false);
    }
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
    const nextTime = normalizeDbTime(targetTime ?? sess.start_time);
    const curTime = normalizeDbTime(sess.start_time);
    if (sess.session_date === targetDayIso && nextTime === curTime) {
      setDragSession(null);
      setDragOverDay(null);
      setDragOverTime(null);
      return;
    }
    try {
      await upsertSession({
        ...sess,
        session_date: targetDayIso,
        start_time: nextTime ?? sess.start_time,
      });
    } catch (e) {
      console.error(e);
    }
    setDragSession(null);
    setDragOverDay(null);
    setDragOverTime(null);
  }

  function handleCopy(session) {
    const rest = toSessionUpsertRow(session);
    delete rest.id;
    delete rest.session_date;
    setClipboard({ ...rest, _sourceSessionId: session.id });
    setCopyNotice(sessionTypeLabel(session.session_type) || 'Session');
    setCtxMenu(null);
  }

  async function handlePaste(targetDayIso, targetTime = null) {
    if (!clipboard) return;
    const orgId = getEffectiveOrgId(user, activeOrgId);
    const sourceSessionId = clipboard._sourceSessionId ?? null;
    const { _sourceSessionId, ...sessionData } = clipboard;
    try {
      const created = await upsertSession({
        ...sessionData,
        session_date: targetDayIso,
        start_time: targetTime ?? sessionData.start_time ?? DEFAULT_AM_TIME,
        id: undefined,
      });
      if (created?.id && orgId && teamId) {
        await copySessionAthleteLogs(supabase, {
          fromSessionId: sourceSessionId,
          toSessionId: created.id,
          orgId,
          teamId,
        });
      }
      setCopyNotice(null);
      setClipboard(null);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!dragSession) return undefined;
    function resolveDropDay(clientX, clientY) {
      const fromColumns = dayIsoFromPointer(clientX, timeGridRef.current, days);
      if (fromColumns) return fromColumns;
      const el = document.elementFromPoint(clientX, clientY);
      return el?.closest('[data-day-iso]')?.dataset?.dayIso ?? null;
    }
    function resolveDropTime(clientY) {
      if (!timeGridRef.current) return null;
      const offsetPx = gridOffsetYFromPointer(clientY, timeGridRef.current);
      return offsetToTimeRef.current(offsetPx);
    }
    function onPointerMove(e) {
      setDragPos({ x: e.clientX, y: e.clientY });
      const ox = dragOriginRef.current?.x ?? e.clientX;
      const oy = dragOriginRef.current?.y ?? e.clientY;
      if (Math.hypot(e.clientX - ox, e.clientY - oy) > 12) {
        dragMovedRef.current = true;
      }
      const dayIso = resolveDropDay(e.clientX, e.clientY);
      if (dayIso) setDragOverDay(dayIso);
      setDragOverTime(resolveDropTime(e.clientY));
    }
    function onPointerUp(e) {
      const moved = dragMovedRef.current;
      if (moved) {
        suppressClickRef.current = true;
      }
      const dropDay = resolveDropDay(e.clientX, e.clientY);
      const sess = dragSession;
      const dropTime = resolveDropTime(e.clientY);
      if (dragCaptureRef.current) {
        try {
          dragCaptureRef.current.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        dragCaptureRef.current = null;
      }
      setDragPos(null);
      setDragOrigin(null);
      dragOriginRef.current = null;
      dragMovedRef.current = false;
      setDragSession(null);
      setDragOverDay(null);
      setDragOverTime(null);

      // Only move if pointer actually travelled more than 12px
      if (!moved) return;

      if (dropDay && sess) {
        void handleDropOnDay(dropDay, dropTime, sess);
      }
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragSession, days]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {canEdit && (
            <button
              type="button"
              onClick={() => void handleCopyWeekToNext()}
              disabled={!canCopyWeek || copyWeekBusy}
              title={copyWeekDisabledTitle || undefined}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300"
            >
              {copyWeekBusy ? 'Copying…' : 'Copy to next week'}
            </button>
          )}
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

          <WeeklyTimeGrid
            days={days}
            sessions={sessions}
            canEdit={canEdit}
            clipboardSessionName={copyNotice}
            dragOverDay={dragOverDay}
            dragSession={dragSession}
            suppressClickRef={suppressClickRef}
            onCreateSlot={(slot) =>
              setSessionModal({ mode: 'create', date: slot.date, startTime: slot.startTime })
            }
            onPasteSlot={(slot) => {
              if (!clipboard) return false;
              void handlePaste(slot.date, slot.startTime ? `${slot.startTime}:00` : null);
              return true;
            }}
            onOpenSession={(_dayIso, sessionId) => setSessionModal({ mode: 'edit', sessionId })}
            onStartDrag={(e, session) => {
              if (!canEdit) return;
              e.stopPropagation();
              e.preventDefault();
              dragCaptureRef.current = e.currentTarget;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragOriginRef.current = { x: e.clientX, y: e.clientY };
              setDragOrigin({ x: e.clientX, y: e.clientY });
              setDragPos({ x: e.clientX, y: e.clientY });
              dragMovedRef.current = false;
              setDragSession(session);
            }}
            onContextMenuDay={(e, dayIso) => {
              e.preventDefault();
              e.stopPropagation();
              if (!clipboard) return;
              let slotTime = DEFAULT_AM_TIME;
              if (timeGridRef.current) {
                slotTime = offsetToTimeRef.current(gridOffsetYFromPointer(e.clientY, timeGridRef.current));
              }
              setCtxMenu({
                x: e.clientX,
                y: e.clientY,
                session: null,
                pasteTargetDay: dayIso,
                pasteTargetTime: slotTime,
              });
            }}
            onContextMenuSession={(e, session) => {
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ x: e.clientX, y: e.clientY, session });
            }}
            onOffsetToTime={handleOffsetToTime}
            gridRef={timeGridRef}
          />
        </div>
      )}

      {copyWeekNotice && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-[11px] flex items-center justify-between gap-2 ${
            copyWeekNotice.type === 'success'
              ? 'border-emerald-700/40 bg-emerald-900/30 text-emerald-300'
              : 'border-red-700/40 bg-red-900/30 text-red-300'
          }`}
        >
          <span>{copyWeekNotice.text}</span>
          <button
            type="button"
            className="text-[10px] font-bold uppercase text-gray-400 hover:text-white"
            onClick={() => setCopyWeekNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {copyNotice && (
        <div className="mt-2 rounded-lg border border-[#F97316]/40 bg-[#F97316]/10 px-3 py-2 text-[11px] text-[#F97316] flex items-center justify-between gap-2">
          <span>
            <span className="font-bold">{copyNotice}</span> copied — click any empty slot to paste, or right-click a day
          </span>
          <button
            type="button"
            className="text-[10px] font-bold uppercase text-gray-400 hover:text-white"
            onClick={() => {
              setClipboard(null);
              setCopyNotice(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <WeekNotesEditor planId={plan.id} weekStartIso={weekStartIso} />

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
                onClick={async () => {
                  const id = ctxMenu.session?.id;
                  setCtxMenu(null);
                  if (id) {
                    try {
                      await deleteSession(id);
                    } catch (e) {
                      console.error(e);
                    }
                  }
                }}
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
            {sessionTypeLabel(dragSession.session_type) || 'Session'}
            {dragOverDay
              ? ` → ${days.find((d) => d.iso === dragOverDay)?.label ?? ''}${dragOverTime ? ` ${dragOverTime.slice(0, 5)}` : ''}`
              : ''}
          </span>
        </div>
      )}

      <SessionCreateModal
        open={!!sessionModal}
        slot={
          sessionModal?.mode === 'create'
            ? { date: sessionModal.date, startTime: sessionModal.startTime }
            : null
        }
        session={editSession}
        planId={plan.id}
        defaultTeamId={teamId}
        onClose={() => setSessionModal(null)}
        onSaved={() => void fetchSessions()}
      />
    </div>
  );
}
