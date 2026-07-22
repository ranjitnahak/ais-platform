import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { canEditAttendance, getCurrentUser } from '../lib/auth';
import { logAttendanceChange } from '../lib/attendanceAudit';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';

function presentAthleteState(athlete) {
  return {
    athleteId: athlete.id,
    first_name: athlete.first_name,
    last_name: athlete.last_name,
    full_name: athlete.full_name,
    status: 'present',
    reason: null,
    informed: null,
    note: null,
    recordId: null,
    markedBy: null,
    markedAt: null,
    markedByName: null,
  };
}

function mergeException(state, row, markedByNames) {
  return {
    ...state,
    status: row.status,
    reason: row.reason ?? null,
    informed: row.informed ?? null,
    note: row.note ?? null,
    recordId: row.id,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    markedByName: markedByNames[row.marked_by] ?? null,
  };
}

function snapshotState(row) {
  return {
    status: row.status,
    reason: row.reason,
    informed: row.informed,
    note: row.note,
    recordId: row.recordId,
    markedBy: row.markedBy,
    markedAt: row.markedAt,
    markedByName: row.markedByName,
  };
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function useAttendanceRoster(session, { onToast } = {}) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingAthleteId, setSavingAthleteId] = useState(null);
  const [resetting, setResetting] = useState(false);
  const savedStatesRef = useRef(new Map());

  const canEdit = useMemo(
    () => (session && user ? canEditAttendance(session, user) : false),
    [session, user],
  );

  const isAthleteViewer = user?.role?.toLowerCase() === 'athlete';
  const readOnly = isAthleteViewer || !canEdit;

  const loadRoster = useCallback(async () => {
    if (!session?.id || !effectiveOrgId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentUser = user ?? (await getCurrentUser());
      if (!currentUser) {
        setRows([]);
        return;
      }

      const sessionDate = String(session.session_date).slice(0, 10);
      let athletes = [];

      if (session.athlete_id) {
        const { data, error } = await supabase
          .from('athletes')
          .select('id, first_name, last_name, full_name, org_id, is_active')
          .eq('org_id', effectiveOrgId)
          .eq('id', session.athlete_id)
          .eq('is_active', true)
          .maybeSingle();
        if (error) throw error;
        if (data) athletes = [data];
      } else {
        const { data: sessionLogs, error: logsError } = await supabase
          .from('session_athlete_logs')
          .select(
            'athlete_id, athletes!inner(id, first_name, last_name, full_name, org_id, is_active)',
          )
          .eq('session_id', session.id)
          .eq('org_id', effectiveOrgId)
          .eq('athletes.is_active', true);
        if (logsError) throw logsError;

        const logAthletes = (sessionLogs ?? [])
          .map((row) => (Array.isArray(row.athletes) ? row.athletes[0] : row.athletes))
          .filter(Boolean);

        if (logAthletes.length) {
          athletes = logAthletes;
        } else {
          const { data, error } = await supabase
            .from('athlete_teams')
            .select(
              'athlete_id, joined_at, left_at, athletes!inner(id, first_name, last_name, full_name, org_id, is_active)',
            )
            .eq('team_id', session.team_id)
            .eq('athletes.org_id', effectiveOrgId)
            .eq('athletes.is_active', true)
            .lte('joined_at', `${sessionDate}T23:59:59.999Z`)
            .or(`left_at.is.null,left_at.gte.${sessionDate}`);
          if (error) throw error;

          athletes = (data ?? [])
            .map((row) => (Array.isArray(row.athletes) ? row.athletes[0] : row.athletes))
            .filter(Boolean);
        }
      }

      if (isAthleteViewer && currentUser.athlete_id) {
        athletes = athletes.filter((a) => a.id === currentUser.athlete_id);
      }

      athletes.sort((a, b) =>
        (a.full_name || `${a.first_name} ${a.last_name}`).localeCompare(
          b.full_name || `${b.first_name} ${b.last_name}`,
        ),
      );

      const { data: exceptions, error: excError } = await supabase
        .from('attendance_records')
        .select('id, athlete_id, status, reason, informed, note, marked_by, marked_at')
        .eq('org_id', effectiveOrgId)
        .eq('session_id', session.id);
      if (excError) throw excError;

      const markedByIds = [...new Set((exceptions ?? []).map((r) => r.marked_by).filter(Boolean))];
      let markedByNames = {};
      if (markedByIds.length) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', markedByIds);
        if (usersError) throw usersError;
        markedByNames = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]));
      }

      const exceptionByAthlete = Object.fromEntries(
        (exceptions ?? []).map((row) => [row.athlete_id, row]),
      );

      const merged = athletes.map((athlete) => {
        const base = presentAthleteState(athlete);
        const exc = exceptionByAthlete[athlete.id];
        return exc ? mergeException(base, exc, markedByNames) : base;
      });

      savedStatesRef.current = new Map(
        merged.map((row) => [row.athleteId, snapshotState(row)]),
      );
      setRows(merged);
    } catch (err) {
      console.error('[useAttendanceRoster] loadRoster failed:', err);
      onToast?.(err.message ?? 'Could not load roster.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [session, effectiveOrgId, user, isAthleteViewer, onToast]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const exceptionCount = useMemo(
    () => rows.filter((r) => r.status === 'late' || r.status === 'absent').length,
    [rows],
  );

  const withoutNoticeCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.status === 'late' || r.status === 'absent') && r.informed === false,
      ).length,
    [rows],
  );

  const updateLocalRow = useCallback((athleteId, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.athleteId === athleteId ? { ...row, ...patch } : row)),
    );
  }, []);

  const revertRow = useCallback((athleteId) => {
    const saved = savedStatesRef.current.get(athleteId);
    if (!saved) return;
    setRows((prev) =>
      prev.map((row) => (row.athleteId === athleteId ? { ...row, ...saved } : row)),
    );
  }, []);

  const saveAthleteStatus = useCallback(
    async (athleteId, patch) => {
      if (!session?.id || !effectiveOrgId) return;
      if (readOnly) return;

      const currentUser = user ?? (await getCurrentUser());
      if (!currentUser || !canEditAttendance(session, currentUser)) {
        onToast?.('You cannot edit attendance for this session.', 'error');
        return;
      }

      const prevRow = rows.find((r) => r.athleteId === athleteId);
      if (!prevRow) return;

      const nextStatus = patch.status ?? prevRow.status;
      const nextReason = nextStatus === 'present' ? null : (patch.reason ?? prevRow.reason);
      const nextInformed =
        nextStatus === 'present' ? null : (patch.informed ?? prevRow.informed);
      const nextNote = nextStatus === 'present' ? null : (patch.note ?? prevRow.note);

      updateLocalRow(athleteId, {
        status: nextStatus,
        reason: nextReason,
        informed: nextInformed,
        note: nextNote,
      });

      setSavingAthleteId(athleteId);
      try {
        const { data: existing, error: fetchError } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('org_id', effectiveOrgId)
          .eq('session_id', session.id)
          .eq('athlete_id', athleteId)
          .maybeSingle();
        if (fetchError) throw fetchError;

        const oldData = existing ?? null;

        if (existing?.id) {
          const { error: deleteError } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', existing.id);
          if (deleteError) throw deleteError;
        }

        let newData = null;
        let recordId = existing?.id ?? null;

        if (nextStatus === 'late' || nextStatus === 'absent') {
          const { data: inserted, error: insertError } = await supabase
            .from('attendance_records')
            .insert({
              org_id: effectiveOrgId,
              session_id: session.id,
              athlete_id: athleteId,
              status: nextStatus,
              reason: nextReason,
              informed: nextInformed,
              note: nextNote?.trim() || null,
              marked_by: currentUser.id,
              marked_at: new Date().toISOString(),
            })
            .select('*')
            .single();
          if (insertError) throw insertError;
          newData = inserted;
          recordId = inserted.id;
        }

        await logAttendanceChange({
          userId: currentUser.id,
          recordId,
          oldData,
          newData,
        });

        const markedByName = currentUser.full_name ?? null;
        const saved = {
          status: nextStatus,
          reason: nextReason,
          informed: nextInformed,
          note: nextNote?.trim() || null,
          recordId: newData?.id ?? null,
          markedBy: newData ? currentUser.id : null,
          markedAt: newData?.marked_at ?? null,
          markedByName: newData ? markedByName : null,
        };
        savedStatesRef.current.set(athleteId, saved);
        updateLocalRow(athleteId, saved);
      } catch (err) {
        console.error('[useAttendanceRoster] saveAthleteStatus failed:', err);
        onToast?.(err.message ?? 'Could not save attendance.', 'error');
        revertRow(athleteId);
      } finally {
        setSavingAthleteId(null);
      }
    },
    [
      session,
      effectiveOrgId,
      user,
      readOnly,
      rows,
      updateLocalRow,
      revertRow,
      onToast,
    ],
  );

  const resetAll = useCallback(async () => {
    if (!session?.id || !effectiveOrgId || readOnly) return;
    if (!window.confirm('Reset all athletes to Present? This removes all late/absent marks.')) {
      return;
    }

    const currentUser = user ?? (await getCurrentUser());
    if (!currentUser || !canEditAttendance(session, currentUser)) {
      onToast?.('You cannot edit attendance for this session.', 'error');
      return;
    }

    setResetting(true);
    try {
      const { data: exceptions, error: fetchError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .eq('session_id', session.id);
      if (fetchError) throw fetchError;

      for (const row of exceptions ?? []) {
        const { error: deleteError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('id', row.id);
        if (deleteError) throw deleteError;

        await logAttendanceChange({
          userId: currentUser.id,
          recordId: row.id,
          oldData: row,
          newData: null,
        });
      }

      const presentRows = rows.map((row) => ({
        ...row,
        status: 'present',
        reason: null,
        informed: null,
        note: null,
        recordId: null,
        markedBy: null,
        markedAt: null,
        markedByName: null,
      }));
      savedStatesRef.current = new Map(
        presentRows.map((row) => [row.athleteId, snapshotState(row)]),
      );
      setRows(presentRows);
    } catch (err) {
      console.error('[useAttendanceRoster] resetAll failed:', err);
      onToast?.(err.message ?? 'Could not reset attendance.', 'error');
      await loadRoster();
    } finally {
      setResetting(false);
    }
  }, [session, effectiveOrgId, readOnly, user, rows, onToast, loadRoster]);

  return {
    rows,
    loading,
    canEdit,
    readOnly,
    isAthleteViewer,
    savingAthleteId,
    resetting,
    exceptionCount,
    withoutNoticeCount,
    saveAthleteStatus,
    resetAll,
    refetch: loadRoster,
  };
}
