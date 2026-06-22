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
const ACTIVE_ORG_STORAGE_KEY = 'ais_active_org_id';

function getInitialActiveOrgId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
}

async function loadAvailableTeams(user, orgId) {
  if (!orgId) return [];
  let query = supabase
    .from('teams')
    .select('id, name, logo_url, org_id')
    .eq('org_id', orgId)
    .order('name');
  if (!user?.isSuperuser && user?.teamIds?.length) {
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
  const [activeOrgId, setActiveOrgIdState] = useState(() => getInitialActiveOrgId());
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

  const refreshTeams = useCallback(async (currentUser, orgId) => {
    if (!currentUser || !orgId) {
      setAvailableTeams([]);
      setActiveTeamIdState(null);
      return;
    }
    const scopedUser = { ...currentUser, orgId };
    const teams = await loadAvailableTeams(scopedUser, orgId);
    setAvailableTeams(teams);
    syncActiveTeam(orgId, teams);
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
      let resolvedOrgId;
      if (currentUser.isSuperuser) {
        const localActiveOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
        resolvedOrgId = currentUser.allOrgs?.some((org) => org.id === localActiveOrgId)
          ? localActiveOrgId
          : currentUser.orgId;
        setActiveOrgIdState(resolvedOrgId);
      } else {
        resolvedOrgId = currentUser.orgId ?? null;
        setActiveOrgIdState(resolvedOrgId);
      }
      await refreshTeams(currentUser, resolvedOrgId);
    } catch (err) {
      console.error('[UserContext] loadUser failed:', err);
      setUser(null);
      setActiveOrgIdState(null);
      setAvailableTeams([]);
      setActiveTeamIdState(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [refreshTeams]);

  const setActiveOrgId = useCallback((nextOrgId) => {
    if (nextOrgId) window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, nextOrgId);
    else window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    setActiveOrgIdState(nextOrgId);
    setUser((prev) => {
      if (!prev?.isSuperuser || !nextOrgId) return prev;
      return { ...prev, orgId: nextOrgId };
    });
    void loadUser();
  }, [loadUser]);

  const setActiveTeamId = useCallback((nextTeamId) => {
    const orgId = activeOrgId ?? user?.orgId;
    setActiveTeamIdState(nextTeamId);
    if (orgId) writeStoredTeamId(orgId, nextTeamId);
  }, [activeOrgId, user?.orgId]);

  useEffect(() => {
    if (user?.orgId && !activeOrgId) {
      setActiveOrgIdState(user.orgId);
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, user.orgId);
    }
  }, [user, activeOrgId]);

  useEffect(() => {
    if (!user || !activeOrgId) return;
    void refreshTeams(user, activeOrgId);
  }, [user, activeOrgId, refreshTeams]);

  useEffect(() => {
    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        setActiveOrgIdState(null);
        setAvailableTeams([]);
        setActiveTeamIdState(null);
        window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
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
        activeOrgId,
        setActiveOrgId,
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
