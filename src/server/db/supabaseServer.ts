import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseServerConfigured = Boolean(supabaseUrl && serviceRoleKey);

/**
 * Server-side Supabase Client
 * Uses the Service Role Key for administrative operations, token verification, and RLS bypass
 * strictly within the protected Node.js backend.
 * NEVER exposed to the browser or prefixed with VITE_.
 */
export const supabaseServer: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface SupabaseUserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  designation?: string;
  organization?: string;
  role: string;
  roles: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Normalizes input role to one of the 5 canonical roles:
 * OWNER, TESTER, ENGINEER, INSPECTOR, ADMIN.
 */
function normalizeCanonicalRole(rawRole?: string): string {
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
 * Validates a Supabase Bearer JWT token against Supabase Auth service
 * and returns the authenticated user's profile and roles.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseUserProfile | null> {
  if (!isSupabaseServerConfigured) {
    return null;
  }

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error || !data.user) {
      console.warn('[SupabaseAuth] Token validation error:', error?.message);
      return null;
    }

    const authUser = data.user;

    // Fetch user profile and roles from Supabase database if available
    let profile: any = null;
    try {
      const { data: pData } = await supabaseServer
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      profile = pData;
    } catch {
      // Profiles table might be pending migration
    }

    let roleRecords: any[] = [];
    try {
      const { data: rData } = await supabaseServer
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', authUser.id);
      if (rData) roleRecords = rData;
    } catch {
      // Roles table might be pending migration
    }

    const dbRoles: string[] = roleRecords
      .map((r: any) => r.roles?.name)
      .filter(Boolean);

    const rawRole =
      profile?.role ||
      dbRoles[0] ||
      (authUser.user_metadata?.role as string) ||
      'OWNER';

    const canonicalRole = normalizeCanonicalRole(rawRole);

    // Expand aliases for seamless RBAC across endpoints
    const rolesSet = new Set<string>([canonicalRole, ...dbRoles]);
    if (canonicalRole === 'OWNER') rolesSet.add('APPLICANT');
    if (canonicalRole === 'TESTER') rolesSet.add('SUB_INSPECTOR');
    if (canonicalRole === 'APPLICANT') rolesSet.add('OWNER');
    if (canonicalRole === 'SUB_INSPECTOR') rolesSet.add('TESTER');

    const rolesList = Array.from(rolesSet);

    return {
      id: authUser.id,
      user_id: authUser.id,
      email: authUser.email || profile?.email || '',
      full_name:
        profile?.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'User',
      designation:
        profile?.designation ||
        authUser.user_metadata?.designation ||
        'Metrology Officer',
      organization:
        profile?.organization ||
        authUser.user_metadata?.organization ||
        'Legal Metrology Department',
      role: canonicalRole,
      roles: rolesList,
      status: profile?.status || (profile?.active === false ? 'INACTIVE' : 'ACTIVE'),
      created_at: profile?.created_at || authUser.created_at || new Date().toISOString(),
      updated_at: profile?.updated_at || authUser.updated_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[SupabaseAuth] Exception during token verification:', err.message);
    return null;
  }
}
