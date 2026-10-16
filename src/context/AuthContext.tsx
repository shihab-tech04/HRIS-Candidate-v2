import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { candidateAppRedirectTo, candidateRecoveryCallbackError, candidateRecoveryRedirectTo } from '../lib/candidateRecovery';
import { CandidateProfile } from '../types';
import { getMyCandidateProfile, updateCandidateProfile } from '../lib/api';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

interface AuthContextType {
  user: User | null;
  profile: CandidateProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  signIn: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string, fullName?: string) => Promise<{ success: boolean; error?: string; verificationRequired?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  passwordRecoveryRequired: boolean;
  passwordRecoveryError: string | null;
  updateRecoveryPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  cancelPasswordRecovery: () => Promise<void>;
  signInAsDemoCandidate: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordRecoveryRequired, setPasswordRecoveryRequired] = useState(false);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);

  // Initialize auth
  useEffect(() => {
    const callbackError = candidateRecoveryCallbackError(window.location);
    if (callbackError) setPasswordRecoveryError(callbackError);
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryRequired(true);
        if (event === 'SIGNED_OUT') setPasswordRecoveryRequired(false);
        if (session?.user) {
          const u: User = {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata as any
          };
          setUser(u);
          loadProfile(u.id, u.email, session.user.user_metadata?.full_name);
        } else {
          checkLocalSession();
        }
      });

      supabase.auth.getUser().then(({ data: { user: verified }, error }) => {
        if (!error && verified) {
          const session = { user: verified };
          const u: User = {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata as any
          };
          setUser(u);
          loadProfile(u.id, u.email, session.user.user_metadata?.full_name);
        } else {
          checkLocalSession();
        }
        setLoading(false);
      }).catch(() => {
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      checkLocalSession();
      setLoading(false);
    }
  }, []);

  const checkLocalSession = () => {
    if (!DEMO_MODE) {
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }
    try {
      const stored = localStorage.getItem('synesis_candidate_auth_session');
      if (stored) {
        const u = JSON.parse(stored) as User;
        setUser(u);
        loadProfile(u.id, u.email, u.user_metadata?.full_name);
      } else {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setProfileError(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      setProfileError('Unable to restore your candidate profile. Please retry.');
    }
  };

  const loadProfile = async (userId: string, _email: string, _name?: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const verified = await getMyCandidateProfile(userId);
      setProfile(verified);
      if (!verified) setProfileError('Your active candidate profile could not be found. Please retry or contact HR support.');
    } catch (error) {
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : 'Unable to load your candidate profile. Please retry.');
      console.warn('Unable to verify candidate profile', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const signIn = async (email: string, password = '') => {
    if (!password) return { success: false, error: 'Password is required.' };
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.user) {
          const u: User = {
            id: data.user.id,
            email: data.user.email || email,
            user_metadata: data.user.user_metadata as any
          };
          setUser(u);
          if (DEMO_MODE) localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));
          await loadProfile(u.id, u.email, data.user.user_metadata?.full_name);
          return { success: true };
        }
      } catch (err: any) {
        if (!DEMO_MODE) return { success: false, error: 'Sign in failed. Please retry.' };
        console.warn('Demo sign-in fallback', err);
      }
    }

    // Explicit local developer preview, never a production sign-in.
    if (!DEMO_MODE) return { success: false, error: 'Authentication service unavailable.' };
    const u: User = {
      id: 'usr-' + btoa(email).substring(0, 10).toLowerCase(),
      email,
      user_metadata: { full_name: email.split('@')[0].replace('.', ' ') }
    };
    setUser(u);
    localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));
    await loadProfile(u.id, u.email, u.user_metadata?.full_name);
    return { success: true };
  };

  const signUp = async (email: string, password = '', fullName?: string) => {
    if (!password) return { success: false, error: 'Password is required.' };
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: candidateAppRedirectTo(window.location),
            data: { full_name: fullName }
          }
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.user) {
          // Supabase can require email confirmation and return no session.
          // Never treat this as authenticated application access.
          if (!data.session) return {
            success: false,
            verificationRequired: true,
            error: 'Account created. Verify your email before signing in.'
          };
          const u: User = {
            id: data.user.id,
            email: data.user.email || email,
            user_metadata: { full_name: fullName }
          };
          setUser(u);
          if (DEMO_MODE) localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));
          await loadProfile(u.id, u.email, fullName);
          return { success: true };
        }
      } catch (err: any) {
        if (!DEMO_MODE) return { success: false, error: 'Registration failed. Please retry.' };
        console.warn('Demo registration fallback', err);
      }
    }

    // In production an unavailable backend must never create a local candidate identity.
    if (!DEMO_MODE) return { success: false, error: 'Registration service unavailable.' };
    const u: User = {
      id: 'usr-' + btoa(email).substring(0, 10).toLowerCase(),
      email,
      user_metadata: { full_name: fullName || email.split('@')[0] }
    };
    setUser(u);
    localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));
    await loadProfile(u.id, u.email, fullName);
    return { success: true };
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    } else if (!DEMO_MODE) {
      throw new Error('Authentication service unavailable.');
    }
    setPasswordRecoveryRequired(false);
    setPasswordRecoveryError(null);
    localStorage.removeItem('synesis_candidate_auth_session');
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: candidateRecoveryRedirectTo(window.location),
        });
        if (error) return { success: false, error: error.message };
        setPasswordRecoveryError(null);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message || 'Password reset request failed.' };
      }
    }
    return { success: false, error: 'Password reset service is not configured.' };
  };

  const updateRecoveryPassword = async (password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !password) return { success: false, error: 'Password update failed. Please retry.' };
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { success: false, error: error.message };

      // The password change succeeds independently of sign-out availability.
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* Recovery state is cleared below. */ }
      setPasswordRecoveryRequired(false);
      setPasswordRecoveryError(null);
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return { success: true };
    } catch {
      return { success: false, error: 'Password update failed. Please retry.' };
    }
  };

  const cancelPasswordRecovery = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* Clear local recovery state even if Auth is unavailable. */ }
    }
    setPasswordRecoveryRequired(false);
    setPasswordRecoveryError(null);
    setUser(null);
    setProfile(null);
    setProfileLoading(false);
    setProfileError(null);
  };

  const signInAsDemoCandidate = async () => {
    if (!DEMO_MODE) return;
    const demoEmail = 'candidate.demo@synesisit.com.bd';
    const u: User = {
      id: 'user-demo-candidate-123',
      email: demoEmail,
      user_metadata: { full_name: 'Farhan Rahman' }
    };
    setUser(u);
    localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));
    await loadProfile(u.id, demoEmail, 'Farhan Rahman');
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id, user.email, user.user_metadata?.full_name);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        profileError,
        signIn,
        signUp,
        signOut,
        resetPassword,
        passwordRecoveryRequired,
        passwordRecoveryError,
        updateRecoveryPassword,
        cancelPasswordRecovery,
        signInAsDemoCandidate,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
