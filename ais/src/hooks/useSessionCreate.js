import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getEffectiveOrgId, resolveOrgTeamScope } from '../lib/orgScope';
import { useUser } from '../context/UserContext';
import { SESSION_TYPE_OPTIONS, SESSION_VENUES } from '../lib/sessionTypeStyles';

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
  total = Math.min(Math.max(total, 5 * 60), 22 * 60);
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

  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('06:30');
  const [endTime, setEndTime] = useState('08:00');
  const [sessionType, setSessionType] = useState('strength');
  const [venue, setVenue] = useState('Gym');
  const [durationPlanned, setDurationPlanned] = useState(90);
  const [durationActual, setDurationActual] = useState('');
  const [rpePlanned, setRpePlanned] = useState(null);
  const [notes, setNotes] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? '');
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
    if (defaultTeamId) setSelectedTeamId(defaultTeamId);
  }, [defaultTeamId]);

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
        .select('team_id, athletes!inner(id)')
        .in('team_id', effectiveTeamIds)
        .eq('athletes.org_id', effectiveOrgId)
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
          .select('athlete_id, athletes!inner(id, full_name, position, org_id)')
          .eq('team_id', teamId)
          .eq('athletes.org_id', effectiveOrgId)
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
        setIncludedAthleteIds(new Set(roster.map((a) => a.id)));
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

  const initFromSlot = useCallback(({ date, startTime: slotStart }) => {
    const start = (slotStart || '06:30').slice(0, 5);
    const end = addMinutesToTime(start, 90);
    setSessionDate(date);
    setStartTime(start);
    setEndTime(end);
    setDurationPlanned(90);
    setDurationActual('');
    setSessionType('strength');
    setVenue('Gym');
    setRpePlanned(null);
    setNotes('');
    setError(null);
    setToast(null);
    if (defaultTeamId) setSelectedTeamId(defaultTeamId);
  }, [defaultTeamId]);

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

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          org_id: effectiveOrgId,
          team_id: selectedTeamId,
          session_date: sessionDate,
          start_time: toDbTime(startTime),
          end_time: toDbTime(endTime),
          session_type: sessionType,
          venue,
          rpe_planned: rpePlanned,
          duration_planned: Number(durationPlanned) || durationFromTimes(startTime, endTime),
          duration_actual: durationActualVal,
          notes: notes || null,
          created_by: user.id,
          is_published: false,
          plan_id: planId ?? null,
          content_items: [],
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

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
    durationPlanned,
    durationActual,
    notes,
    planId,
    includedAthleteIds,
  ]);

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    sessionTypeOptions: SESSION_TYPE_OPTIONS,
    venueOptions: SESSION_VENUES,
    sessionDate,
    startTime,
    endTime,
    sessionType,
    venue,
    durationPlanned,
    durationActual,
    rpePlanned,
    notes,
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
    setSessionType,
    setVenue,
    setDurationPlanned,
    setDurationActual,
    setRpePlanned,
    setNotes,
    setStartTime: setStartTimeAndSync,
    setEndTime: setEndTimeAndSync,
    initFromSlot,
    selectTeam,
    toggleAthlete,
    deselectAllAthletes,
    saveSession,
    dismissToast,
  };
}
