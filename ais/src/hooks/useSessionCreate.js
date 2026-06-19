import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getEffectiveOrgId, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import { useSessionConfig } from '../context/SessionConfigContext';
import { FALLBACK_SESSION_TYPE_OPTIONS, FALLBACK_SESSION_VENUES } from '../lib/sessionTypeStyles';

function parseTimeHHMM(str) {
  const match = String(str || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

function formatTimeHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(timeStr, minutes) {
  const p = parseTimeHHMM(timeStr);
  if (!p) return '08:00';
  let total = p.h * 60 + p.m + minutes;
  total = Math.min(Math.max(total, 0), 23 * 60 + 30);
  return formatTimeHHMM(Math.floor(total / 60), total % 60);
}

export function durationFromTimes(start, end) {
  const s = parseTimeHHMM(start);
  const e = parseTimeHHMM(end);
  if (!s || !e) return 90;
  let diff = e.h * 60 + e.m - (s.h * 60 + s.m);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

export function toDbTime(timeStr) {
  const p = parseTimeHHMM(timeStr);
  if (!p) return '06:30:00';
  return `${formatTimeHHMM(p.h, p.m)}:00`;
}

export function useSessionCreate({ planId = null, defaultTeamId = null } = {}) {
  const { user: contextUser, activeOrgId } = useUser();
  const { sessionTypes, venues, sessionTypeRows, loading: configLoading } = useSessionConfig();

  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('06:30');
  const [endTime, setEndTime] = useState('08:00');
  const [sessionType, setSessionType] = useState('strength');
  const [venue, setVenue] = useState('Gym');
  const [durationPlanned, setDurationPlanned] = useState(90);
  const [durationActual, setDurationActual] = useState('');
  const [rpePlanned, setRpePlanned] = useState(null);
  const [rpeActual, setRpeActual] = useState('');
  const [notes, setNotes] = useState('');
  const [contentItems, setContentItems] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? '');
  const pendingRosterIncludedRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [includedAthleteIds, setIncludedAthleteIds] = useState(new Set());
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const effectiveOrgId = useMemo(() => {
    const user = contextUser;
    if (!user) return null;
    return getEffectiveOrgId(user, activeOrgId);
  }, [contextUser, activeOrgId]);

  useEffect(() => {
    if (defaultTeamId && !sessionId) setSelectedTeamId(defaultTeamId);
  }, [defaultTeamId, sessionId]);

  const loadTeams = useCallback(async () => {
    try {
      setTeamsLoading(true);
      const user = contextUser ?? (await getCurrentUser());
      if (!user || !effectiveOrgId) {
        setTeams([]);
        return;
      }
      const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, user, activeOrgId);
      if (!effectiveTeamIds.length) {
        setTeams([]);
        return;
      }
      const { data: teamRows, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('org_id', effectiveOrgId)
        .in('id', effectiveTeamIds)
        .order('name');
      if (teamError) throw teamError;

      const { data: links, error: linksError } = await supabase
        .from('athlete_teams')
        .select('team_id, athletes!inner(id, is_active)')
        .in('team_id', effectiveTeamIds)
        .eq('athletes.org_id', effectiveOrgId)
        .eq('athletes.is_active', true)
        .is('left_at', null);
      if (linksError) throw linksError;

      const countMap = {};
      for (const link of links ?? []) {
        countMap[link.team_id] = (countMap[link.team_id] ?? 0) + 1;
      }

      setTeams(
        (teamRows ?? []).map((team) => ({
          ...team,
          athleteCount: countMap[team.id] ?? 0,
        })),
      );
    } catch (err) {
      console.error('[useSessionCreate] loadTeams failed:', err);
      setError('Could not load teams.');
    } finally {
      setTeamsLoading(false);
    }
  }, [contextUser, effectiveOrgId, activeOrgId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const loadRoster = useCallback(
    async (teamId) => {
      if (!teamId || !effectiveOrgId) {
        setAthletes([]);
        setIncludedAthleteIds(new Set());
        return;
      }
      try {
        setRosterLoading(true);
        const { data, error: rosterError } = await supabase
          .from('athlete_teams')
          .select('athlete_id, athletes!inner(id, full_name, position, org_id, is_active)')
          .eq('team_id', teamId)
          .eq('athletes.org_id', effectiveOrgId)
          .eq('athletes.is_active', true)
          .is('left_at', null);
        if (rosterError) throw rosterError;

        const roster = (data ?? [])
          .map((row) => {
            const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
            return athlete
              ? { id: athlete.id, full_name: athlete.full_name, position: athlete.position }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        setAthletes(roster);
        const override = pendingRosterIncludedRef.current;
        pendingRosterIncludedRef.current = null;
        if (override !== null) {
          setIncludedAthleteIds(new Set(override));
        } else {
          setIncludedAthleteIds(new Set(roster.map((a) => a.id)));
        }
      } catch (err) {
        console.error('[useSessionCreate] loadRoster failed:', err);
        setError('Could not load athlete roster.');
        setAthletes([]);
        setIncludedAthleteIds(new Set());
      } finally {
        setRosterLoading(false);
      }
    },
    [effectiveOrgId],
  );

  useEffect(() => {
    if (selectedTeamId) void loadRoster(selectedTeamId);
  }, [selectedTeamId, loadRoster]);

  const defaultSessionType = sessionTypes[0]?.value ?? 'strength';
  const defaultVenue = useMemo(() => {
    const typeRow = sessionTypeRows.find((row) => row.key === defaultSessionType);
    if (typeRow?.default_venue && venues.includes(typeRow.default_venue)) return typeRow.default_venue;
    return venues[0] ?? 'Gym';
  }, [sessionTypeRows, sessionTypes, venues, defaultSessionType]);

  const initFromSlot = useCallback(({ date, startTime: slotStart }) => {
    const start = (slotStart || '06:30').slice(0, 5);
    const end = addMinutesToTime(start, 90);
    setSessionId(null);
    pendingRosterIncludedRef.current = null;
    setSessionDate(date);
    setStartTime(start);
    setEndTime(end);
    setDurationPlanned(90);
    setDurationActual('');
    setSessionType(defaultSessionType);
    setVenue(defaultVenue);
    setRpePlanned(null);
    setRpeActual('');
    setNotes('');
    setContentItems([]);
    setError(null);
    setToast(null);
    if (defaultTeamId) setSelectedTeamId(defaultTeamId);
  }, [defaultTeamId, defaultSessionType, defaultVenue]);

  const initFromSession = useCallback(
    async (session) => {
      if (!session?.id) return;
      setSessionId(session.id);
      setSessionDate(session.session_date);
      const start = (session.start_time || '06:30:00').slice(0, 5);
      const end = session.end_time
        ? session.end_time.slice(0, 5)
        : addMinutesToTime(start, session.duration_planned ?? 90);
      setStartTime(start);
      setEndTime(end);
      setDurationPlanned(session.duration_planned ?? durationFromTimes(start, end));
      setDurationActual(session.duration_actual != null ? String(session.duration_actual) : '');
      setSessionType(session.session_type || 'strength');
      setVenue(session.venue ?? 'Gym');
      setRpePlanned(session.rpe_planned ?? null);
      setRpeActual(session.rpe_actual != null ? String(session.rpe_actual) : '');
      setNotes(session.notes ?? '');
      setContentItems(Array.isArray(session.content_items) ? session.content_items : []);
      setError(null);
      setToast(null);

      let includedIds = null;
      if (effectiveOrgId) {
        const { data: logs, error: logsError } = await supabase
          .from('session_athlete_logs')
          .select('athlete_id')
          .eq('session_id', session.id)
          .eq('org_id', effectiveOrgId);
        if (!logsError && logs?.length) {
          includedIds = logs.map((row) => row.athlete_id);
        }
      }
      pendingRosterIncludedRef.current = includedIds;
      setSelectedTeamId(session.team_id || defaultTeamId || '');
    },
    [defaultTeamId, effectiveOrgId],
  );

  const syncDurationFromTimes = useCallback((start, end) => {
    setDurationPlanned(durationFromTimes(start, end));
  }, []);

  const setStartTimeAndSync = useCallback(
    (value) => {
      setStartTime(value);
      syncDurationFromTimes(value, endTime);
    },
    [endTime, syncDurationFromTimes],
  );

  const setEndTimeAndSync = useCallback(
    (value) => {
      setEndTime(value);
      syncDurationFromTimes(startTime, value);
    },
    [startTime, syncDurationFromTimes],
  );

  const setSessionTypeAndVenue = useCallback(
    (value) => {
      setSessionType(value);
      const typeRow = sessionTypeRows.find((row) => row.key === value);
      if (typeRow?.default_venue) setVenue(typeRow.default_venue);
    },
    [sessionTypeRows],
  );

  const selectTeam = useCallback((teamId) => {
    setSelectedTeamId(teamId);
  }, []);

  const toggleAthlete = useCallback((athleteId) => {
    setIncludedAthleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId);
      else next.add(athleteId);
      return next;
    });
  }, []);

  const deselectAllAthletes = useCallback(() => {
    setIncludedAthleteIds(new Set());
  }, []);

  const includedCount = includedAthleteIds.size;
  const totalAthletes = athletes.length;

  const saveSession = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const user = contextUser ?? (await getCurrentUser());
      if (!user?.id || !effectiveOrgId) throw new Error('Not authenticated');
      if (!sessionDate) throw new Error('Session date is required.');
      if (!selectedTeamId) throw new Error('Select a team.');
      if (!user.teamIds?.includes(selectedTeamId) && !user.isSuperuser) {
        throw new Error('You do not have access to the selected team.');
      }

      const includedIds = [...includedAthleteIds];
      const durationActualVal =
        durationActual === '' || durationActual == null ? null : Number(durationActual);
      const rpeActualVal =
        rpeActual === '' || rpeActual == null ? null : Number(rpeActual);

      const sessionPayload = {
        org_id: effectiveOrgId,
        team_id: selectedTeamId,
        session_date: sessionDate,
        start_time: toDbTime(startTime),
        end_time: toDbTime(endTime),
        session_type: sessionType,
        venue,
        rpe_planned: rpePlanned,
        rpe_actual: rpeActualVal,
        duration_planned: Number(durationPlanned) || durationFromTimes(startTime, endTime),
        duration_actual: durationActualVal,
        notes: notes || null,
        plan_id: planId ?? null,
        content_items: contentItems,
      };

      let session;
      if (sessionId) {
        const { data, error: sessionError } = await supabase
          .from('sessions')
          .update(sessionPayload)
          .eq('id', sessionId)
          .eq('org_id', effectiveOrgId)
          .select()
          .single();
        if (sessionError) throw sessionError;
        session = data;

        const { data: existingLogs, error: existingLogsError } = await supabase
          .from('session_athlete_logs')
          .select('id, athlete_id')
          .eq('session_id', sessionId)
          .eq('org_id', effectiveOrgId);
        if (existingLogsError) throw existingLogsError;

        const existingIds = new Set((existingLogs ?? []).map((row) => row.athlete_id));
        const newIds = new Set(includedIds);
        const toRemove = (existingLogs ?? []).filter((row) => !newIds.has(row.athlete_id));
        const toAdd = includedIds.filter((athleteId) => !existingIds.has(athleteId));

        if (toRemove.length) {
          const { error: removeError } = await supabase
            .from('session_athlete_logs')
            .delete()
            .in(
              'id',
              toRemove.map((row) => row.id),
            );
          if (removeError) throw removeError;
        }

        if (toAdd.length) {
          const rows = toAdd.map((athleteId) => ({
            session_id: sessionId,
            athlete_id: athleteId,
            org_id: effectiveOrgId,
            team_id: selectedTeamId,
          }));
          const { error: addError } = await supabase.from('session_athlete_logs').insert(rows);
          if (addError) throw addError;
        }
      } else {
        const { data, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            ...sessionPayload,
            created_by: user.id,
            is_published: false,
          })
          .select()
          .single();
        if (sessionError) throw sessionError;
        session = data;

        if (includedIds.length) {
          const rows = includedIds.map((athleteId) => ({
            session_id: session.id,
            athlete_id: athleteId,
            org_id: effectiveOrgId,
            team_id: selectedTeamId,
          }));

          const { error: logsError } = await supabase.from('session_athlete_logs').insert(rows);
          if (logsError) {
            try {
              const { error: deleteError } = await supabase
                .from('sessions')
                .delete()
                .eq('id', session.id)
                .eq('org_id', effectiveOrgId);
              if (deleteError) throw deleteError;
            } catch (rollbackErr) {
              console.error('[useSessionCreate] rollback failed:', rollbackErr);
            }
            throw logsError;
          }
        }
      }

      return session;
    } catch (err) {
      console.error('[useSessionCreate] saveSession failed:', err);
      const message = err?.message ?? 'Could not save session.';
      setError(message);
      setToast({ type: 'error', message });
      throw err;
    } finally {
      setSaving(false);
    }
  }, [
    contextUser,
    effectiveOrgId,
    sessionDate,
    selectedTeamId,
    startTime,
    endTime,
    sessionType,
    venue,
    rpePlanned,
    rpeActual,
    durationPlanned,
    durationActual,
    notes,
    contentItems,
    planId,
    sessionId,
    includedAthleteIds,
  ]);

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    sessionTypeOptions: sessionTypes.length ? sessionTypes : FALLBACK_SESSION_TYPE_OPTIONS,
    venueOptions: venues.length ? venues : FALLBACK_SESSION_VENUES,
    configLoading,
    sessionDate,
    startTime,
    endTime,
    sessionType,
    venue,
    durationPlanned,
    durationActual,
    rpePlanned,
    rpeActual,
    notes,
    isEditMode: Boolean(sessionId),
    sessionId,
    selectedTeamId,
    teams,
    athletes,
    includedAthleteIds,
    includedCount,
    totalAthletes,
    teamsLoading,
    rosterLoading,
    saving,
    error,
    toast,
    setSessionType: setSessionTypeAndVenue,
    setVenue,
    setDurationPlanned,
    setDurationActual,
    setRpePlanned,
    setRpeActual,
    setNotes,
    setStartTime: setStartTimeAndSync,
    setEndTime: setEndTimeAndSync,
    initFromSlot,
    initFromSession,
    selectTeam,
    toggleAthlete,
    deselectAllAthletes,
    saveSession,
    dismissToast,
  };
}
