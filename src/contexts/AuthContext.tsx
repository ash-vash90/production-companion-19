import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const SESSION_START_KEY = 'auth_session_start';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, language: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);

  const checkSessionTimeout = () => {
    const sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) return false;
    
    const startTime = parseInt(sessionStart, 10);
    const now = Date.now();
    return now - startTime > SESSION_TIMEOUT_MS;
  };

  const handleExpiredSession = async () => {
    localStorage.removeItem(SESSION_START_KEY);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out expired session:', error);
    }
    toast.info('Session expired', {
      description: 'You have been logged out after 12 hours. Please sign in again.'
    });
  };

  useEffect(() => {
    // Set up auth state listener FIRST (no async in callback!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Synchronous state updates only
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      // Handle session start tracking
      if (event === 'SIGNED_IN' && newSession) {
        // Only set session start if not already set (fresh login)
        if (!localStorage.getItem(SESSION_START_KEY)) {
          localStorage.setItem(SESSION_START_KEY, Date.now().toString());
        }
      }
      
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(SESSION_START_KEY);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (existingSession) {
          // Check if session has timed out
          if (checkSessionTimeout()) {
            handleExpiredSession();
            setSession(null);
            setUser(null);
          } else {
            setSession(existingSession);
            setUser(existingSession.user);
            // Ensure session start is tracked
            if (!localStorage.getItem(SESSION_START_KEY)) {
              localStorage.setItem(SESSION_START_KEY, Date.now().toString());
            }
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error getting session:', error);
        setLoading(false);
      });

    // Set up periodic session timeout check (every 5 minutes)
    sessionCheckRef.current = setInterval(() => {
      if (checkSessionTimeout()) {
        handleExpiredSession();
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
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
    localStorage.removeItem(SESSION_START_KEY);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
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
