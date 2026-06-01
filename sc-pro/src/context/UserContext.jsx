import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getCurrentUser } from '../lib/auth.js';
import {
  getEffectiveTeamId,
  readStoredTeamId,
  writeStoredTeamId,
  clearStoredTeamIds,
} from '../lib/teamScope.js';

const UserContext = createContext(null);

async function loadAvailableTeams(user) {
  if (!user?.orgId) return [];
  let query = supabase
    .from('teams')
    .select('id, name, logo_url, org_id')
    .eq('org_id', user.orgId)
    .order('name');
  if (user.teamIds?.length) {
    query = query.in('id', user.teamIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[UserContext] loadAvailableTeams failed:', error);
    return [];
  }
  return data ?? [];
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [activeTeamId, setActiveTeamIdState] = useState(null);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const syncActiveTeam = useCallback((orgId, teams) => {
    const teamIds = (teams ?? []).map((t) => t.id);
    const stored = readStoredTeamId(orgId);
    const resolved = getEffectiveTeamId(stored, teamIds);
    setActiveTeamIdState(resolved);
    if (orgId && resolved) writeStoredTeamId(orgId, resolved);
  }, []);

  const refreshTeams = useCallback(async (currentUser) => {
    if (!currentUser?.orgId) {
      setAvailableTeams([]);
      setActiveTeamIdState(null);
      return;
    }
    const teams = await loadAvailableTeams(currentUser);
    setAvailableTeams(teams);
    syncActiveTeam(currentUser.orgId, teams);
  }, [syncActiveTeam]);

  const loadUser = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    try {
      if (!silent) setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setUser(null);
        setAvailableTeams([]);
        setActiveTeamIdState(null);
        return;
      }
      setUser(currentUser);
      await refreshTeams(currentUser);
    } catch (err) {
      console.error('[UserContext] loadUser failed:', err);
      setUser(null);
      setAvailableTeams([]);
      setActiveTeamIdState(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [refreshTeams]);

  const setActiveTeamId = useCallback((nextTeamId) => {
    const orgId = user?.orgId;
    setActiveTeamIdState(nextTeamId);
    if (orgId) writeStoredTeamId(orgId, nextTeamId);
  }, [user?.orgId]);

  useEffect(() => {
    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        setAvailableTeams([]);
        setActiveTeamIdState(null);
        clearStoredTeamIds();
        return;
      }
      if (session) {
        void loadUser({ silent: Boolean(userRef.current) });
      }
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refreshUser: loadUser,
        activeTeamId,
        setActiveTeamId,
        availableTeams,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
