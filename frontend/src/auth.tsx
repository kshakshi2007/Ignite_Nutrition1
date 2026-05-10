import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from './api';

type User = any;
interface Ctx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, name?: string) => Promise<User>;
  signInGoogle: (email: string, name?: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthCtx = createContext<Ctx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await tokenStore.get();
      if (!t) { setUser(null); return; }
      const me = await api.me();
      setUser(me);
    } catch { setUser(null); await tokenStore.clear(); }
  }, []);

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const r: any = await api.login(email, password);
    await tokenStore.set(r.token); setUser(r.user); return r.user;
  };
  const signUp = async (email: string, password: string, name?: string) => {
    const r: any = await api.register(email, password, name);
    await tokenStore.set(r.token); setUser(r.user); return r.user;
  };
  const signInGoogle = async (email: string, name?: string) => {
    const r: any = await api.google(email, name);
    await tokenStore.set(r.token); setUser(r.user); return r.user;
  };
  const signOut = async () => { await tokenStore.clear(); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, loading, signIn, signUp, signInGoogle, signOut, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
