import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

function sessionNameForDate(dateStr) {
  return `Assessment — ${dateStr}`;
}

/**
 * Manages assessment_sessions fetch-or-create per (org_id, team_id, assessed_on).
 * Returns stable callbacks with an in-memory session cache.
 */
export function useAssessmentSessions({ orgId, teamId, userId }) {
  const cacheRef = useRef(new Map());

  const loadSessionsForDates = useCallback(
    async (dates) => {
      const unique = [...new Set((dates ?? []).filter(Boolean))];
      if (!orgId || !teamId || !unique.length) return cacheRef.current;

      const missing = unique.filter((d) => !cacheRef.current.has(d));
      if (!missing.length) return cacheRef.current;

      try {
        const { data, error } = await supabase
          .from('assessment_sessions')
          .select('id, assessed_on')
          .eq('org_id', orgId)
          .eq('team_id', teamId)
          .in('assessed_on', missing);
        if (error) throw error;

        for (const row of data ?? []) {
          const key = String(row.assessed_on).slice(0, 10);
          cacheRef.current.set(key, row.id);
        }
      } catch (err) {
        console.error('[useAssessmentSessions] loadSessionsForDates failed:', err);
        throw err;
      }

      return cacheRef.current;
    },
    [orgId, teamId],
  );

  const ensureSession = useCallback(
    async (dateStr) => {
      if (!orgId || !teamId || !dateStr) {
        throw new Error('Missing org, team, or date for assessment session.');
      }

      const key = String(dateStr).slice(0, 10);
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key);
      }

      try {
        const { data: existing, error: fetchError } = await supabase
          .from('assessment_sessions')
          .select('id')
          .eq('org_id', orgId)
          .eq('team_id', teamId)
          .eq('assessed_on', key)
          .maybeSingle();
        if (fetchError) throw fetchError;

        if (existing?.id) {
          cacheRef.current.set(key, existing.id);
          return existing.id;
        }

        const { data: created, error: insertError } = await supabase
          .from('assessment_sessions')
          .insert({
            org_id: orgId,
            team_id: teamId,
            assessed_on: key,
            name: sessionNameForDate(key),
            created_by: userId ?? null,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;

        cacheRef.current.set(key, created.id);
        return created.id;
      } catch (err) {
        console.error('[useAssessmentSessions] ensureSession failed:', err);
        throw err;
      }
    },
    [orgId, teamId, userId],
  );

  const clearCache = useCallback(() => {
    cacheRef.current = new Map();
  }, []);

  const getSessionId = useCallback((dateStr) => {
    const key = String(dateStr).slice(0, 10);
    return cacheRef.current.get(key) ?? null;
  }, []);

  return {
    ensureSession,
    loadSessionsForDates,
    clearCache,
    getSessionId,
  };
}
