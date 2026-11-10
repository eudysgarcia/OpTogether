import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/api';
import type { Session } from '../lib/session';
import { queryClient } from '../lib/queryClient';
import { useBackend } from '../store/backend';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const url = useBackend((s) => s.url);
  const hydrated = useBackend((s) => s.hydrated);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const noBackend = hydrated && !url;

  useEffect(() => {
    if (!hydrated || !url) return;
    let mounted = true;
    auth.getSession().then((s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });
    const off = auth.onChange((s, event) => {
      setSession(s);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      mounted = false;
      off();
    };
  }, [url, hydrated]);

  return (
    <AuthContext.Provider value={{ session: noBackend ? null : session, loading: !hydrated || (!noBackend && loading) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
