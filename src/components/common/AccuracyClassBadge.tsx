import React from 'react';
import { AccuracyClass } from '../../types.ts';

interface AccuracyClassBadgeProps {
  accuracyClass: AccuracyClass | string;
}

export const AccuracyClassBadge: React.FC<AccuracyClassBadgeProps> = ({ accuracyClass }) => {
  const getStyle = () => {
    switch (accuracyClass) {
      case 'I':
        return {
          label: 'Class I (Special)',
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'II':
        return {
          label: 'Class II (High)',
          bg: 'bg-sky-50 text-sky-800 border-sky-200',
        };
      case 'III':
        return {
          label: 'Class III (Medium)',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'IIII':
        return {
          label: 'Class IIII (Ordinary)',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      default:
        return {
          label: `Class ${accuracyClass}`,
          bg: 'bg-slate-50 text-slate-800 border-slate-200',
        };
    }
  };

  const style = getStyle();

  return (
    <span
      id={`accuracy-class-badge-${accuracyClass.toLowerCase()}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${style.bg} font-mono tracking-tight`}
    >
      {style.label}
    </span>
  );
};
