import { Request, Response, NextFunction } from 'express';
import { isSupabaseServerConfigured, verifySupabaseToken } from '../db/supabaseServer.ts';
import { UserPayload, RoleName } from '../types/index.ts';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

/**
 * Validates the Supabase Access Token on protected API endpoints.
 * Never uses fake tokens, hardcoded JWT secrets, or demo fallbacks.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or malformed authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.startsWith('demo-token-')) {
    return res.status(401).json({
      error: 'Invalid authentication token. Demo tokens are rejected. A valid Supabase Auth session token is required.',
    });
  }

  if (!isSupabaseServerConfigured) {
    return res.status(503).json({
      error: 'Supabase backend service is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.',
    });
  }

  try {
    const verifiedUser = await verifySupabaseToken(token);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Invalid or expired Supabase authentication session.' });
    }

    req.user = {
      id: verifiedUser.id,
      user_id: verifiedUser.user_id,
      email: verifiedUser.email,
      full_name: verifiedUser.full_name,
      designation: verifiedUser.designation,
      organization: verifiedUser.organization,
      role: verifiedUser.role as RoleName,
      roles: verifiedUser.roles as RoleName[],
      status: verifiedUser.status,
      created_at: verifiedUser.created_at,
      updated_at: verifiedUser.updated_at,
    };

    next();
  } catch (err: any) {
    console.error('[AUTH] Supabase token verification failed:', err.message);
    return res.status(401).json({ error: 'Authentication validation failed.' });
  }
}

/**
 * Enforces Role-Based Access Control (RBAC) on protected endpoints.
 * Supported 5 primary roles: OWNER (APPLICANT), TESTER (SUB_INSPECTOR), ENGINEER, INSPECTOR, ADMIN.
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const userRoles = req.user.roles || [req.user.role];
    const expandedUserRoles = new Set<string>(userRoles);
    if (expandedUserRoles.has('OWNER')) expandedUserRoles.add('APPLICANT');
    if (expandedUserRoles.has('APPLICANT')) expandedUserRoles.add('OWNER');
    if (expandedUserRoles.has('TESTER')) expandedUserRoles.add('SUB_INSPECTOR');
    if (expandedUserRoles.has('SUB_INSPECTOR')) expandedUserRoles.add('TESTER');

    const isAdmin = expandedUserRoles.has('ADMIN') || req.user.role === 'ADMIN';

    const hasRole = allowedRoles.some((r) => {
      if (expandedUserRoles.has(r)) return true;
      if (r === 'OWNER' && expandedUserRoles.has('APPLICANT')) return true;
      if (r === 'APPLICANT' && expandedUserRoles.has('OWNER')) return true;
      if (r === 'TESTER' && expandedUserRoles.has('SUB_INSPECTOR')) return true;
      if (r === 'SUB_INSPECTOR' && expandedUserRoles.has('TESTER')) return true;
      return false;
    });

    if (!hasRole && !isAdmin) {
      return res.status(403).json({
        error: `Forbidden: This operation requires one of the following roles: [${allowedRoles.join(', ')}]. Your account roles: [${userRoles.join(', ')}].`,
      });
    }

    next();
  };
}
