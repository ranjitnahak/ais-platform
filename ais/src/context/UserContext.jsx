import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

const UserContext = createContext(null);
const ACTIVE_ORG_STORAGE_KEY = 'ais_active_org_id';
function getInitialActiveOrgId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgIdState] = useState(() => getInitialActiveOrgId());

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        console.error('[UserContext] loadUser failed: getCurrentUser returned null');
        setUser(null);
        return;
      }
      setUser(currentUser);
      if (currentUser.isSuperuser) {
        const localActiveOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
        const validOrgId = currentUser.allOrgs?.some((org) => org.id === localActiveOrgId)
          ? localActiveOrgId
          : currentUser.orgId;
        setActiveOrgIdState(validOrgId);
      } else {
        setActiveOrgIdState(currentUser.orgId ?? null);
      }
    } catch (err) {
      console.error('[UserContext] loadUser failed:', err);
      setUser(null);
      setActiveOrgIdState(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (user?.orgId && !activeOrgId) {
      setActiveOrgIdState(user.orgId);
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, user.orgId);
    }
  }, [user, activeOrgId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        setActiveOrgIdState(null);
        window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        return;
      }
      if (session) {
        void loadUser();
        return;
      }
      if (event === 'INITIAL_SESSION') {
        setUser(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: loadUser, activeOrgId, setActiveOrgId }}>
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
