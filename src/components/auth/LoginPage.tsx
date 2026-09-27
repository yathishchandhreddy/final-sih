import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import {
  Scale,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  QrCode,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  Building2,
  FileText,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const { navigate, getRoleDashboardPath } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const DEMO_ACCOUNTS: Record<string, string> = {
    admin: 'admin.demo@nawi.gov.in',
    inspector: 'inspector.demo@nawi.gov.in',
    tester: 'tester.demo@nawi.gov.in',
    engineer: 'engineer.demo@nawi.gov.in',
    owner: 'owner.demo@nawi.gov.in',
  };

  const DEMO_ROLES_CONFIG: Array<{
    role: 'OWNER' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'ADMIN';
    title: string;
    description: string;
  }> = [
    {
      role: 'OWNER',
      title: 'Owner',
      description: 'Applicant & scale registration',
    },
    {
      role: 'INSPECTOR',
      title: 'Inspector',
      description: 'Review & approval authority',
    },
    {
      role: 'TESTER',
      title: 'Tester',
      description: 'Field metrology verification',
    },
    {
      role: 'ENGINEER',
      title: 'Engineer',
      description: 'Calibration technical review',
    },
    {
      role: 'ADMIN',
      title: 'Admin',
      description: 'System administration & rules',
    },
  ];

  const workflowSteps = [
    {
      num: '01',
      title: 'Instrument Registration',
      desc: 'Manufacturer application & specification logging',
    },
    {
      num: '02',
      title: 'Field Inspection & Verification',
      desc: 'GPS geofencing & live officer identity check',
    },
    {
      num: '03',
      title: 'OIML-Based Test Calculations',
      desc: 'Automated Table 6 MPE mathematical verification',
    },
    {
      num: '04',
      title: 'Technical Review & Approval',
      desc: 'Calibration engineer endorsement & inspector sign-off',
    },
    {
      num: '05',
      title: 'Digital Certificate & QR Verification',
      desc: 'SHA-256 integrity sealed certificate & public QR portal',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const user = await login(email, password);
      const targetDashboard = getRoleDashboardPath(user.role);
      navigate(targetDashboard);
    } catch {
      setErrorMessage('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER') => {
    const roleKey = role.toLowerCase();
    const configuredEmail = DEMO_ACCOUNTS[roleKey];
    if (!configuredEmail) {
      setErrorMessage('Demonstration account is not configured.');
      return;
    }

    setDemoLoadingRole(role);
    setErrorMessage(null);

    try {
      const user = await demoLogin(role);
      const targetDashboard = getRoleDashboardPath(user.role);
      navigate(targetDashboard);
    } catch (err: any) {
      console.error('[Demo Login Error]:', err);
      setErrorMessage(
        err?.message || 'Unable to sign in to this demonstration account.'
      );
    } finally {
      setDemoLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#17324D] flex flex-col justify-between font-sans">
      {/* 1. GOVERNMENT-STYLE TOP HEADER */}
      <header className="bg-white border-b border-[#D8E1EA] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-[#EAF3FA] border border-[#D8E1EA] text-[#0B3A6E] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#526577] tracking-wider uppercase">
                भारत सरकार &bull; Government of India
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#0B3A6E] leading-tight">
                Ministry of Consumer Affairs, Food & Public Distribution
              </div>
              <div className="text-[11px] text-[#526577]">
                Department of Consumer Affairs &bull; Legal Metrology Division
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-[#526577]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F4F8FC] border border-[#D8E1EA] text-[11px] font-medium text-[#145DA0]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Official National Portal
            </span>
          </div>
        </div>
      </header>

      {/* 2. PRODUCT NAVIGATION BAR */}
      <nav className="bg-[#0B3A6E] text-white px-4 sm:px-8 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#145DA0] text-white flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base tracking-wide text-white">NAWI-REPORT</span>
              <span className="hidden sm:inline-block ml-2.5 text-xs text-[#EAF3FA] font-normal pl-2.5 border-l border-blue-400/40">
                Digital Legal Metrology Inspection & Test Reporting
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="hidden lg:flex items-center gap-5 text-[#EAF3FA]">
              <span className="hover:text-white cursor-default">Home</span>
              <span className="hover:text-white cursor-default">About</span>
              <span className="hover:text-white cursor-default">Legal Metrology</span>
              <span className="hover:text-white cursor-default">Guidelines</span>
              <span className="hover:text-white cursor-default">Contact</span>
            </div>

            <button
              onClick={() => navigate('/verify')}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#145DA0] hover:bg-[#186fbe] text-white px-3 py-1.5 rounded transition-colors border border-blue-400/40 cursor-pointer shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Public Verification</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 3. MAIN CONTENT LAYOUT (Two Columns) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Official Portal Introduction (~55%) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EAF3FA] border border-[#D8E1EA] text-[#0B3A6E] text-xs font-semibold tracking-wide uppercase">
                <FileText className="w-3.5 h-3.5" />
                Digital Legal Metrology Inspection & Test Reporting
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3A6E] tracking-tight leading-snug">
                Secure, traceable digital workflow for inspection, testing, verification and certificate issuance.
              </h1>

              <p className="text-sm text-[#526577] leading-relaxed">
                NAWI-REPORT digitizes the inspection and testing workflow for Non-Automatic Weighing Instruments, providing structured field verification, regulatory test calculations, technical review, certificate issuance and public verification.
              </p>

              <div className="p-3 bg-[#F4F8FC] border border-[#D8E1EA] rounded-lg text-xs text-[#145DA0] font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#287A4B] shrink-0" />
                <span>Implements selected OIML R 76-1:2006 requirements and applicable test procedures.</span>
              </div>
            </div>

            {/* KEY WORKFLOW HIGHLIGHTS (4-5 Simple Items) */}
            <div className="space-y-2.5 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#526577]">
                Key Workflow Modules
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {workflowSteps.map((step) => (
                  <div
                    key={step.num}
                    className="p-3 bg-white border border-[#D8E1EA] rounded-lg hover:border-[#145DA0] transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-xs font-bold font-mono text-[#145DA0] bg-[#EAF3FA] px-1.5 py-0.5 rounded">
                        {step.num}
                      </span>
                      <h3 className="text-xs font-bold text-[#17324D]">{step.title}</h3>
                    </div>
                    <p className="text-[11px] text-[#526577] leading-tight pl-7">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Official Login Card (~45%) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Primary Login Card */}
            <div className="bg-white border border-[#D8E1EA] rounded-lg p-6 sm:p-7 shadow-sm">
              <div className="border-b border-[#D8E1EA] pb-4 mb-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-[#0B3A6E]">USER LOGIN</h2>
                  <span className="text-[11px] font-medium text-[#526577] bg-[#F4F8FC] px-2 py-0.5 rounded border border-[#D8E1EA]">
                    e-Governance Access
                  </span>
                </div>
                <p className="text-xs text-[#526577] mt-1">
                  Sign in to access the NAWI-REPORT portal.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-md bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17324D] mb-1">
                    Email / User ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#526577] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="officer@nawi.gov.in"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8E1EA] rounded-md text-xs text-[#17324D] placeholder-[#526577] focus:outline-none focus:ring-2 focus:ring-[#0B3A6E] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#17324D]">
                      Password <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#526577] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-9 py-2 bg-white border border-[#D8E1EA] rounded-md text-xs text-[#17324D] placeholder-[#526577] focus:outline-none focus:ring-2 focus:ring-[#0B3A6E] focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526577] hover:text-[#17324D] p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setErrorMessage('Please contact your administrator or supervisor to reset credentials.')}
                    className="text-xs text-[#145DA0] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-md bg-[#0B3A6E] hover:bg-[#145DA0] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>SIGN IN</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* PRESENTATION ACCESS (Demo Login Buttons) */}
              <div className="mt-6 pt-5 border-t border-[#D8E1EA]">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0B3A6E]">
                      PRESENTATION ACCESS
                    </span>
                    <span className="text-[10px] font-medium text-[#145DA0] bg-[#EAF3FA] px-2 py-0.5 rounded border border-[#D8E1EA]">
                      Role Evaluation
                    </span>
                  </div>
                  <p className="text-[11px] text-[#526577] mt-0.5">
                    Select an authorized role to evaluate the verification workflow:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEMO_ROLES_CONFIG.map((item) => {
                    const isCurrentLoading = demoLoadingRole === item.role;
                    const isAnyLoading = loading || demoLoadingRole !== null;

                    return (
                      <button
                        key={item.role}
                        type="button"
                        disabled={isAnyLoading}
                        onClick={() => handleDemoLogin(item.role)}
                        className={`p-2.5 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          item.role === 'OWNER' ? 'sm:col-span-2' : ''
                        } bg-[#F4F8FC] border-[#D8E1EA] hover:bg-[#EAF3FA] hover:border-[#145DA0]`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17324D] flex items-center gap-1.5">
                            <UserCheck className="w-3 h-3 text-[#145DA0]" />
                            <span>{item.title}</span>
                          </div>
                          <div className="text-[10px] text-[#526577] truncate">
                            {item.description}
                          </div>
                        </div>

                        {isCurrentLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#145DA0]/30 border-t-[#145DA0] rounded-full animate-spin shrink-0" />
                        ) : (
                          <span className="text-[10px] font-semibold text-[#145DA0] px-1.5 py-0.5 bg-white rounded border border-[#D8E1EA] shrink-0">
                            Open
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PUBLIC CERTIFICATE VERIFICATION CARD */}
            <div className="bg-white border border-[#D8E1EA] rounded-lg p-4 sm:p-5 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-[#0B3A6E] uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#145DA0]" />
                    PUBLIC CERTIFICATE VERIFICATION
                  </h3>
                  <p className="text-xs text-[#526577]">
                    Verify an issued certificate using its verification number or QR code.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/verify')}
                  className="px-3 py-1.5 rounded-md bg-[#F4F8FC] hover:bg-[#EAF3FA] text-[#0B3A6E] hover:text-[#145DA0] border border-[#D8E1EA] hover:border-[#145DA0] text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  VERIFY CERTIFICATE
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="bg-white border-t border-[#D8E1EA] px-4 sm:px-8 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#526577]">
          <div>
            <span className="font-semibold text-[#17324D]">NAWI-REPORT</span> &bull; Digital Legal Metrology Inspection & Test Reporting
          </div>
          <div className="text-center sm:text-right text-[11px]">
            Department of Consumer Affairs &bull; Legal Metrology &bull; © 2026 NAWI-REPORT
          </div>
        </div>
      </footer>
    </div>
  );
};

