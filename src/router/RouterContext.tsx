import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RoleName } from '../types.ts';

interface RouterContextType {
  path: string;
  navigate: (to: string, state?: any) => void;
  getRoleDashboardPath: (role?: RoleName) => string;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function getRoleDashboardPath(role?: RoleName): string {
  switch (role) {
    case 'OWNER':
    case 'APPLICANT':
      return '/owner/dashboard';
    case 'TESTER':
    case 'SUB_INSPECTOR':
      return '/tester/dashboard';
    case 'ENGINEER':
      return '/engineer/dashboard';
    case 'INSPECTOR':
      return '/inspector/dashboard';
    case 'ADMIN':
    case 'APPROVING_AUTHORITY':
      return '/admin/dashboard';
    case 'EVALUATOR':
      return '/owner/dashboard';
    case 'REVIEWER':
      return '/inspector/dashboard';
    case 'READ_ONLY':
      return '/admin/audit';
    default:
      return '/owner/dashboard';
  }
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p && p !== '/' ? p : '/login';
    }
    return '/login';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/login');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== to) {
        window.history.pushState(null, '', to);
      }
      setPath(to);
    }
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate, getRoleDashboardPath }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}
