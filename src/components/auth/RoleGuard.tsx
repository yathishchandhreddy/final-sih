import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { RoleName } from '../../types.ts';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: RoleName[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, role, hasRole, logout } = useAuth();
  const { navigate, getRoleDashboardPath } = useRouter();

  if (!user) {
    return null;
  }

  const isAllowed = hasRole(...allowedRoles);

  if (!isAllowed) {
    const dashboardPath = getRoleDashboardPath(role);

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-lg space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Your active persona (<strong className="font-semibold text-slate-800">{role}</strong>) does not have permission to access this legal metrology section.
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Authorized roles: [{allowedRoles.join(', ')}]
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(dashboardPath)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to My Dashboard
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign in as another role
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
