import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post } from '../services/api';

const AuthContext = createContext(null);

// Non-sensitive hint (the session itself lives in HTTP-only cookies) so anonymous visitors
// from Instagram don't trigger a /auth/me + refresh round trip on every page view.
const HINT = 'jc_has_session';
const hint = {
  get: () => {
    try {
      return localStorage.getItem(HINT) === '1';
    } catch {
      return true;
    }
  },
  set: (on) => {
    try {
      if (on) localStorage.setItem(HINT, '1');
      else localStorage.removeItem(HINT);
    } catch {
      /* storage unavailable */
    }
  },
};
const isPrivatePath = () => /^\/(admin|influencer|account)(\/|$)/.test(window.location.pathname);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, influencer: null });
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!hint.get() && !isPrivatePath()) {
      setLoading(false);
      return;
    }
    try {
      const res = await get('/auth/me');
      setSession({ user: res.data.user, influencer: res.data.influencer || null });
      hint.set(true);
    } catch {
      setSession({ user: null, influencer: null });
      hint.set(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const onExpired = () => {
      setSession({ user: null, influencer: null });
      hint.set(false);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [loadSession]);

  const login = useCallback(async (email, password, portal) => {
    const res = await post('/auth/login', { email, password, portal });
    setSession({ user: res.data.user, influencer: res.data.influencer || null });
    hint.set(true);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      setSession({ user: null, influencer: null });
      hint.set(false);
    }
  }, []);

  const setUser = useCallback((patch) => setSession((s) => ({ ...s, user: { ...s.user, ...patch } })), []);
  const setInfluencer = useCallback((patch) => setSession((s) => ({ ...s, influencer: { ...s.influencer, ...patch } })), []);

  const value = useMemo(
    () => ({ ...session, loading, login, logout, reload: loadSession, setUser, setInfluencer, setSession }),
    [session, loading, login, logout, loadSession, setUser, setInfluencer]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
