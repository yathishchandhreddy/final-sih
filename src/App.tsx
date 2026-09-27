import React, { useState, useEffect } from 'react';
import { RouterProvider, useRouter, getRoleDashboardPath } from './router/RouterContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { RoleGuard } from './components/auth/RoleGuard.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { Sidebar } from './components/common/Sidebar.tsx';
import { Header } from './components/common/Header.tsx';
import { OwnerDashboard } from './components/dashboard/OwnerDashboard.tsx';
import { SubInspectorDashboard } from './components/dashboard/SubInspectorDashboard.tsx';
import { EngineerDashboard } from './components/dashboard/EngineerDashboard.tsx';
import { InspectorDashboard } from './components/dashboard/InspectorDashboard.tsx';
import { AdminDashboard } from './components/dashboard/AdminDashboard.tsx';
import { UsersManagement } from './components/admin/UsersManagement.tsx';
import { InstrumentsList } from './components/instruments/InstrumentsList.tsx';
import { RegisterInstrumentModal } from './components/instruments/RegisterInstrumentModal.tsx';
import { TestPlansList } from './components/testplans/TestPlansList.tsx';
import { TestPlanWorkspace } from './components/testplans/TestPlanWorkspace.tsx';
import { ReportsList } from './components/reports/ReportsList.tsx';
import { ReportViewerModal } from './components/reports/ReportViewerModal.tsx';
import { PublicVerifier } from './components/verify/PublicVerifier.tsx';
import { RuleEngineViewer } from './components/rules/RuleEngineViewer.tsx';
import { AuditTrailViewer } from './components/audit/AuditTrailViewer.tsx';
import { StaffIdentityPage } from './components/biometrics/StaffIdentityPage.tsx';
import { Scale, LogIn } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const { path, navigate } = useRouter();

  const [selectedTestPlanId, setSelectedTestPlanId] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Synchronize URL route with test plan ID if at /testplan/:id
  useEffect(() => {
    const tpMatch = path.match(/^\/testplan\/(.+)$/);
    if (tpMatch) {
      setSelectedTestPlanId(tpMatch[1]);
    } else {
      setSelectedTestPlanId(null);
    }
  }, [path]);

  // Handle Root Redirect and Login Redirect when authenticated
  useEffect(() => {
    if (!loading) {
      if (path === '/' || path === '') {
        if (user) {
          navigate(getRoleDashboardPath(user.role));
        } else {
          navigate('/login');
        }
      } else if (path === '/login' && user) {
        navigate(getRoleDashboardPath(user.role));
      }
    }
  }, [path, user, loading, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse shadow-lg">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-bold text-base">Loading secure session...</h2>
          <p className="text-xs text-slate-400 font-mono">Verifying Metrological System Credentials...</p>
        </div>
      </div>
    );
  }

  // 1. PUBLIC ROUTE: Login Page
  if (path === '/login') {
    if (user) {
      return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse shadow-lg">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <h2 className="font-bold text-base">Redirecting to dashboard...</h2>
            <p className="text-xs text-slate-400 font-mono">Session active</p>
          </div>
        </div>
      );
    }
    return <LoginPage />;
  }

  // 2. PUBLIC ROUTE: Public Certificate Verification (/verify or /verify/:verificationId)
  if (path.startsWith('/verify')) {
    const rawId = path.replace(/^\/verify\/?/, '').trim();
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
        {/* Public Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => navigate(user ? getRoleDashboardPath(user.role) : '/login')}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-xs">
              <Scale className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-900">NAWI-Report</span>
              <span className="ml-2 text-[10px] font-mono text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
                OIML R 76-1:2006 Public Trust Portal
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate(user ? getRoleDashboardPath(user.role) : '/login')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{user ? 'Go to Dashboard' : 'Official Sign In'}</span>
          </button>
        </header>

        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          <PublicVerifier initialVerificationId={rawId} />
        </main>

        <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
          National Legal Metrology Digital Verification Service &bull; Cryptographically Verified (SHA-256)
        </footer>
      </div>
    );
  }

  // 3. PROTECTED ROUTES: Role Dashboards and Modules
  const handleOpenWorkspace = (testPlanId: string) => {
    setSelectedTestPlanId(testPlanId);
    navigate(`/testplan/${testPlanId}`);
  };

  const handleOpenReportModal = (reportId: string) => {
    setSelectedReportId(reportId);
    setIsReportModalOpen(true);
  };

  const handleRegisterSuccess = (instrumentId: string, testPlanId?: string) => {
    setIsRegisterModalOpen(false);
    if (testPlanId) {
      setSelectedTestPlanId(testPlanId);
      navigate(`/testplan/${testPlanId}`);
    } else {
      navigate('/owner/instruments');
    }
  };

  // Render content based on current path
  const renderMainContent = () => {
    // Test Plan Workspace
    if (path.startsWith('/testplan/')) {
      const planId = path.replace(/^\/testplan\//, '') || selectedTestPlanId || '';
      return (
        <TestPlanWorkspace
          testPlanId={planId}
          onBack={() => {
            setSelectedTestPlanId(null);
            navigate(getRoleDashboardPath(user?.role));
          }}
          onOpenReportModal={handleOpenReportModal}
        />
      );
    }

    // Role Dashboard 1: Owner
    if (path === '/owner/dashboard') {
      return (
        <RoleGuard allowedRoles={['APPLICANT', 'ADMIN']}>
          <OwnerDashboard
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </RoleGuard>
      );
    }

    if (path === '/owner/instruments') {
      return (
        <RoleGuard allowedRoles={['APPLICANT', 'ADMIN']}>
          <InstrumentsList
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </RoleGuard>
      );
    }

    if (path === '/owner/applications') {
      return (
        <RoleGuard allowedRoles={['APPLICANT', 'ADMIN']}>
          <TestPlansList
            onSelectPlan={handleOpenWorkspace}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    // Role Dashboard 2: Tester / Sub-Inspector
    if (path === '/tester/dashboard' || path === '/sub-inspector/dashboard' || path === '/sub-inspector/schedule') {
      return (
        <RoleGuard allowedRoles={['SUB_INSPECTOR', 'ADMIN']}>
          <SubInspectorDashboard onOpenWorkspace={handleOpenWorkspace} />
        </RoleGuard>
      );
    }

    if (path === '/tester/inspections' || path === '/sub-inspector/inspections') {
      return (
        <RoleGuard allowedRoles={['SUB_INSPECTOR', 'ADMIN']}>
          <TestPlansList
            onSelectPlan={handleOpenWorkspace}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    // Live Staff Face Identity Verification
    if (
      path === '/identity' ||
      path === '/staff/identity' ||
      path === '/tester/identity' ||
      path === '/tester/identity/enroll' ||
      path === '/inspector/identity' ||
      path === '/admin/identity' ||
      path === '/owner/identity'
    ) {
      return (
        <RoleGuard allowedRoles={['SUB_INSPECTOR', 'INSPECTOR', 'ADMIN', 'ENGINEER', 'APPLICANT', 'APPROVING_AUTHORITY', 'READ_ONLY']}>
          <StaffIdentityPage initialOpenEnroll={path === '/tester/identity/enroll'} />
        </RoleGuard>
      );
    }

    // Role Dashboard 3: Engineer / Calibrator
    if (path === '/engineer/dashboard') {
      return (
        <RoleGuard allowedRoles={['ENGINEER', 'ADMIN']}>
          <EngineerDashboard onOpenWorkspace={handleOpenWorkspace} />
        </RoleGuard>
      );
    }

    if (path === '/engineer/calibration' || path === '/engineer/review') {
      return (
        <RoleGuard allowedRoles={['ENGINEER', 'ADMIN']}>
          <TestPlansList
            onSelectPlan={handleOpenWorkspace}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    // Role Dashboard 4: Inspector
    if (path === '/inspector/dashboard') {
      return (
        <RoleGuard allowedRoles={['INSPECTOR', 'ADMIN']}>
          <InspectorDashboard onOpenWorkspace={handleOpenWorkspace} />
        </RoleGuard>
      );
    }

    if (path === '/inspector/inspections' || path === '/inspector/review') {
      return (
        <RoleGuard allowedRoles={['INSPECTOR', 'ADMIN']}>
          <TestPlansList
            onSelectPlan={handleOpenWorkspace}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    // Role Dashboard 5: Admin / Approving Authority
    if (path === '/admin/dashboard') {
      return (
        <RoleGuard allowedRoles={['ADMIN', 'APPROVING_AUTHORITY']}>
          <AdminDashboard
            onOpenWorkspace={handleOpenWorkspace}
            onOpenReportModal={handleOpenReportModal}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    if (path === '/admin/applications') {
      return (
        <RoleGuard allowedRoles={['ADMIN', 'APPROVING_AUTHORITY', 'INSPECTOR']}>
          <TestPlansList
            onSelectPlan={handleOpenWorkspace}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        </RoleGuard>
      );
    }

    if (path === '/admin/instruments') {
      return (
        <RoleGuard allowedRoles={['ADMIN', 'APPROVING_AUTHORITY', 'INSPECTOR']}>
          <InstrumentsList
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </RoleGuard>
      );
    }

    if (path === '/admin/certificates') {
      return (
        <RoleGuard allowedRoles={['ADMIN', 'APPROVING_AUTHORITY', 'INSPECTOR', 'APPLICANT']}>
          <ReportsList
            onOpenReportModal={handleOpenReportModal}
            onNavigateToVerify={(vId) => navigate(`/verify/${vId}`)}
          />
        </RoleGuard>
      );
    }

    if (path === '/admin/users') {
      return (
        <RoleGuard allowedRoles={['ADMIN']}>
          <UsersManagement />
        </RoleGuard>
      );
    }

    if (path === '/admin/audit') {
      return (
        <RoleGuard allowedRoles={['ADMIN', 'INSPECTOR', 'ENGINEER', 'SUB_INSPECTOR', 'APPLICANT', 'READ_ONLY']}>
          <AuditTrailViewer />
        </RoleGuard>
      );
    }

    // Standard Regulatory Rules
    if (path === '/rules') {
      return <RuleEngineViewer />;
    }

    // Default Fallback: Navigate to user's primary role dashboard
    return (
      <div className="py-12 text-center space-y-3">
        <h3 className="font-bold text-slate-800">Redirecting to your role workspace...</h3>
        <button
          onClick={() => navigate(getRoleDashboardPath(user?.role))}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          Open Dashboard
        </button>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
        {/* Left Dynamic Sidebar */}
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header */}
          <Header
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />

          {/* Scrollable View Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {renderMainContent()}
            </div>
          </main>

          {/* Bottom Metrological Integrity Footer */}
          <footer className="h-12 bg-white border-t border-slate-200 px-4 sm:px-8 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-medium text-slate-700">Digital Legal Metrology System Active</span>
              </div>
              <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-4 sm:pl-6">
                <span>SHA-256 Fingerprint:</span>
                <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                  FIPS 180-4 METROLOGY SEAL
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-semibold text-slate-500">
              <span className="hidden sm:inline">OIML R 76-1:2006 COMPLIANT</span>
              <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-mono font-medium">
                REGULATORY LAB 004
              </span>
            </div>
          </footer>
        </div>

        {/* Modals */}
        <RegisterInstrumentModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={handleRegisterSuccess}
        />

        <ReportViewerModal
          reportId={selectedReportId}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onNavigateToVerify={(verificationId) => navigate(`/verify/${verificationId}`)}
        />
      </div>
    </ProtectedRoute>
  );
};

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
