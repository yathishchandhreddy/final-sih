import React from 'react';
import { WorkflowStatus } from '../../types.ts';
import { Clock, Send, Eye, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

interface WorkflowBadgeProps {
  status: WorkflowStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const WorkflowBadge: React.FC<WorkflowBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft',
          icon: Clock,
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-300',
        };
      case 'SUBMITTED':
        return {
          label: 'Submitted',
          icon: Send,
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
        };
      case 'UNDER_REVIEW':
        return {
          label: 'Under Technical Review',
          icon: Eye,
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
        };
      case 'CORRECTION_REQUIRED':
        return {
          label: 'Correction Required',
          icon: AlertCircle,
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
        };
      case 'APPROVED':
        return {
          label: 'Approved',
          icon: CheckCircle2,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
        };
      case 'FINALIZED':
        return {
          label: 'Finalized & Sealed',
          icon: Lock,
          bg: 'bg-indigo-50',
          text: 'text-indigo-800',
          border: 'border-indigo-200',
        };
      default:
        return {
          label: status,
          icon: Clock,
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  return (
    <span
      id={`workflow-badge-${status.toLowerCase()}`}
      className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} whitespace-nowrap shadow-xs`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
};
