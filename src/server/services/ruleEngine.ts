import { queryOne, queryRows } from '../db/database.ts';

export interface ApplicableRuleResult {
  rule_version: {
    id: string;
    rule_id: string;
    version: string;
    title: string;
    effective_date: string;
    standard_code: string;
    accuracy_class: string;
    requirement_text: string;
    calculation_ref: string;
    formula_definition: any;
  };
  applicable_tests: Array<{
    id: string;
    test_code: string;
    name: string;
    category: string;
    standard_ref: string;
    oiml_clause: string;
    description: string;
    supported_in_mvp: boolean;
    regulatory_status: string;
    recommended_load_points?: string[];
  }>;
  instrument_parameters: {
    accuracy_class: string;
    max_capacity: number;
    capacity_unit: string;
    verification_scale_interval_e: number;
    scale_interval_unit: string;
    total_scale_intervals_n: number;
  };
}

export class RuleEngine {
  /**
   * Find the active rule version for an instrument's accuracy class and type
   */
  static async getActiveRuleForInstrument(accuracyClass: string, instrumentType: string = 'ALL_NON_AUTOMATIC') {
    let rule = await queryOne<any>(
      `SELECT * FROM rule_versions 
       WHERE accuracy_class = ? AND active = 1 
       ORDER BY effective_date DESC LIMIT 1`,
      [accuracyClass]
    );

    if (!rule) {
      // Fallback to Class III if not found
      rule = await queryOne<any>(
        `SELECT * FROM rule_versions WHERE accuracy_class = 'III' AND active = 1 LIMIT 1`
      );
    }

    return rule;
  }

  /**
   * Evaluates the applicable test plan based on instrument specification and database rules
   */
  static async evaluateApplicableTestPlan(params: {
    accuracy_class: string;
    max_capacity: number;
    capacity_unit: string;
    verification_scale_interval_e: number;
    scale_interval_unit: string;
    instrument_type?: string;
  }): Promise<ApplicableRuleResult> {
    const { accuracy_class, max_capacity, capacity_unit, verification_scale_interval_e, scale_interval_unit } = params;

    // Convert e to capacity unit for ratio n = Max / e
    let eInCapacityUnit = verification_scale_interval_e;
    if (scale_interval_unit === 'g' && capacity_unit === 'kg') {
      eInCapacityUnit = verification_scale_interval_e / 1000;
    } else if (scale_interval_unit === 'mg' && capacity_unit === 'g') {
      eInCapacityUnit = verification_scale_interval_e / 1000;
    } else if (scale_interval_unit === 'kg' && capacity_unit === 't') {
      eInCapacityUnit = verification_scale_interval_e / 1000;
    }

    const n = Math.round(max_capacity / (eInCapacityUnit || 1));

    // Fetch rule from DB
    const ruleRow = await this.getActiveRuleForInstrument(accuracy_class, params.instrument_type);
    let formulaDef: any = {};
    try {
      formulaDef = typeof ruleRow.formula_definition === 'string' ? JSON.parse(ruleRow.formula_definition) : ruleRow.formula_definition;
    } catch (e) {
      formulaDef = {};
    }

    // Fetch all test definitions
    const testDefs = await queryRows<any>(
      `SELECT * FROM test_definitions WHERE active = 1 ORDER BY supported_in_mvp DESC, id ASC`
    );

    const applicableTests = testDefs.map((td) => {
      let loadPoints: string[] = [];
      if (td.test_code === 'ACC_WEIGHING') {
        loadPoints = [
          'Min Capacity (20e)',
          '500e (First MPE threshold)',
          '2000e (Second MPE threshold)',
          '50% Max Capacity',
          '100% Max Capacity',
        ];
      } else if (td.test_code === 'REPEATABILITY') {
        loadPoints = ['50% Max (3-10 series)', '100% Max (3-10 series)'];
      } else if (td.test_code === 'ECCENTRICITY') {
        loadPoints = ['1/3 Max (Pos 1: Center)', '1/3 Max (Pos 2: Front Left)', '1/3 Max (Pos 3: Back Left)', '1/3 Max (Pos 4: Back Right)', '1/3 Max (Pos 5: Front Right)'];
      }

      return {
        id: td.id,
        test_code: td.test_code,
        name: td.name,
        category: td.category,
        standard_ref: td.standard_ref,
        oiml_clause: td.oiml_clause,
        description: td.description,
        supported_in_mvp: td.supported_in_mvp === 1,
        regulatory_status: td.supported_in_mvp === 1 ? 'VERIFIED_OIML_R76' : 'Requires regulatory validation',
        recommended_load_points: loadPoints,
      };
    });

    return {
      rule_version: {
        id: ruleRow.id,
        rule_id: ruleRow.rule_id,
        version: ruleRow.version,
        title: ruleRow.title,
        effective_date: ruleRow.effective_date,
        standard_code: ruleRow.standard_code,
        accuracy_class: ruleRow.accuracy_class,
        requirement_text: ruleRow.requirement_text,
        calculation_ref: ruleRow.calculation_ref,
        formula_definition: formulaDef,
      },
      applicable_tests: applicableTests,
      instrument_parameters: {
        accuracy_class,
        max_capacity,
        capacity_unit,
        verification_scale_interval_e,
        scale_interval_unit,
        total_scale_intervals_n: n,
      },
    };
  }

