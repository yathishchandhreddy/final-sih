import React, { useState } from 'react';
import { api } from '../../api/client.ts';
import { AccuracyClass } from '../../types.ts';
import { Scale, X, Check, AlertCircle, Info, Sparkles, Cpu } from 'lucide-react';

interface RegisterInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (instrumentId: string, testPlanId?: string) => void;
}

export const RegisterInstrumentModal: React.FC<RegisterInstrumentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    applicant_name: '',
    manufacturer: '',
    model_number: '',
    instrument_type: 'Non-Automatic Counter / Bench Scale',
    accuracy_class: 'III' as AccuracyClass,
    max_capacity: '30',
    capacity_unit: 'kg',
    verification_scale_interval_e: '10',
    scale_interval_unit: 'g',
    serial_number: '',
    indicator_details: 'Digitronix IND-780 Digital Weight Transmitter',
    load_cell_details: 'Sensortech C3 Single Point Load Cell 50kg',
    application_number: '',
    autoGenerateTestPlan: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate n = Max / e
  const maxVal = parseFloat(formData.max_capacity) || 0;
  const eVal = parseFloat(formData.verification_scale_interval_e) || 0;

  let eInCapacityUnit = eVal;
  if (formData.scale_interval_unit === 'g' && formData.capacity_unit === 'kg') {
    eInCapacityUnit = eVal / 1000;
  } else if (formData.scale_interval_unit === 'mg' && formData.capacity_unit === 'g') {
    eInCapacityUnit = eVal / 1000;
  }
  const n = eInCapacityUnit > 0 ? Math.round(maxVal / eInCapacityUnit) : 0;

  // Validation according to OIML R 76 Table 3
  const isNValid = () => {
    if (formData.accuracy_class === 'III') {
      return n >= 100 && n <= 10000;
    }
    if (formData.accuracy_class === 'II') {
      return n >= 100 && n <= 100000;
    }
    if (formData.accuracy_class === 'I') {
      return n >= 50000;
    }
    if (formData.accuracy_class === 'IIII') {
      return n >= 100 && n <= 1000;
    }
    return true;
  };

  const handleFillDemo = (type: 'class3' | 'class2') => {
    if (type === 'class3') {
      setFormData({
        applicant_name: 'Precision Scale Systems Ltd.',
        manufacturer: 'Avery Weigh-Tronix India',
        model_number: 'ZK-3000-Max',
        instrument_type: 'Electronic Counter / Platform Scale',
        accuracy_class: 'III',
        max_capacity: '30',
        capacity_unit: 'kg',
        verification_scale_interval_e: '10',
        scale_interval_unit: 'g',
        serial_number: `SN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        indicator_details: 'Digital Weight Indicator Model IND-560 with 7-digit VFD',
        load_cell_details: '4x Aluminum Shear Beam OIML C3 Load Cells (350 ohm)',
        application_number: `APP-NAWI-IND-${Math.floor(1000 + Math.random() * 9000)}`,
        autoGenerateTestPlan: true,
      });
    } else {
      setFormData({
        applicant_name: 'BioMetrology Analytical Labs',
        manufacturer: 'Sartorius Precision Balances',
        model_number: 'Entris-II-6200',
        instrument_type: 'High Precision Laboratory Balance',
        accuracy_class: 'II',
        max_capacity: '6200',
        capacity_unit: 'g',
        verification_scale_interval_e: '0.1',
        scale_interval_unit: 'g',
        serial_number: `SN-LAB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        indicator_details: 'Monolithic Weighing Cell with Touchscreen GUI',
        load_cell_details: 'Electromagnetic Force Restoration (EMFR) Cell',
        application_number: `APP-LAB-IND-${Math.floor(1000 + Math.random() * 9000)}`,
        autoGenerateTestPlan: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!formData.applicant_name.trim()) throw new Error('Applicant organization name is required.');
      if (!formData.manufacturer.trim()) throw new Error('Manufacturer name is required.');
      if (!formData.model_number.trim()) throw new Error('Model number is required.');
      if (!formData.serial_number.trim()) throw new Error('Serial number is required.');
      if (!formData.application_number.trim()) throw new Error('Application reference number is required.');

      const regRes = await api.registerInstrument({
        applicant_name: formData.applicant_name,
        manufacturer: formData.manufacturer,
        model_number: formData.model_number,
        instrument_type: formData.instrument_type,
        accuracy_class: formData.accuracy_class,
        max_capacity: Number(formData.max_capacity),
        capacity_unit: formData.capacity_unit,
        verification_scale_interval_e: Number(formData.verification_scale_interval_e),
        scale_interval_unit: formData.scale_interval_unit,
        serial_number: formData.serial_number,
        indicator_details: formData.indicator_details,
        load_cell_details: formData.load_cell_details,
        application_number: formData.application_number,
      });

      let planId: string | undefined;
      if (formData.autoGenerateTestPlan && regRes.instrument_id) {
        const planRes = await api.generateTestPlan(regRes.instrument_id);
        planId = planRes.test_plan_id;
      }

      onSuccess(regRes.instrument_id, planId);
      onClose();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to register instrument.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="register-instrument-modal"
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Register NAWI Instrument</h2>
              <p className="text-xs text-slate-500">
                Non-Automatic Weighing Instrument Type Evaluation Record (OIML R 76-1:2006)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Fill Buttons */}
        <div className="px-6 py-2.5 bg-sky-50 border-b border-sky-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-sky-900 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Pre-fill verified sample configurations:
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              id="fill-demo-class3"
              onClick={() => handleFillDemo('class3')}
              className="px-2.5 py-1 rounded bg-white hover:bg-sky-100 border border-sky-300 text-sky-800 font-semibold transition-colors"
            >
              Class III (30kg / 10g)
            </button>
            <button
              type="button"
              id="fill-demo-class2"
              onClick={() => handleFillDemo('class2')}
              className="px-2.5 py-1 rounded bg-white hover:bg-sky-100 border border-sky-300 text-sky-800 font-semibold transition-colors"
            >
              Class II (6200g / 0.1g)
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Section 1: Administrative Identity */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Administrative & Manufacturer Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicant / Owner Organization *
                </label>
                <input
                  type="text"
                  required
                  id="reg-applicant-name"
                  value={formData.applicant_name}
                  onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                  placeholder="e.g. Precision Scale Systems Ltd."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manufacturer Name *
                </label>
                <input
                  type="text"
                  required
                  id="reg-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g. Avery Weigh-Tronix India"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model Number / Designation *
                </label>
                <input
                  type="text"
                  required
                  id="reg-model-number"
                  value={formData.model_number}
                  onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                  placeholder="e.g. ZK-3000-Max"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  id="reg-serial-number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="e.g. SN-2026-98124"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Application / Case Reference Number *
                </label>
                <input
                  type="text"
                  required
                  id="reg-application-number"
                  value={formData.application_number}
                  onChange={(e) => setFormData({ ...formData, application_number: e.target.value })}
                  placeholder="e.g. APP-NAWI-IND-2026-0042"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Metrological Parameters */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              2. Metrological Specification (OIML R 76-1:2006)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accuracy Class *
                </label>
                <select
                  id="reg-accuracy-class"
                  value={formData.accuracy_class}
                  onChange={(e) => setFormData({ ...formData, accuracy_class: e.target.value as AccuracyClass })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                >
                  <option value="I">Class I (Special Accuracy)</option>
                  <option value="II">Class II (High Accuracy)</option>
                  <option value="III">Class III (Medium Accuracy)</option>
                  <option value="IIII">Class IIII (Ordinary Accuracy)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Capacity (Max) *
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="any"
                    required
                    id="reg-max-capacity"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <select
                    value={formData.capacity_unit}
                    onChange={(e) => setFormData({ ...formData, capacity_unit: e.target.value })}
                    className="text-xs px-2 py-2 rounded-lg border border-slate-300 bg-slate-50 font-semibold"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="t">t</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Interval (e) *
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="any"
                    required
                    id="reg-scale-interval"
                    value={formData.verification_scale_interval_e}
                    onChange={(e) => setFormData({ ...formData, verification_scale_interval_e: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <select
                    value={formData.scale_interval_unit}
                    onChange={(e) => setFormData({ ...formData, scale_interval_unit: e.target.value })}
                    className="text-xs px-2 py-2 rounded-lg border border-slate-300 bg-slate-50 font-semibold"
                  >
                    <option value="g">g</option>
                    <option value="mg">mg</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Metrological Compliance Check Box */}
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-600" />
                  Scale Intervals Count: <span className="font-mono text-sky-700 font-bold">n = {n.toLocaleString()} e</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  OIML R 76 Table 3 bound: {formData.accuracy_class === 'III' ? '100 ≤ n ≤ 10,000' : formData.accuracy_class === 'II' ? '100 ≤ n ≤ 100,000' : formData.accuracy_class === 'I' ? 'n ≥ 50,000' : '100 ≤ n ≤ 1,000'}
                </div>
              </div>

              <div>
                {isNValid() ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <Check className="w-3.5 h-3.5" /> Valid Specification
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5" /> Out of Class Bounds
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Technical Components */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              3. Hardware Components (Indicator & Load Cell)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Indicator / Terminal Model
                </label>
                <input
                  type="text"
                  value={formData.indicator_details}
                  onChange={(e) => setFormData({ ...formData, indicator_details: e.target.value })}
                  placeholder="e.g. Digitronix IND-780 Digital Weight Transmitter"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Load Cell(s) Details
                </label>
                <input
                  type="text"
                  value={formData.load_cell_details}
                  onChange={(e) => setFormData({ ...formData, load_cell_details: e.target.value })}
                  placeholder="e.g. Sensortech C3 Single Point Load Cell 50kg"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Option: Auto Generate Test Plan */}
          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoGenerateTestPlan}
                onChange={(e) => setFormData({ ...formData, autoGenerateTestPlan: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Automatically generate standard OIML R 76-1:2006 Test Plan upon registration</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-register-instrument-btn"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Registering Instrument...' : 'Register & Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
