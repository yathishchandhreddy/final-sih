import { RuleEngine } from './ruleEngine.ts';
import { CalculationResponse, CalculationStep } from '../types/index.ts';

export interface ObservationInput {
  load_point: number; // e.g. 10 kg
  reference_mass: number; // reference standard mass applied, e.g. 10 kg
  mass_unit: string; // 'kg' or 'g'
  indication_increasing?: number;
  indication_decreasing?: number;
  delta_l?: number; // delta L for turning point test (optional)
  position_corner?: string; // 'Center', 'Pos 1 (FL)', 'Pos 2 (BL)', etc.
  run_number?: number; // 1, 2, 3...
  tare_applied?: number;
  temp_celsius?: number;
}

export interface InstrumentSpecs {
  accuracy_class: 'I' | 'II' | 'III' | 'IIII';
  max_capacity: number;
  capacity_unit: string;
  verification_scale_interval_e: number;
  scale_interval_unit: string;
}

export class CalculationEngine {
  static readonly CALCULATION_VERSION = 'NAWI-CALC-v1.0.0';

  /**
   * Helper to convert an observation mass/error to verification scale interval `e`
   */
  private static convertToScaleIntervalE(
    value: number,
    valueUnit: string,
    e: number,
    eUnit: string
  ): { valueInE: number; valueInEUnit: number } {
    let valInEUnit = value;
    if (valueUnit === 'kg' && eUnit === 'g') {
      valInEUnit = value * 1000;
    } else if (valueUnit === 'g' && eUnit === 'mg') {
      valInEUnit = value * 1000;
    } else if (valueUnit === 'g' && eUnit === 'kg') {
      valInEUnit = value / 1000;
    } else if (valueUnit === 't' && eUnit === 'kg') {
      valInEUnit = value * 1000;
    }

    const valueInE = valInEUnit / e;
    return { valueInE, valueInEUnit: valInEUnit };
  }

