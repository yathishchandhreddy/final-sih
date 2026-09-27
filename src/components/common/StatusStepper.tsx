import React from 'react';
import { WorkflowStatus } from '../../types.ts';
import { Check, Clock, Eye, AlertCircle, FileCheck, Lock } from 'lucide-react';

interface StatusStepperProps {
  currentStatus: WorkflowStatus;
}

const STEPS: Array<{ key: WorkflowStatus; label: string; icon: React.ElementType }> = [
  { key: 'APPLICATION_SUBMITTED', label: '1. Application Submitted', icon: Clock },
  { key: 'INSPECTION_SCHEDULED', label: '2. Inspection Scheduled', icon: FileCheck },
  { key: 'SITE_VERIFIED', label: '3. Site & Standards Verified', icon: Eye },
  { key: 'INSPECTOR_RECOMMENDED', label: '4. Technical Review', icon: Check },
  { key: 'FINALIZED', label: '5. Certificate Issued (SHA-256)', icon: Lock },
];

export const StatusStepper: React.FC<StatusStepperProps> = ({ currentStatus }) => {
  const getStepIndex = (status: WorkflowStatus) => {
    switch (status) {
      case 'DRAFT':
      case 'APPLICATION_SUBMITTED':
        return 0;
      case 'INSPECTION_SCHEDULED':
        return 1;
      case 'SITE_VERIFIED':
      case 'STANDARDS_VERIFIED':
        return 2;
      case 'FIELD_TESTS_COMPLETED':
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'INSPECTOR_RECOMMENDED':
      case 'CORRECTION_REQUIRED':
        return 3;
      case 'APPROVED':
      case 'FINALIZED':
        return 4;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);
  const isCorrection = currentStatus === 'CORRECTION_REQUIRED';

  return (
    <div id="workflow-status-stepper" className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between relative">
        {/* Background Connecting Line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
        {/* Active Progress Line */}
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-sky-600 -z-0 transition-all duration-300"
          style={{ width: `${(Math.min(currentIndex, 4) / 4) * 88}%` }}
        />

        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex || (idx === currentIndex && currentStatus === 'FINALIZED');
          const isCurrent = idx === currentIndex;
          const StepIcon = isCorrection && isCurrent ? AlertCircle : isCompleted ? Check : step.icon;

          let circleClass = 'bg-white border-slate-300 text-slate-400';
          let textClass = 'text-slate-500 font-normal';

          if (isCorrection && isCurrent) {
            circleClass = 'bg-rose-50 border-rose-500 text-rose-600 ring-4 ring-rose-100';
            textClass = 'text-rose-700 font-semibold';
          } else if (isCurrent) {
            circleClass = 'bg-sky-600 border-sky-600 text-white ring-4 ring-sky-100';
            textClass = 'text-sky-900 font-semibold';
          } else if (isCompleted) {
            circleClass = 'bg-sky-50 border-sky-600 text-sky-600';
            textClass = 'text-slate-800 font-medium';
          }

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${circleClass} bg-white shadow-xs`}
              >
                <StepIcon className="w-4 h-4" />
              </div>
              <span className={`text-xs mt-2 text-center whitespace-nowrap ${textClass}`}>
                {isCorrection && isCurrent ? 'Correction Required' : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