  /**
   * Compute Maximum Permissible Error (MPE) for a given load m (in units of e)
   * under OIML R 76 Table 6
   */
  static computeMPEInUnitsOfE(accuracyClass: string, mInUnitsOfE: number): { mpeFactor: number; formulaUsed: string; intervalDesc: string } {
    const absM = Math.abs(mInUnitsOfE);
    switch (accuracyClass) {
      case 'I':
        if (absM <= 50000) return { mpeFactor: 0.5, formulaUsed: '±0.5e (0 ≤ m ≤ 50000e)', intervalDesc: '0 to 50,000 e' };
        if (absM <= 200000) return { mpeFactor: 1.0, formulaUsed: '±1.0e (50000e < m ≤ 200000e)', intervalDesc: '50,000 e to 200,000 e' };
        return { mpeFactor: 1.5, formulaUsed: '±1.5e (m > 200000e)', intervalDesc: '> 200,000 e' };

      case 'II':
        if (absM <= 5000) return { mpeFactor: 0.5, formulaUsed: '±0.5e (0 ≤ m ≤ 5000e)', intervalDesc: '0 to 5,000 e' };
        if (absM <= 20000) return { mpeFactor: 1.0, formulaUsed: '±1.0e (5000e < m ≤ 20000e)', intervalDesc: '5,000 e to 20,000 e' };
        return { mpeFactor: 1.5, formulaUsed: '±1.5e (20000e < m ≤ 100000e)', intervalDesc: '20,000 e to 100,000 e' };

      case 'IIII':
        if (absM <= 50) return { mpeFactor: 0.5, formulaUsed: '±0.5e (0 ≤ m ≤ 50e)', intervalDesc: '0 to 50 e' };
        if (absM <= 200) return { mpeFactor: 1.0, formulaUsed: '±1.0e (50e < m ≤ 200e)', intervalDesc: '50 e to 200 e' };
        return { mpeFactor: 1.5, formulaUsed: '±1.5e (200e < m ≤ 1000e)', intervalDesc: '200 e to 1,000 e' };

      case 'III':
      default:
        if (absM <= 500) return { mpeFactor: 0.5, formulaUsed: '±0.5e (0 ≤ m ≤ 500e)', intervalDesc: '0 to 500 e' };
        if (absM <= 2000) return { mpeFactor: 1.0, formulaUsed: '±1.0e (500e < m ≤ 2000e)', intervalDesc: '500 e to 2,000 e' };
        return { mpeFactor: 1.5, formulaUsed: '±1.5e (2000e < m ≤ 10000e)', intervalDesc: '2,000 e to 10,000 e' };
    }
  }
}
