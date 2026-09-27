import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { Menu, PlusCircle, Scale, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenRegisterModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenRegisterModal,
}) => {
  const { user, role, hasRole } = useAuth();
  const { path } = useRouter();

  const getPageInfo = () => {
    if (path.includes('/owner/dashboard')) return { title: 'Owner Weighing Instrument Portal', tag: 'Applicant' };
    if (path.includes('/owner/instruments') || path.includes('/admin/instruments')) return { title: 'Instruments Registry', tag: 'Type Evaluation' };
    if (path.includes('/owner/applications') || path.includes('/admin/applications')) return { title: 'Application Management', tag: 'Clause A.4' };
    if (path.includes('/identity')) return { title: 'Live Staff Face Verification', tag: 'Biometric Match' };
    if (path.includes('/tester/dashboard') || path.includes('/sub-inspector/dashboard')) return { title: 'Tester Dashboard', tag: 'TESTER' };
    if (path.includes('/sub-inspector/schedule')) return { title: 'Field Inspection Schedule', tag: 'Live GPS' };
    if (path.includes('/tester/inspections') || path.includes('/sub-inspector/inspections')) return { title: 'Assigned Field Inspections', tag: 'TESTER' };
    if (path.includes('/engineer/dashboard')) return { title: 'Calibration Specialist Dashboard', tag: 'Standards' };
    if (path.includes('/engineer/calibration')) return { title: 'Standard Weights Queue', tag: 'NABL Certified' };
    if (path.includes('/engineer/review')) return { title: 'Technical Calculation Review', tag: 'MPE Limits' };
    if (path.includes('/inspector/dashboard')) return { title: 'Lead Inspector Dashboard', tag: 'Supervisory' };
    if (path.includes('/inspector/inspections')) return { title: 'Inspection Oversight Queue', tag: 'Audit' };
    if (path.includes('/inspector/review')) return { title: 'Technical Review & Recommendation', tag: 'Compliance' };
    if (path.includes('/admin/dashboard')) return { title: 'National Metrology Directorate', tag: 'Executive' };
    if (path.includes('/admin/users')) return { title: 'Personnel & Access Control', tag: 'Directory' };
    if (path.includes('/admin/audit')) return { title: 'System Traceability Audit Log', tag: 'Immutable' };
    if (path.includes('/admin/certificates')) return { title: 'Digitally Sealed Certificates', tag: 'SHA-256' };
    if (path.includes('/rules')) return { title: 'OIML R 76 Rule Engine', tag: 'Standard v2006' };
    if (path.includes('/testplan')) return { title: 'Metrological Test Workspace', tag: 'Clause A.4 Evaluation' };

    return { title: 'NAWI Type Evaluation', tag: 'OIML R 76-1:2006' };
  };

  const pageInfo = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shadow-2xs">
      {/* Left side: Hamburger on mobile + Title & Tag */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {pageInfo.title}
          </h1>
          <span className="hidden sm:inline-flex px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-mono border border-slate-200 font-medium">
            {pageInfo.tag}
          </span>
        </div>
      </div>

      {/* Right side: Quick Action & Live Badge */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Engine Active</span>
        </div>

        {onOpenRegisterModal && hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN') && (
          <button
            id="header-register-instrument-btn"
            onClick={onOpenRegisterModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Register Instrument</span>
            <span className="sm:hidden">Register</span>
          </button>
        )}
      </div>
    </header>
  );
};
