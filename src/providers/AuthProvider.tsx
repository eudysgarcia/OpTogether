import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { useBackend } from '../store/backend';

type AuthState = { session: Session | null; loading: boolean; recovering: boolean; setRecovering: (v: boolean) => void };

const AuthContext = createContext<AuthState>({ session: null, loading: true, recovering: false, setRecovering: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const url = useBackend((s) => s.url);
  const anonKey = useBackend((s) => s.anonKey);
  const hydrated = useBackend((s) => s.hydrated);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const noBackend = hydrated && (!url || !anonKey);

  useEffect(() => {
    if (!hydrated || !url || !anonKey) return;
    const sb = getSupabase();
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [url, anonKey, hydrated]);

  return (
    <AuthContext.Provider value={{ session: noBackend ? null : session, loading: !hydrated || (!noBackend && loading), recovering, setRecovering }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
