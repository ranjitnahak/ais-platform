import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import {
  loadSessionTypeOptions,
  loadSessionVenueOptions,
  toSessionTypeDropdownOptions,
  toVenueDropdownOptions,
} from '../lib/loadSessionConfig';
import { sessionTypeLabel as resolveSessionTypeLabel, sessionTypeStyles } from '../lib/sessionTypeStyles';

const SessionConfigContext = createContext(null);

export function SessionConfigProvider({ children }) {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);
  const [sessionTypeRows, setSessionTypeRows] = useState([]);
  const [venueRows, setVenueRows] = useState([]);
  const [allSessionTypeRows, setAllSessionTypeRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!effectiveOrgId) {
      setSessionTypeRows([]);
      setVenueRows([]);
      setAllSessionTypeRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [types, venues, allTypes] = await Promise.all([
        loadSessionTypeOptions(supabase, effectiveOrgId),
        loadSessionVenueOptions(supabase, effectiveOrgId),
        loadSessionTypeOptions(supabase, effectiveOrgId, { includeInactive: true }),
      ]);
      setSessionTypeRows(types);
      setVenueRows(venues);
      setAllSessionTypeRows(allTypes);
    } catch (err) {
      console.error('[SessionConfigProvider] reload failed:', err);
      setSessionTypeRows([]);
      setVenueRows([]);
      setAllSessionTypeRows([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sessionTypes = useMemo(
    () => toSessionTypeDropdownOptions(sessionTypeRows),
    [sessionTypeRows],
  );

  const venues = useMemo(() => toVenueDropdownOptions(venueRows), [venueRows]);

  const sessionTypeLabelFn = useCallback(
    (key) => resolveSessionTypeLabel(key, allSessionTypeRows.length ? allSessionTypeRows : sessionTypeRows),
    [allSessionTypeRows, sessionTypeRows],
  );

  const value = useMemo(
    () => ({
      sessionTypes,
      venues,
      sessionTypeRows,
      venueRows,
      allSessionTypeRows,
      loading,
      reload,
      sessionTypeLabel: sessionTypeLabelFn,
      sessionTypeStyles,
    }),
    [
      sessionTypes,
      venues,
      sessionTypeRows,
      venueRows,
      allSessionTypeRows,
      loading,
      reload,
      sessionTypeLabelFn,
    ],
  );

  return (
    <SessionConfigContext.Provider value={value}>{children}</SessionConfigContext.Provider>
  );
}

export function useSessionConfig() {
  const ctx = useContext(SessionConfigContext);
  if (!ctx) {
    throw new Error('useSessionConfig must be used within SessionConfigProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside provider during tests. */
export function useSessionConfigOptional() {
  return useContext(SessionConfigContext);
}
