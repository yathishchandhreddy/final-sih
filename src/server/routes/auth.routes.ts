import { Router } from 'express';
import { supabaseServer, isSupabaseServerConfigured } from '../db/supabaseServer.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';

const router = Router();

const DEMO_ROLES = ['ADMIN', 'INSPECTOR', 'TESTER', 'ENGINEER', 'OWNER'] as const;
type DemoRole = typeof DEMO_ROLES[number];

const DEMO_ACCOUNTS_MAP: Record<DemoRole, string> = {
  ADMIN: 'admin.demo@nawi.gov.in',
  INSPECTOR: 'inspector.demo@nawi.gov.in',
  TESTER: 'tester.demo@nawi.gov.in',
  ENGINEER: 'engineer.demo@nawi.gov.in',
  OWNER: 'owner.demo@nawi.gov.in',
};

const DEMO_PRESENTATION_PASSWORD = process.env.DEMO_ACCOUNTS_PASSWORD || 'NawiDemo2026!Presentation';

// Controlled Demo Login (Authenticates via real Supabase Auth on server side)
router.post('/demo-login', async (req, res) => {
  if (!isSupabaseServerConfigured) {
    console.error('[API] /auth/demo-login error: Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
    return res.status(503).json({
      error: 'Supabase server credentials are not configured in environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  try {
    const { role } = req.body;
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Valid demo role is required.' });
    }

    const canonicalRole = role.trim().toUpperCase() as DemoRole;
    const demoEmail = DEMO_ACCOUNTS_MAP[canonicalRole];

    if (!demoEmail) {
      return res.status(400).json({ error: 'Demonstration account for requested role is not available.' });
    }

    // Authenticate through Supabase Auth using the server-side presentation credentials
    let authResult = await supabaseServer.auth.signInWithPassword({
      email: demoEmail,
      password: DEMO_PRESENTATION_PASSWORD,
    });

    // Auto-provision demo account if missing and service role key is available
    if (authResult.error && supabaseServer.auth?.admin) {
      try {
        console.log(`[API] Attempting auto-provision for demo user: ${demoEmail}`);
        await supabaseServer.auth.admin.createUser({
          email: demoEmail,
          password: DEMO_PRESENTATION_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: `${canonicalRole.charAt(0) + canonicalRole.slice(1).toLowerCase()} Demo`,
            role: canonicalRole,
          },
        });
        // Retry authentication
        authResult = await supabaseServer.auth.signInWithPassword({
          email: demoEmail,
          password: DEMO_PRESENTATION_PASSWORD,
        });
      } catch (provisionErr: any) {
        console.warn('[API] Auto-provision note:', provisionErr?.message);
      }
    }

    const { data, error } = authResult;

    if (error || !data?.session || !data?.user) {
      console.error('[API] /auth/demo-login failed for role:', canonicalRole, error?.message);
      return res.status(401).json({
        error: error?.message?.includes('Invalid login')
          ? 'Demonstration account not yet initialized in Supabase Auth. Please ensure demo accounts are created or provide SUPABASE_SERVICE_ROLE_KEY.'
          : (error?.message || 'Unable to sign in to this demonstration account.'),
      });
    }

    await logAudit({
      user: {
        id: data.user.id,
        user_id: data.user.id,
        email: data.user.email || demoEmail,
        full_name: data.user.user_metadata?.full_name || 'Demo Officer',
        role: canonicalRole,
        roles: [canonicalRole],
        status: 'ACTIVE',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at,
      },
      action: 'DEMO_LOGIN',
      entity_type: 'auth_session',
      entity_id: data.user.id,
      after_value: { role: canonicalRole, email: demoEmail },
      reason: 'Controlled demonstration session established.',
    });

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        role: canonicalRole,
        full_name: data.user.user_metadata?.full_name || 'Demo Officer',
      },
    });
  } catch (err: any) {
    console.error('[API] /auth/demo-login error:', err.message);
    res.status(500).json({ error: err.message || 'Unable to sign in to this demonstration account.' });
  }
});

// Current Authenticated User (Validated via Supabase JWT)
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// List Users (Admin only, queried from Supabase profiles or Auth Admin)
router.get('/users', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  if (!isSupabaseServerConfigured) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  try {
    let enrichedUsers: any[] = [];
    const { data: profiles, error: pError } = await supabaseServer
      .from('profiles')
      .select('id, user_id, email, full_name, role, status, designation, organization, active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (pError || !profiles) {
      // Fallback to Supabase Auth admin API if profiles table is pending migration
      const { data: authUsersData, error: aError } = await supabaseServer.auth.admin.listUsers();
      if (aError) throw aError;
      enrichedUsers = (authUsersData.users || []).map((u: any) => ({
        id: u.id,
        user_id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
        role: u.user_metadata?.role || 'OWNER',
        roles: [u.user_metadata?.role || 'OWNER'],
        status: 'ACTIVE',
        designation: u.user_metadata?.designation || 'Metrology Officer',
        organization: u.user_metadata?.organization || 'Legal Metrology Department',
        created_at: u.created_at,
        updated_at: u.updated_at,
      }));
    } else {
      enrichedUsers = profiles.map((p: any) => ({
        ...p,
        user_id: p.user_id || p.id,
        roles: [p.role || 'OWNER'],
      }));
    }

    res.json(enrichedUsers);
  } catch (err: any) {
    console.error('[API] /auth/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create User (Admin only, provisions in Supabase Auth and public.profiles)
router.post('/users', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  if (!isSupabaseServerConfigured) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  try {
    const { email, password, full_name, designation, organization, role = 'OWNER' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields: email, password, full_name.' });
    }

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        designation,
        organization,
        role,
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Failed to create user in Supabase Auth.' });
    }

    const newUserId = authData.user.id;

    // 2. Upsert into public.profiles if table exists
    try {
      await supabaseServer.from('profiles').upsert(
        {
          id: newUserId,
          user_id: newUserId,
          email: email.trim().toLowerCase(),
          full_name,
          designation,
          organization,
          role,
          status: 'ACTIVE',
          active: true,
        },
        { onConflict: 'id' }
      );
    } catch {
      // Profiles table might be pending migration
    }

    await logAudit({
      user: req.user,
      action: 'USER_CREATED',
      entity_type: 'user',
      entity_id: newUserId,
      after_value: { email, full_name, role },
      reason: 'Administrator provisioned official metrology account in Supabase.',
    });

    res.status(201).json({
      message: 'User created successfully in Supabase Auth.',
      user_id: newUserId,
    });
  } catch (err: any) {
    console.error('[API] /auth/users POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