  /**
   * Calculate Weighing Performance & Accuracy Test (Clause A.4.4)
   */
  static calculateAccuracyTest(
    observations: ObservationInput[],
    specs: InstrumentSpecs,
    ruleVersionStr: string = 'v1.0.0'
  ): CalculationResponse {
    if (!observations || observations.length === 0) {
      throw new Error('No observations provided for Accuracy test calculation.');
    }

    const steps: CalculationStep[] = [];
    let overallPass = true;
    let maxErrorObserved = 0;
    let worstCaseLimit = 0;
    let worstCaseComparison = '';

    // Step 1: Instrument parameters & verification scale interval
    steps.push({
      step_number: 1,
      label: 'Instrument Metrological Parameter Extraction',
      description: 'Extract Class, Maximum Capacity (Max), and Verification Scale Interval (e).',
      formula: 'n = Max / e (Scale intervals count)',
      values: {
        accuracy_class: specs.accuracy_class,
        max_capacity: `${specs.max_capacity} ${specs.capacity_unit}`,
        verification_scale_interval_e: `${specs.verification_scale_interval_e} ${specs.scale_interval_unit}`,
      },
      result: `Accuracy Class ${specs.accuracy_class} with e = ${specs.verification_scale_interval_e} ${specs.scale_interval_unit}`,
    });

    // Step 2: Evaluate each load point
    const evaluatedPoints: any[] = [];

    observations.forEach((obs, index) => {
      const { valueInE, valueInEUnit } = this.convertToScaleIntervalE(
        obs.reference_mass,
        obs.mass_unit,
        specs.verification_scale_interval_e,
        specs.scale_interval_unit
      );

      const mpeInfo = RuleEngine.computeMPEInUnitsOfE(specs.accuracy_class, valueInE);
      const mpeInEUnit = mpeInfo.mpeFactor * specs.verification_scale_interval_e;

      // Calculate Error for increasing load: E = I - L
      const indInc = obs.indication_increasing ?? obs.reference_mass;
      const errorInc = Number((indInc - obs.reference_mass).toFixed(4));
      // Convert error to scale unit
      let errorIncInEUnit = errorInc;
      if (obs.mass_unit === 'kg' && specs.scale_interval_unit === 'g') {
        errorIncInEUnit = errorInc * 1000;
      }

      let errorDecInEUnit: number | null = null;
      if (obs.indication_decreasing !== undefined && obs.indication_decreasing !== null) {
        const errorDec = Number((obs.indication_decreasing - obs.reference_mass).toFixed(4));
        errorDecInEUnit = obs.mass_unit === 'kg' && specs.scale_interval_unit === 'g' ? errorDec * 1000 : errorDec;
      }

      const isIncPass = Math.abs(errorIncInEUnit) <= mpeInEUnit + 1e-9;
      const isDecPass = errorDecInEUnit === null || Math.abs(errorDecInEUnit) <= mpeInEUnit + 1e-9;
      const pointPass = isIncPass && isDecPass;

      if (!pointPass) {
        overallPass = false;
      }

      const pointMaxError = Math.max(Math.abs(errorIncInEUnit), errorDecInEUnit !== null ? Math.abs(errorDecInEUnit) : 0);
      if (pointMaxError > maxErrorObserved) {
        maxErrorObserved = pointMaxError;
        worstCaseLimit = mpeInEUnit;
        worstCaseComparison = `|Error| (${pointMaxError} ${specs.scale_interval_unit}) ${pointPass ? '≤' : '>'} MPE (${mpeInEUnit} ${specs.scale_interval_unit})`;
      }

      evaluatedPoints.push({
        point_index: index + 1,
        load: `${obs.reference_mass} ${obs.mass_unit}`,
        load_in_e: `${valueInE.toFixed(1)} e`,
        mpe_limit: `±${mpeInEUnit} ${specs.scale_interval_unit} (±${mpeInfo.mpeFactor}e)`,
        indication_inc: obs.indication_increasing !== undefined ? `${obs.indication_increasing} ${obs.mass_unit}` : 'N/A',
        error_inc: `${errorIncInEUnit} ${specs.scale_interval_unit}`,
        indication_dec: obs.indication_decreasing !== undefined ? `${obs.indication_decreasing} ${obs.mass_unit}` : 'N/A',
        error_dec: errorDecInEUnit !== null ? `${errorDecInEUnit} ${specs.scale_interval_unit}` : 'N/A',
        mpe_interval: mpeInfo.intervalDesc,
        status: pointPass ? 'PASS' : 'FAIL',
      });
    });

    // Step 3: OIML R 76 Table 6 Formula Evaluation
    steps.push({
      step_number: 2,
      label: 'OIML R 76-1 Table 6 MPE Tier Mapping & Indication Error Calculation',
      description: 'Compute error E = I - L for every load step and compare against the maximum permissible error tier.',
      formula: 'E = Indication (I) - Reference Load (L)  |  MPE = TierFactor × e',
      values: {
        evaluated_load_points_count: observations.length,
        points: evaluatedPoints,
      },
      result: `Evaluated ${observations.length} load points across loading and unloading cycles.`,
    });

    // Step 4: Final compliance decision
    steps.push({
      step_number: 3,
      label: 'Metrological Decision Synthesis',
      description: 'Verify if all indication errors satisfy |E| ≤ MPE across all test loads.',
      formula: '∀ load point i: |E_i| ≤ MPE(L_i)',
      values: {
        max_error_observed: `${maxErrorObserved} ${specs.scale_interval_unit}`,
        worst_case_comparison: worstCaseComparison || `All errors within MPE`,
        all_points_passed: overallPass,
      },
      result: overallPass ? 'CONFORMS (PASS)' : 'NON-CONFORMING (FAIL)',
    });

    return {
      test_instance_id: '',
      test_code: 'ACC_WEIGHING',
      input_values: {
        observations_count: observations.length,
        specs,
        data: observations,
      },
      calculation_version: this.CALCULATION_VERSION,
      rule_version: ruleVersionStr,
      calculation_steps: steps,
      result_value: maxErrorObserved,
      applicable_limit: worstCaseLimit,
      limit_description: `MPE limit under OIML R 76-1:2006 Table 6`,
      comparison: worstCaseComparison || `Max Error ${maxErrorObserved} ${specs.scale_interval_unit} <= Limit`,
      decision: overallPass ? 'PASS' : 'FAIL',
      regulatory_status: 'VERIFIED_OIML_R76',
    };
  }

