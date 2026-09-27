import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import {
  LayoutDashboard,
  Cpu,
  FileCheck2,
  FileText,
  ShieldCheck,
  QrCode,
  Scale,
  Calendar,
  Eye,
  LogOut,
  Users,
  Navigation,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const { user, role, logout } = useAuth();
  const { path, navigate } = useRouter();

  const getNavItems = () => {
    switch (role) {
      case 'OWNER':
      case 'APPLICANT':
        return [
          { path: '/owner/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
          { path: '/owner/instruments', label: 'My Instruments', icon: Cpu },
          { path: '/owner/applications', label: 'Applications Tracking', icon: FileCheck2 },
          { path: '/admin/certificates', label: 'Issued Certificates', icon: FileText },
        ];
      case 'TESTER':
      case 'SUB_INSPECTOR':
        return [
          { path: '/tester/dashboard', label: 'Tester Dashboard', icon: LayoutDashboard },
          { path: '/sub-inspector/inspections', label: 'Assigned Inspections', icon: Navigation },
          { path: '/tester/identity', label: 'Live Face Verification', icon: ShieldCheck },
          { path: '/sub-inspector/schedule', label: 'Field Schedule', icon: Calendar },
        ];
      case 'ENGINEER':
        return [
          { path: '/engineer/dashboard', label: 'Calibration Dashboard', icon: LayoutDashboard },
          { path: '/engineer/calibration', label: 'Standards Queue', icon: Cpu },
          { path: '/engineer/review', label: 'Technical Review', icon: FileCheck2 },
        ];
      case 'INSPECTOR':
        return [
          { path: '/inspector/dashboard', label: 'Inspector Dashboard', icon: LayoutDashboard },
          { path: '/inspector/inspections', label: 'Inspection Queue', icon: Eye },
          { path: '/inspector/identity', label: 'Live Face Verification', icon: ShieldCheck },
          { path: '/inspector/review', label: 'Technical Reviews', icon: FileCheck2 },
        ];
      case 'ADMIN':
      case 'APPROVING_AUTHORITY':
      default:
        return [
          { path: '/admin/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
          { path: '/admin/applications', label: 'Application Queue', icon: FileCheck2 },
          { path: '/admin/instruments', label: 'Instruments Registry', icon: Cpu },
          { path: '/admin/certificates', label: 'Certificates & Seals', icon: FileText },
          { path: '/admin/users', label: 'Personnel & Users', icon: Users },
          { path: '/admin/audit', label: 'Audit Trail', icon: ShieldCheck },
        ];
    }
  };

  const navItems = getNavItems();

  const handleNavClick = (targetPath: string) => {
    navigate(targetPath);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand & Metrology Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => handleNavClick('/')}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-xs">
              <Scale className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
                NAWI-Report
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
                OIML R 76-1:2006
              </p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-3.5 space-y-5 overflow-y-auto">
          {/* Role Navigation */}
          <div>
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {role === 'SUB_INSPECTOR' || role === 'TESTER' ? 'TESTER' : role.replace('_', ' ')} Workspace
            </div>
            <div className="space-y-1 mt-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = path === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standards & Metrology Verification Links */}
          <div>
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Regulatory Tools
            </div>
            <div className="space-y-1 mt-1.5">
              <button
                onClick={() => handleNavClick('/rules')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  path === '/rules'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Scale className="w-4 h-4 text-slate-400" />
                <span>OIML R 76-1 Rules</span>
              </button>

              <button
                onClick={() => handleNavClick('/verify')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  path.startsWith('/verify')
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4 text-slate-400" />
                <span>QR Verification</span>
              </button>
            </div>
          </div>

          {/* System Seal Info Badge */}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Regulatory Integrity</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Cryptographic SHA-256 fingerprint active on approved digital certificates.
            </p>
          </div>
        </nav>

        {/* User Card & Sign Out */}
        <div className="p-3.5 border-t border-slate-800 relative bg-slate-950/60 space-y-2">
          <div className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/40 text-left">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || 'Metrology Officer'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 border border-blue-800 font-mono">
                    {role === 'SUB_INSPECTOR' ? 'TESTER' : role === 'APPLICANT' ? 'OWNER' : role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Live Face Verification Button */}
          {(role === 'SUB_INSPECTOR' || role === 'TESTER' || role === 'INSPECTOR' || role === 'ADMIN') && (
            <button
              onClick={() => handleNavClick(role === 'INSPECTOR' ? '/inspector/identity' : '/tester/identity')}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-200 text-[11px] font-medium transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Face Identity & Verification</span>
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-700/60 hover:border-rose-500/40 hover:bg-rose-950/20 text-slate-400 hover:text-rose-300 text-xs font-medium transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
