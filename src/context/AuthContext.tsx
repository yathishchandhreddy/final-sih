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
    const canonicalRole = role.trim().toUpperCase() as 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER';
    const DEMO_CREDENTIALS: Record<string, { email: string; fullName: string; designation: string; organization: string; role: RoleName; roles: RoleName[] }> = {
      ADMIN: {
        email: 'admin.demo@nawi.gov.in',
        fullName: 'K. V. Ramanathan',
        designation: 'Director & Approving Authority',
        organization: 'Ministry of Consumer Affairs, Legal Metrology Div',
        role: 'ADMIN',
        roles: ['ADMIN', 'APPROVING_AUTHORITY'],
      },
      INSPECTOR: {
        email: 'inspector.demo@nawi.gov.in',
        fullName: 'Dr. Sunita Rao',
        designation: 'Chief Legal Metrology Inspector',
        organization: 'Directorate of Legal Metrology',
        role: 'INSPECTOR',
        roles: ['INSPECTOR'],
      },
      TESTER: {
        email: 'tester.demo@nawi.gov.in',
        fullName: 'Amit Patel',
        designation: 'Field Legal Metrology Tester',
        organization: 'Regional Metrology Testing Laboratory',
        role: 'SUB_INSPECTOR',
        roles: ['SUB_INSPECTOR', 'TESTER'],
      },
      ENGINEER: {
        email: 'engineer.demo@nawi.gov.in',
        fullName: 'Vikram Sengupta',
        designation: 'Senior Calibration Engineer',
        organization: 'National Calibration & Standards Wing',
        role: 'ENGINEER',
        roles: ['ENGINEER'],
      },
      OWNER: {
        email: 'owner.demo@nawi.gov.in',
        fullName: 'Rajesh Sharma',
        designation: 'Managing Director & Authorized Owner',
        organization: 'Precision Instruments Pvt Ltd',
        role: 'APPLICANT',
        roles: ['APPLICANT', 'OWNER'],
      },
    };

    const demoProfile = DEMO_CREDENTIALS[canonicalRole] || DEMO_CREDENTIALS.ADMIN;
    const DEMO_PRESENTATION_PASSWORD = 'NawiDemo2026!Presentation';

    // 1. Try server-side API demo login first
    try {
      const res = await api.demoLogin(canonicalRole);
      if (res?.session?.access_token && res?.session?.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        });

        if (!error && data?.session && data?.user) {
          const resolved = await syncSupabaseUser(data.session.access_token, data.user);
          if (resolved) return resolved;
        }
      }
    } catch (serverErr: any) {
      console.warn('[DemoLogin] Server-side API demo login bypassed, trying direct client auth:', serverErr?.message);
    }

    // 2. Direct client-side Supabase Auth fallback
    if (isSupabaseConfigured) {
      try {
        let authResult = await supabase.auth.signInWithPassword({
          email: demoProfile.email,
          password: DEMO_PRESENTATION_PASSWORD,
        });

        if (authResult.error) {
          // If user does not exist yet in Supabase Auth, attempt sign up
          authResult = await supabase.auth.signUp({
            email: demoProfile.email,
            password: DEMO_PRESENTATION_PASSWORD,
            options: {
              data: {
                full_name: demoProfile.fullName,
                role: canonicalRole,
              },
            },
          });
        }

        if (authResult.data?.session && authResult.data?.user) {
          const resolved = await syncSupabaseUser(authResult.data.session.access_token, authResult.data.user);
          if (resolved) return resolved;
        }
      } catch (clientAuthErr: any) {
        console.warn('[DemoLogin] Client Supabase Auth note:', clientAuthErr?.message);
      }
    }

    // 3. Resilient Local Demo Session Fallback (Guarantees zero-block demonstration on any host)
    const fallbackUser: User = {
      id: `usr-demo-${canonicalRole.toLowerCase()}`,
      user_id: `usr-demo-${canonicalRole.toLowerCase()}`,
      email: demoProfile.email,
      full_name: demoProfile.fullName,
      designation: demoProfile.designation,
      organization: demoProfile.organization,
      role: demoProfile.role,
      roles: demoProfile.roles,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSupabaseSessionToken(`demo-session-token-${canonicalRole.toLowerCase()}`);
    setUser(fallbackUser);
    return fallbackUser;
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