  /**
   * Calculate Repeatability Test (Clause A.4.6)
   * Difference between max and min indications for the same load <= |MPE|
   */
  static calculateRepeatabilityTest(
    observations: ObservationInput[],
    specs: InstrumentSpecs,
    ruleVersionStr: string = 'v1.0.0'
  ): CalculationResponse {
    if (!observations || observations.length < 3) {
      throw new Error('Repeatability test requires at least 3 repeated load runs (OIML R 76 Clause A.4.6).');
    }

    const steps: CalculationStep[] = [];
    const testLoad = observations[0].reference_mass;
    const testUnit = observations[0].mass_unit;

    // Collect all indications
    const indications: number[] = observations.map((o) => o.indication_increasing ?? o.reference_mass);
    const minIndication = Math.min(...indications);
    const maxIndication = Math.max(...indications);
    const range = Number((maxIndication - minIndication).toFixed(4));

    // Convert range to scale interval unit
    let rangeInEUnit = range;
    if (testUnit === 'kg' && specs.scale_interval_unit === 'g') {
      rangeInEUnit = range * 1000;
    }

    const { valueInE } = this.convertToScaleIntervalE(
      testLoad,
      testUnit,
      specs.verification_scale_interval_e,
      specs.scale_interval_unit
    );

    const mpeInfo = RuleEngine.computeMPEInUnitsOfE(specs.accuracy_class, valueInE);
    const mpeInEUnit = mpeInfo.mpeFactor * specs.verification_scale_interval_e;

    const isPass = rangeInEUnit <= mpeInEUnit + 1e-9;

    steps.push({
      step_number: 1,
      label: 'Repeatability Series Observation Compilation',
      description: 'Record multiple repeated measurements under identical load condition.',
      formula: 'Series = [I_1, I_2, ..., I_n] at applied load L',
      values: {
        applied_load: `${testLoad} ${testUnit}`,
        runs_count: observations.length,
        indications: indications.map((ind, i) => `Run ${i + 1}: ${ind} ${testUnit}`),
      },
      result: `Min Indication = ${minIndication} ${testUnit}, Max Indication = ${maxIndication} ${testUnit}`,
    });

    steps.push({
      step_number: 2,
      label: 'Repeatability Range Calculation',
      description: 'Compute range between maximum and minimum observed indications.',
      formula: 'ΔI = I_max - I_min',
      values: {
        I_max: `${maxIndication} ${testUnit}`,
        I_min: `${minIndication} ${testUnit}`,
        difference: `${rangeInEUnit} ${specs.scale_interval_unit}`,
      },
      result: `ΔI = ${rangeInEUnit} ${specs.scale_interval_unit}`,
    });

    steps.push({
      step_number: 3,
      label: 'MPE Threshold Comparison & Decision',
      description: 'Verify that difference does not exceed the absolute MPE for the applied load.',
      formula: 'ΔI ≤ |MPE(L)|',
      values: {
        applied_load_in_e: `${valueInE.toFixed(1)} e`,
        mpe_limit: `|MPE| = ${mpeInEUnit} ${specs.scale_interval_unit} (±${mpeInfo.mpeFactor}e)`,
        comparison: `${rangeInEUnit} ${specs.scale_interval_unit} ${isPass ? '≤' : '>'} ${mpeInEUnit} ${specs.scale_interval_unit}`,
      },
      result: isPass ? 'CONFORMS (PASS)' : 'NON-CONFORMING (FAIL)',
    });

    return {
      test_instance_id: '',
      test_code: 'REPEATABILITY',
      input_values: {
        test_load: `${testLoad} ${testUnit}`,
        runs_count: observations.length,
        indications,
      },
      calculation_version: this.CALCULATION_VERSION,
      rule_version: ruleVersionStr,
      calculation_steps: steps,
      result_value: rangeInEUnit,
      applicable_limit: mpeInEUnit,
      limit_description: `Repeatability limit |MPE| = ${mpeInEUnit} ${specs.scale_interval_unit}`,
      comparison: `Range ΔI (${rangeInEUnit} ${specs.scale_interval_unit}) ${isPass ? '≤' : '>'} |MPE| (${mpeInEUnit} ${specs.scale_interval_unit})`,
      decision: isPass ? 'PASS' : 'FAIL',
      regulatory_status: 'VERIFIED_OIML_R76',
    };
  }

