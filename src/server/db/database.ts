import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'nawi_report.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');
  initSchema(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      designation TEXT,
      organization TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS instruments (
      id TEXT PRIMARY KEY,
      instrument_code TEXT UNIQUE NOT NULL,
      applicant_name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model_number TEXT NOT NULL,
      instrument_type TEXT NOT NULL,
      accuracy_class TEXT NOT NULL,
      max_capacity REAL NOT NULL,
      capacity_unit TEXT NOT NULL,
      verification_scale_interval_e REAL NOT NULL,
      scale_interval_unit TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      indicator_details TEXT,
      load_cell_details TEXT,
      application_number TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS instrument_configs (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL,
      config_version INTEGER NOT NULL DEFAULT 1,
      min_capacity REAL,
      tare_capacity REAL,
      temperature_range_min REAL,
      temperature_range_max REAL,
      power_supply TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rule_versions (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      standard_code TEXT NOT NULL,
      instrument_type TEXT NOT NULL,
      accuracy_class TEXT NOT NULL,
      test_type TEXT NOT NULL,
      requirement_text TEXT NOT NULL,
      calculation_ref TEXT NOT NULL,
      formula_definition TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_definitions (
      id TEXT PRIMARY KEY,
      test_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      standard_ref TEXT NOT NULL,
      oiml_clause TEXT NOT NULL,
      description TEXT NOT NULL,
      supported_in_mvp INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS test_plans (
      id TEXT PRIMARY KEY,
      test_plan_code TEXT UNIQUE NOT NULL,
      instrument_id TEXT NOT NULL,
      rule_version_id TEXT NOT NULL,
      rule_version_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      overall_decision TEXT DEFAULT 'PENDING',
      summary_notes TEXT,
      generated_by TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE RESTRICT,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id)
    );

    CREATE TABLE IF NOT EXISTS test_instances (
      id TEXT PRIMARY KEY,
      test_plan_id TEXT NOT NULL,
      test_definition_id TEXT NOT NULL,
      test_code TEXT NOT NULL,
      test_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      supported INTEGER DEFAULT 1,
      execution_order INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      decision TEXT DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      FOREIGN KEY (test_plan_id) REFERENCES test_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      test_instance_id TEXT NOT NULL,
      load_point REAL NOT NULL,
      reference_mass REAL NOT NULL,
      mass_unit TEXT NOT NULL,
      indication_increasing REAL,
      indication_decreasing REAL,
      delta_l REAL DEFAULT 0,
      position_corner TEXT,
      run_number INTEGER DEFAULT 1,
      tare_applied REAL DEFAULT 0,
      temp_celsius REAL,
      recorded_by TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (test_instance_id) REFERENCES test_instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      test_instance_id TEXT NOT NULL,
      input_values_json TEXT NOT NULL,
      formula_ref TEXT NOT NULL,
      calculation_version TEXT NOT NULL,
      rule_version TEXT NOT NULL,
      result_value REAL NOT NULL,
      applicable_mpe REAL NOT NULL,
      comparison_text TEXT NOT NULL,
      decision TEXT NOT NULL,
      calculation_steps_json TEXT NOT NULL,
      calculated_by TEXT NOT NULL,
      calculated_at TEXT NOT NULL,
      FOREIGN KEY (test_instance_id) REFERENCES test_instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS compliance_results (
      id TEXT PRIMARY KEY,
      test_plan_id TEXT NOT NULL,
      test_instance_id TEXT NOT NULL,
      test_code TEXT NOT NULL,
      evaluated_mpe REAL NOT NULL,
      actual_error REAL NOT NULL,
      decision TEXT NOT NULL,
      summary TEXT,
      evaluated_at TEXT NOT NULL,
      evaluated_by TEXT NOT NULL,
      FOREIGN KEY (test_plan_id) REFERENCES test_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_states (
      id TEXT PRIMARY KEY,
      test_plan_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      user_role TEXT NOT NULL,
      reason TEXT,
      is_override INTEGER DEFAULT 0,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (test_plan_id) REFERENCES test_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_value_json TEXT,
      after_value_json TEXT,
      reason TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      report_number TEXT UNIQUE NOT NULL,
      instrument_id TEXT NOT NULL,
      test_plan_id TEXT NOT NULL,
      rule_version_used TEXT NOT NULL,
      calculation_version_used TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'FINALIZED',
      reviewer_id TEXT,
      reviewer_name TEXT,
      approving_authority_id TEXT,
      approving_authority_name TEXT,
      summary TEXT,
      finalized_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (instrument_id) REFERENCES instruments(id),
      FOREIGN KEY (test_plan_id) REFERENCES test_plans(id)
    );

    CREATE TABLE IF NOT EXISTS report_hashes (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      verification_id TEXT UNIQUE NOT NULL,
      sha256_hash TEXT NOT NULL,
      report_payload_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      test_instance_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (test_instance_id) REFERENCES test_instances(id)
    );

    -- Indices
    CREATE INDEX IF NOT EXISTS idx_instruments_code ON instruments(instrument_code);
    CREATE INDEX IF NOT EXISTS idx_instruments_mfg ON instruments(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_instruments_model ON instruments(model_number);
    CREATE INDEX IF NOT EXISTS idx_test_plans_status ON test_plans(status);
    CREATE INDEX IF NOT EXISTS idx_test_plans_inst ON test_plans(instrument_id);
    CREATE INDEX IF NOT EXISTS idx_reports_num ON reports(report_number);
    CREATE INDEX IF NOT EXISTS idx_reports_inst ON reports(instrument_id);
    CREATE INDEX IF NOT EXISTS idx_reports_plan ON reports(test_plan_id);
    CREATE INDEX IF NOT EXISTS idx_report_hashes_ver ON report_hashes(verification_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
  `);

  // Column migrations for Legal Metrology inspection workflow
  const addCol = (table: string, col: string, def: string) => {
    try {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
    } catch (e) {
      // Column already exists
    }
  };

  addCol('instruments', 'latitude', 'REAL');
  addCol('instruments', 'longitude', 'REAL');
  addCol('instruments', 'installation_address', 'TEXT');
  addCol('instruments', 'contact_email', 'TEXT');
  addCol('instruments', 'contact_phone', 'TEXT');

  addCol('test_plans', 'scheduled_date', 'TEXT');
  addCol('test_plans', 'site_address', 'TEXT');
  addCol('test_plans', 'target_latitude', 'REAL');
  addCol('test_plans', 'target_longitude', 'REAL');
  addCol('test_plans', 'geofence_radius_m', 'REAL DEFAULT 500');
  addCol('test_plans', 'assigned_inspector_id', 'TEXT');
  addCol('test_plans', 'assigned_sub_inspector_id', 'TEXT');
  addCol('test_plans', 'assigned_engineer_id', 'TEXT');
  addCol('test_plans', 'verified_latitude', 'REAL');
  addCol('test_plans', 'verified_longitude', 'REAL');
  addCol('test_plans', 'verified_distance_m', 'REAL');
  addCol('test_plans', 'gps_verified_at', 'TEXT');
  addCol('test_plans', 'gps_status', 'TEXT');
  addCol('test_plans', 'photo_verification_url', 'TEXT');
  addCol('test_plans', 'photo_verified_at', 'TEXT');
  addCol('test_plans', 'standard_weights_json', 'TEXT');
  addCol('test_plans', 'standards_verified_by', 'TEXT');
  addCol('test_plans', 'standards_verified_at', 'TEXT');
  addCol('test_plans', 'inspector_recommendation', 'TEXT');
  addCol('test_plans', 'inspector_notes', 'TEXT');
  addCol('test_plans', 'inspector_reviewed_at', 'TEXT');
}

// Database helper functions for easy querying
export async function queryRows<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  if (!params || params.length === 0) {
    db.run(sql);
  } else {
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
  }
  saveDb();
}
