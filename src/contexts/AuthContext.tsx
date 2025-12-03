import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, language: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSessionExpired = (session: Session | null): boolean => {
  if (!session?.user?.created_at) return false;
  
  // Use the session's iat (issued at) from the access token if available
  // Otherwise fall back to checking against last sign in
  const lastSignIn = session.user.last_sign_in_at;
  if (!lastSignIn) return false;
  
  const signInTime = new Date(lastSignIn).getTime();
  const now = Date.now();
  return now - signInTime > SESSION_TIMEOUT_MS;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSessionExpiry = async (currentSession: Session | null) => {
    if (currentSession && isSessionExpired(currentSession)) {
      await supabase.auth.signOut();
      toast.info('Session expired', { 
        description: 'You have been logged out after 12 hours. Please sign in again.' 
      });
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Check if session is expired
      if (session && await handleSessionExpiry(session)) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Check if session is expired
      if (session && await handleSessionExpiry(session)) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Set up periodic session check (every 5 minutes)
    const intervalId = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession && isSessionExpired(currentSession)) {
        await supabase.auth.signOut();
        toast.info('Session expired', { 
          description: 'You have been logged out after 12 hours. Please sign in again.' 
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, language: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          language: language,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