  /**
   * Calculate Eccentricity (Off-Center Load) Test (Clause A.4.7)
   */
  static calculateEccentricityTest(
    observations: ObservationInput[],
    specs: InstrumentSpecs,
    ruleVersionStr: string = 'v1.0.0'
  ): CalculationResponse {
    if (!observations || observations.length < 4) {
      throw new Error('Eccentricity test requires observations at least across 4 corner positions (Clause A.4.7).');
    }

    const steps: CalculationStep[] = [];
    const testLoad = observations[0].reference_mass;
    const testUnit = observations[0].mass_unit;

    const { valueInE } = this.convertToScaleIntervalE(
      testLoad,
      testUnit,
      specs.verification_scale_interval_e,
      specs.scale_interval_unit
    );

    const mpeInfo = RuleEngine.computeMPEInUnitsOfE(specs.accuracy_class, valueInE);
    const mpeInEUnit = mpeInfo.mpeFactor * specs.verification_scale_interval_e;

    let maxCornerError = 0;
    let isPass = true;
    const evaluatedPositions: any[] = [];

    observations.forEach((obs, i) => {
      const ind = obs.indication_increasing ?? obs.reference_mass;
      const error = Number((ind - obs.reference_mass).toFixed(4));
      let errorInEUnit = error;
      if (obs.mass_unit === 'kg' && specs.scale_interval_unit === 'g') {
        errorInEUnit = error * 1000;
      }

      const posPass = Math.abs(errorInEUnit) <= mpeInEUnit + 1e-9;
      if (!posPass) isPass = false;
      if (Math.abs(errorInEUnit) > maxCornerError) {
        maxCornerError = Math.abs(errorInEUnit);
      }

      evaluatedPositions.push({
        position: obs.position_corner || `Position ${i + 1}`,
        applied_load: `${obs.reference_mass} ${obs.mass_unit}`,
        indication: `${ind} ${obs.mass_unit}`,
        error: `${errorInEUnit} ${specs.scale_interval_unit}`,
        status: posPass ? 'PASS' : 'FAIL',
      });
    });

    steps.push({
      step_number: 1,
      label: 'Off-Center Receptor Position Load Data Collection',
      description: 'Record indications with test load (approx 1/3 Max) placed at specified eccentric platform locations.',
      formula: 'E_i = I_i - L at position i',
      values: {
        applied_load: `${testLoad} ${testUnit}`,
        positions: evaluatedPositions,
      },
      result: `Evaluated ${observations.length} eccentric positions. Max observed error = ${maxCornerError} ${specs.scale_interval_unit}`,
    });

    steps.push({
      step_number: 2,
      label: 'MPE Verification for Eccentricity Load',
      description: 'Verify that error at each eccentric position does not exceed the MPE for the applied eccentric load.',
      formula: '∀ position i: |E_i| ≤ MPE(L_ecc)',
      values: {
        applied_load_in_e: `${valueInE.toFixed(1)} e`,
        mpe_limit: `±${mpeInEUnit} ${specs.scale_interval_unit} (±${mpeInfo.mpeFactor}e)`,
        comparison: `Max Error (${maxCornerError} ${specs.scale_interval_unit}) ${isPass ? '≤' : '>'} MPE (${mpeInEUnit} ${specs.scale_interval_unit})`,
      },
      result: isPass ? 'CONFORMS (PASS)' : 'NON-CONFORMING (FAIL)',
    });

    return {
      test_instance_id: '',
      test_code: 'ECCENTRICITY',
      input_values: {
        test_load: `${testLoad} ${testUnit}`,
        positions: evaluatedPositions,
      },
      calculation_version: this.CALCULATION_VERSION,
      rule_version: ruleVersionStr,
      calculation_steps: steps,
      result_value: maxCornerError,
      applicable_limit: mpeInEUnit,
      limit_description: `Eccentricity MPE limit = ±${mpeInEUnit} ${specs.scale_interval_unit}`,
      comparison: `Max Error (${maxCornerError} ${specs.scale_interval_unit}) ${isPass ? '≤' : '>'} MPE (${mpeInEUnit} ${specs.scale_interval_unit})`,
      decision: isPass ? 'PASS' : 'FAIL',
      regulatory_status: 'VERIFIED_OIML_R76',
    };
  }

  /**
   * Router for executing calculations based on test code
   */
  static calculate(
    testCode: string,
    observations: ObservationInput[],
    specs: InstrumentSpecs,
    ruleVersionStr: string = 'v1.0.0'
  ): CalculationResponse {
    switch (testCode) {
      case 'ACC_WEIGHING':
        return this.calculateAccuracyTest(observations, specs, ruleVersionStr);
      case 'REPEATABILITY':
        return this.calculateRepeatabilityTest(observations, specs, ruleVersionStr);
      case 'ECCENTRICITY':
        return this.calculateEccentricityTest(observations, specs, ruleVersionStr);
      default:
        return {
          test_instance_id: '',
          test_code: testCode,
          input_values: { observations, specs },
          calculation_version: this.CALCULATION_VERSION,
          rule_version: ruleVersionStr,
          calculation_steps: [
            {
              step_number: 1,
              label: 'Regulatory Validation Gate',
              description: 'This test requires extended environmental or hardware testing fixtures and official metrological validation.',
              formula: 'Status: Requires regulatory validation',
              values: {},
              result: 'Requires regulatory validation',
            },
          ],
          result_value: 0,
          applicable_limit: 0,
          limit_description: 'Requires regulatory validation',
          comparison: 'Requires regulatory validation',
          decision: 'REVIEW',
          regulatory_status: 'REQUIRES_REGULATORY_VALIDATION',
        };
    }
  }
}
