import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, UserProfile } from '../types.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.ts';
import { api, setSupabaseSessionToken, clearSupabaseSessionToken } from '../api/client.ts';

interface AuthContextType {
  user: User | null;
  role: RoleName;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (role: 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER') => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Normalizes input role to one of the 5 canonical roles:
 * OWNER, TESTER, ENGINEER, INSPECTOR, ADMIN.
 */
function normalizeCanonicalRole(rawRole?: string): RoleName {
  const upper = (rawRole || '').trim().toUpperCase();
  switch (upper) {
    case 'OWNER':
    case 'APPLICANT':
      return 'OWNER';
    case 'TESTER':
    case 'SUB_INSPECTOR':
      return 'TESTER';
    case 'ENGINEER':
      return 'ENGINEER';
    case 'INSPECTOR':
      return 'INSPECTOR';
    case 'ADMIN':
    case 'APPROVING_AUTHORITY':
      return 'ADMIN';
    default:
      return 'OWNER';
  }
}

/**
 * Expands a role to its alias set for RBAC compatibility across the application.
 */
function getRoleAliases(canonicalRole: RoleName): RoleName[] {
  const set = new Set<RoleName>([canonicalRole]);
  if (canonicalRole === 'OWNER') set.add('APPLICANT');
  if (canonicalRole === 'TESTER') set.add('SUB_INSPECTOR');
  if (canonicalRole === 'APPLICANT') set.add('OWNER');
  if (canonicalRole === 'SUB_INSPECTOR') set.add('TESTER');
  return Array.from(set);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync Supabase Auth User with application user profile and roles
  const syncSupabaseUser = async (sessionToken: string | null, authUser: any): Promise<User | null> => {
    if (!sessionToken || !authUser) {
      setUser(null);
      clearSupabaseSessionToken();
      return null;
    }

    setSupabaseSessionToken(sessionToken);

    // 1. Attempt to query backend verification endpoint
    let backendUser: User | null = null;
    try {
      const meResponse = await api.getCurrentUser();
      if (meResponse?.user) {
        backendUser = meResponse.user;
      }
    } catch {
      // Backend may be starting or offline; proceed to direct Supabase profile resolution
    }

    // 2. Query Supabase profiles table
    let dbProfile: any = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!error && data) {
        dbProfile = data;
      }
    } catch {
      // Profiles table might be pending migration or RLS restricted
    }

    // 3. Resolve user profile attributes
    const rawRole =
      backendUser?.role ||
      dbProfile?.role ||
      authUser.user_metadata?.role ||
      'OWNER';

    const canonicalRole = normalizeCanonicalRole(rawRole);
    const roleAliases = getRoleAliases(canonicalRole);

    const userProfile: UserProfile = {
      id: authUser.id,
      user_id: authUser.id,
      full_name:
        backendUser?.full_name ||
        dbProfile?.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'Metrology Officer',
      email: authUser.email || dbProfile?.email || backendUser?.email || '',
      role: canonicalRole,
      status: dbProfile?.status || (dbProfile?.active === false ? 'INACTIVE' : 'ACTIVE'),
      created_at: dbProfile?.created_at || authUser.created_at || new Date().toISOString(),
      updated_at: dbProfile?.updated_at || authUser.updated_at || new Date().toISOString(),
      designation:
        backendUser?.designation ||
        dbProfile?.designation ||
        authUser.user_metadata?.designation ||
        'Metrology Officer',
      organization:
        backendUser?.organization ||
        dbProfile?.organization ||
        authUser.user_metadata?.organization ||
        'Legal Metrology Department',
    };

    const resolvedUser: User = {
      id: userProfile.id,
      user_id: userProfile.user_id,
      email: userProfile.email,
      full_name: userProfile.full_name,
      designation: userProfile.designation,
      organization: userProfile.organization,
      role: userProfile.role,
      roles: roleAliases,
      status: userProfile.status,
      created_at: userProfile.created_at,
      updated_at: userProfile.updated_at,
    };

    setUser(resolvedUser);
    return resolvedUser;
  };

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[SupabaseAuth] getSession:', error.message);
        }

        if (session && mounted) {
          await syncSupabaseUser(session.access_token, session.user);
        } else if (mounted) {
          setUser(null);
          clearSupabaseSessionToken();
        }
      } catch (err) {
        console.error('[SupabaseAuth] Session initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    // Listen to Supabase auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        clearSupabaseSessionToken();
      } else if (session) {
        await syncSupabaseUser(session.access_token, session.user);
      }
    });

    const handleExpired = () => {
      setUser(null);
      clearSupabaseSessionToken();
      supabase.auth.signOut();
    };

    window.addEventListener('auth:expired', handleExpired);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase authentication is not configured.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });

    if (error || !data.session || !data.user) {
      // User-friendly error message, never exposing backend or technical internals
      throw new Error('Invalid email or password.');
    }

    const resolved = await syncSupabaseUser(data.session.access_token, data.user);
    if (!resolved) {
      throw new Error('Invalid email or password.');
    }
    return resolved;
  };

  const demoLogin = async (role: 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER'): Promise<User> => {
    if (!isSupabaseConfigured) {
      throw new Error('Demonstration account unavailable. Please contact the administrator.');
    }

    const res = await api.demoLogin(role);
    if (!res?.session?.access_token || !res?.session?.refresh_token) {
      throw new Error('Demonstration account unavailable. Please contact the administrator.');
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    });

    if (error || !data.session || !data.user) {
      throw new Error('Demonstration account unavailable. Please contact the administrator.');
    }

    const resolved = await syncSupabaseUser(data.session.access_token, data.user);
    if (!resolved) {
      throw new Error('Demonstration account unavailable. Please contact the administrator.');
    }
    return resolved;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      clearSupabaseSessionToken();
      setUser(null);
    }
  };

  const hasRole = (...roles: RoleName[]): boolean => {
    if (!user) return false;
    const userRoles = user.roles || [user.role];
    if (userRoles.includes('ADMIN') || user.role === 'ADMIN') return true;

    // Check matches including canonical and alias forms
    const expandedUserRoles = new Set<string>(userRoles);
    if (expandedUserRoles.has('OWNER')) expandedUserRoles.add('APPLICANT');
    if (expandedUserRoles.has('APPLICANT')) expandedUserRoles.add('OWNER');
    if (expandedUserRoles.has('TESTER')) expandedUserRoles.add('SUB_INSPECTOR');
    if (expandedUserRoles.has('SUB_INSPECTOR')) expandedUserRoles.add('TESTER');

    return roles.some((r) => {
      if (expandedUserRoles.has(r)) return true;
      if (r === 'OWNER' && expandedUserRoles.has('APPLICANT')) return true;
      if (r === 'APPLICANT' && expandedUserRoles.has('OWNER')) return true;
      if (r === 'TESTER' && expandedUserRoles.has('SUB_INSPECTOR')) return true;
      if (r === 'SUB_INSPECTOR' && expandedUserRoles.has('TESTER')) return true;
      return false;
    });
  };

  const primaryRole: RoleName = user?.role || 'OWNER';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: primaryRole,
        loading,
        login,
        demoLogin,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
