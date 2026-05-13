import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { api, tokenStore } from './api';
import { Session, User } from '@supabase/supabase-js';

type AppUser = any; // Our user profile from the users table
interface Ctx {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signUp: (email: string, password: string, name?: string) => Promise<AppUser>;
  signInGoogle: (email: string, name?: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: AppUser) => void;
}

const AuthCtx = createContext<Ctx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null);
      await tokenStore.clear();
      return;
    }

    // Store the Supabase access token for API calls
    await tokenStore.set(session.access_token);

    // Fetch user profile from our backend
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      // If backend hasn't synced yet, create minimal user from session
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        onboarded: false,
      });
    }
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session).finally(() => setLoading(false));
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          await tokenStore.clear();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await syncUser(session);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [syncUser]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Login failed — no session returned');

    await syncUser(data.session);
    return user;
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });
    if (error) throw error;
    if (!data.session) {
      // Email confirmation might be required — try signing in anyway
      // or throw a user-friendly message
      throw new Error(
        'Account created! If email confirmation is enabled, please check your inbox and then sign in.'
      );
    }

    await syncUser(data.session);
    return user;
  };

  const signInGoogle = async (email: string, name?: string) => {
    // For the lightweight Google fallback, use our backend endpoint
    // The frontend still uses tokenStore/api pattern
    const r: any = await api.google(email, name);
    await tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await tokenStore.clear();
    setUser(null);
  };

  const refresh = useCallback(async () => {
    try {
      const t = await tokenStore.get();
      if (!t) {
        // Check if Supabase has a valid session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await syncUser(session);
        } else {
          setUser(null);
        }
        return;
      }
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
      await tokenStore.clear();
    }
  }, [syncUser]);

  return (
    <AuthCtx.Provider value={{ user, loading, signIn, signUp, signInGoogle, signOut, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);