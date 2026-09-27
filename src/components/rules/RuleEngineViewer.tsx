import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { RuleVersion, TestDefinition } from '../../types.ts';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  BookOpen,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Layers,
} from 'lucide-react';

export const RuleEngineViewer: React.FC = () => {
  const [ruleVersions, setRuleVersions] = useState<RuleVersion[]>([]);
  const [testDefs, setTestDefs] = useState<TestDefinition[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const [versionsData, defsData] = await Promise.all([
        api.getRuleVersions(),
        api.getTestDefinitions(),
      ]);
      setRuleVersions(versionsData);
      setTestDefs(defsData);
      if (versionsData.length > 0) {
        setSelectedVersion(versionsData[0]);
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  return (
    <div id="rule-engine-view" className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">OIML R 76-1:2006 Metrological Rule Engine</h1>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold">
              Version Controlled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Database-driven regulatory logic, MPE threshold tables, and test clause specifications for Non-Automatic Weighing Instruments.
          </p>
        </div>

        <button
          onClick={fetchRules}
          className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 self-start md:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Version Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ruleVersions.map((v) => (
          <div
            key={v.id}
            onClick={() => setSelectedVersion(v)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedVersion?.id === v.id
                ? 'bg-sky-50/80 border-sky-500 ring-2 ring-sky-100'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-900">{v.version_code}</span>
              {v.is_active ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  ACTIVE
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  ARCHIVED
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-slate-800 mt-2">{v.name}</div>
            <div className="text-[11px] text-slate-500 mt-1">{v.description}</div>
            <div className="text-[10px] font-mono text-slate-400 mt-2">
              Effective from: {v.effective_from || '2006-01-01'}
            </div>
          </div>
        ))}
      </div>

      {/* Active Rules Breakdown */}
      {selectedVersion && (
        <div className="space-y-6">
          {/* OIML R 76 Table 3: Accuracy Classes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">
                OIML R 76-1 Table 3: Accuracy Classes & Verification Scale Intervals
              </h2>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Accuracy Class</th>
                    <th className="px-4 py-2.5">Verification Scale Interval (e)</th>
                    <th className="px-4 py-2.5">Min Intervals (n min)</th>
                    <th className="px-4 py-2.5">Max Intervals (n max)</th>
                    <th className="px-4 py-2.5">Min Capacity (Min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono">
                  <tr>
                    <td className="px-4 py-2.5 font-sans">
                      <AccuracyClassBadge accuracyClass="I" />
                    </td>
                    <td className="px-4 py-2.5">0.001 g ≤ e</td>
                    <td className="px-4 py-2.5">50 000</td>
                    <td className="px-4 py-2.5">— (unlimited)</td>
                    <td className="px-4 py-2.5">100 e</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-sans">
                      <AccuracyClassBadge accuracyClass="II" />
                    </td>
                    <td className="px-4 py-2.5">0.001 g ≤ e ≤ 0.05 g</td>
                    <td className="px-4 py-2.5">100</td>
                    <td className="px-4 py-2.5">100 000</td>
                    <td className="px-4 py-2.5">20 e</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-sans">
                      <AccuracyClassBadge accuracyClass="III" />
                    </td>
                    <td className="px-4 py-2.5">0.1 g ≤ e ≤ 2 g; 5 g ≤ e</td>
                    <td className="px-4 py-2.5">100 / 500</td>
                    <td className="px-4 py-2.5">10 000</td>
                    <td className="px-4 py-2.5">20 e</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-sans">
                      <AccuracyClassBadge accuracyClass="IIII" />
                    </td>
                    <td className="px-4 py-2.5">5 g ≤ e</td>
                    <td className="px-4 py-2.5">100</td>
                    <td className="px-4 py-2.5">1 000</td>
                    <td className="px-4 py-2.5">10 e</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* OIML R 76 Table 6: MPE Limits */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                OIML R 76-1 Table 6: Maximum Permissible Errors (MPE) for Initial Verification
              </h2>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Applicable MPE</th>
                    <th className="px-4 py-2.5">Class I (Special)</th>
                    <th className="px-4 py-2.5">Class II (High)</th>
                    <th className="px-4 py-2.5">Class III (Medium)</th>
                    <th className="px-4 py-2.5">Class IIII (Ordinary)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-sky-800">±0.5 e</td>
                    <td className="px-4 py-2.5">0 ≤ m ≤ 50 000 e</td>
                    <td className="px-4 py-2.5">0 ≤ m ≤ 5 000 e</td>
                    <td className="px-4 py-2.5">0 ≤ m ≤ 500 e</td>
                    <td className="px-4 py-2.5">0 ≤ m ≤ 50 e</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-sky-800">±1.0 e</td>
                    <td className="px-4 py-2.5">50 000 e &lt; m ≤ 200 000 e</td>
                    <td className="px-4 py-2.5">5 000 e &lt; m ≤ 20 000 e</td>
                    <td className="px-4 py-2.5">500 e &lt; m ≤ 2 000 e</td>
                    <td className="px-4 py-2.5">50 e &lt; m ≤ 200 e</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-sky-800">±1.5 e</td>
                    <td className="px-4 py-2.5">200 000 e &lt; m</td>
                    <td className="px-4 py-2.5">20 000 e &lt; m ≤ 100 000 e</td>
                    <td className="px-4 py-2.5">2 000 e &lt; m ≤ 10 000 e</td>
                    <td className="px-4 py-2.5">200 e &lt; m ≤ 1 000 e</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Test Definitions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                OIML R 76-1:2006 Test Procedure Definitions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testDefs.map((def) => (
                <div key={def.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{def.test_name}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                      {def.oiml_clause}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{def.description}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                    <span>Standard: {def.standard_ref}</span>
                    {def.supported ? (
                      <span className="text-emerald-700 font-semibold font-sans">Full Calculation Engine</span>
                    ) : (
                      <span className="text-amber-700 font-semibold font-sans">Requires validation</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
