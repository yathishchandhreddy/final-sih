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

  // Safe frontend configuration object mapping demonstration roles to their official demonstration emails
  const DEMO_ACCOUNTS: Record<string, string> = {
    admin: 'admin.demo@nawi.gov.in',
    inspector: 'inspector.demo@nawi.gov.in',
    tester: 'tester.demo@nawi.gov.in',
    engineer: 'engineer.demo@nawi.gov.in',
    owner: 'owner.demo@nawi.gov.in',
  };

  const DEMO_ROLES_CONFIG: Array<{
    role: 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER';
    title: string;
    subtitle: string;
  }> = [
    {
      role: 'ADMIN',
      title: 'Admin',
      subtitle: 'System Administration',
    },
    {
      role: 'INSPECTOR',
      title: 'Inspector',
      subtitle: 'Inspection & Approval',
    },
    {
      role: 'TESTER',
      title: 'Tester',
      subtitle: 'Field Testing & Verification',
    },
    {
      role: 'ENGINEER',
      title: 'Engineer',
      subtitle: 'Technical Review',
    },
    {
      role: 'OWNER',
      title: 'Instrument Owner',
      subtitle: 'Instrument & Application Portal',
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
      // Normal user-facing message, never exposing Supabase internals or stack traces
      setErrorMessage('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'ADMIN' | 'INSPECTOR' | 'TESTER' | 'ENGINEER' | 'OWNER') => {
    const roleKey = role.toLowerCase();
    const configuredEmail = DEMO_ACCOUNTS[roleKey];
    if (!configuredEmail) {
      setErrorMessage('Demonstration account unavailable. Please contact the administrator.');
      return;
    }

    setDemoLoadingRole(role);
    setErrorMessage(null);

    try {
      const user = await demoLogin(role);
      const targetDashboard = getRoleDashboardPath(user.role);
      navigate(targetDashboard);
    } catch {
      setErrorMessage('Demonstration account unavailable. Please contact the administrator.');
    } finally {
      setDemoLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Bar with Standard Tag */}
      <div className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">NAWI-Report</span>
            <span className="ml-2 text-[11px] font-mono text-slate-400 border border-slate-700/80 px-1.5 py-0.5 rounded bg-slate-900">
              OIML R 76-1:2006
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/verify')}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-slate-800 transition-colors shadow-2xs"
        >
          <QrCode className="w-3.5 h-3.5 text-blue-400" />
          <span>Public Certificate Verifier</span>
        </button>
      </div>

      {/* Main Login Card Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Regulatory Brand Context */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-700/50 text-blue-300 text-xs font-medium shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Government Metrological Verification Portal</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                NAWI-REPORT
              </h1>
              <p className="text-lg font-semibold text-blue-400 tracking-tight">
                Digital Legal Metrology Workflow System
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Non-Automatic Weighing Instrument (NAWI) inspection, calibration verification, automated OIML error calculation, and digital certificate management.
              </p>
            </div>

            {/* Metrology Workflow Trust Badge */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                <span>Legal Metrology Standards</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>OIML R 76-1:2006 compliant inspection testing & automated MPE verification.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cryptographic SHA-256 hash sealing on issued digital certificates.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Secure multi-role access control for Owners, Testers, Engineers, Inspectors & Administrators.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Sign In Form */}
          <div className="lg:col-span-6">
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">Sign In to Dashboard</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your official metrology credentials to access your dashboard.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="officer@nawi.gov.in"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Security Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* DEMO ACCESS SECTION */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="mb-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      DEMO ACCESS
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300">
                      Controlled Roles
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Use a demonstration account to explore each workflow role.
                  </p>
                </div>

                <div className="space-y-2">
                  {DEMO_ROLES_CONFIG.map((item) => {
                    const isCurrentLoading = demoLoadingRole === item.role;
                    const isAnyLoading = loading || demoLoadingRole !== null;

                    return (
                      <div
                        key={item.role}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/40 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white leading-tight">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isAnyLoading}
                          onClick={() => handleDemoLogin(item.role)}
                          className="shrink-0 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isCurrentLoading ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Signing in...</span>
                            </>
                          ) : (
                            <span>Open Demo</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  Contact your administrator if you need an account.
                </p>
                <p className="text-[11px] text-slate-500">
                  Protected under National Legal Metrology Regulations & OIML R 76-1:2006.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 px-6 py-3 text-center text-xs text-slate-400">
        NAWI-Report Digital Metrology System &bull; Version 1.0.0 &bull; Secure SHA-256 Record Integrity
      </footer>
    </div>
  );
};
