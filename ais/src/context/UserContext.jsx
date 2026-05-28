import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgIdState] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser?.isSuperuser) {
        const localActiveOrgId = window.localStorage.getItem('activeOrgId');
        const validOrgId = currentUser.allOrgs?.some((org) => org.id === localActiveOrgId)
          ? localActiveOrgId
          : currentUser.orgId;
        setActiveOrgIdState(validOrgId);
      } else {
        setActiveOrgIdState(currentUser?.orgId ?? null);
      }
    } catch (err) {
      console.error('[UserContext] load failed:', err);
      setUser(null);
      setActiveOrgIdState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveOrgId = useCallback((nextOrgId) => {
    setActiveOrgIdState(nextOrgId);
    setUser((prev) => {
      if (!prev?.isSuperuser || !nextOrgId) return prev;
      return { ...prev, orgId: nextOrgId };
    });
    if (nextOrgId) window.localStorage.setItem('activeOrgId', nextOrgId);
    else window.localStorage.removeItem('activeOrgId');
  }, []);

  useEffect(() => {
    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void loadUser();
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        setActiveOrgIdState(null);
        window.localStorage.removeItem('activeOrgId');
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
  return useContext(UserContext);
}
