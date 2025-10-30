import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const DEV_MODE_BYPASS = import.meta.env.VITE_DISABLE_AUTH === 'true';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  clearAllAuthData: () => Promise<void>;
  isDevMode: boolean;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'agent';
  created_at: string;
  updated_at: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Create mock dev user
  const createDevUser = (): { user: User; profile: Profile } => {
    const mockUser = {
      id: 'dev-user-00000000-0000-0000-0000-000000000000',
      email: 'dev@biirdee.com',
      user_metadata: {
        full_name: 'Dev User',
        name: 'Dev User',
        avatar_url: null
      }
    } as User;

    const mockProfile: Profile = {
      id: mockUser.id,
      email: mockUser.email!,
      full_name: 'Dev User',
      avatar_url: null,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return { user: mockUser, profile: mockProfile };
  };

  // Simple profile creation from user data
  const createProfileFromUser = (user: User): Profile => {
    // Check if user should be admin based on email
    const isAdminEmail = user.email && ['tech@biirdee.com', 'var@biirdee.com', 'eric@biirdee.com'].includes(user.email);

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: isAdminEmail ? 'admin' : 'agent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  // Clear all auth data
  const clearAllAuthData = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.warn('Error during sign out:', error);
    }
    
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        // If dev mode is enabled, use mock user
        if (DEV_MODE_BYPASS) {
          console.log('🔓 DEV MODE: Auth bypass enabled');
          const { user: mockUser, profile: mockProfile } = createDevUser();
          if (mounted) {
            setUser(mockUser);
            setProfile(mockProfile);
            setLoading(false);
          }
          return;
        }

        // Add a small delay to ensure Supabase is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Check email domain
          if (!session.user.email?.endsWith('@biirdee.com')) {
            await clearAllAuthData();
            return;
          }

          setSession(session);
          setUser(session.user);
          setProfile(createProfileFromUser(session.user));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Don't throw error, just set loading to false
        if (mounted) setLoading(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state change:', event, !!session);
      
      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Check email domain
        if (!session.user.email.endsWith('@biirdee.com')) {
          await clearAllAuthData();
          alert('Access restricted to @biirdee.com email addresses only.');
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setProfile(createProfileFromUser(session.user));
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          hd: 'biirdee.com'
        }
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await clearAllAuthData();
  };

  const refreshProfile = async () => {
    if (user) {
      setProfile(createProfileFromUser(user));
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
    profile,
    refreshProfile,
    clearAllAuthData,
    isDevMode: DEV_MODE_BYPASS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}