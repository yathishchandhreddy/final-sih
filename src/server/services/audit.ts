import { v4 as uuidv4 } from 'uuid';
import { execute, queryRows } from '../db/database.ts';
import { UserPayload } from '../types/index.ts';

export interface AuditLogEntry {
  user?: UserPayload | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value?: any;
  after_value?: any;
  reason?: string;
  ip_address?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const id = uuidv4();
  const userId = entry.user?.id || 'SYSTEM';
  const userEmail = entry.user?.email || 'system@nawi.gov.in';
  const userRole = entry.user?.role || 'SYSTEM';
  const timestamp = new Date().toISOString();

  const beforeJson = entry.before_value !== undefined ? JSON.stringify(entry.before_value) : null;
  const afterJson = entry.after_value !== undefined ? JSON.stringify(entry.after_value) : null;

  await execute(
    `INSERT INTO audit_logs (id, user_id, user_email, user_role, action, entity_type, entity_id, before_value_json, after_value_json, reason, ip_address, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      userEmail,
      userRole,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      beforeJson,
      afterJson,
      entry.reason || null,
      entry.ip_address || '127.0.0.1',
      timestamp,
    ]
  );
}

export async function getAuditLogs(filter?: { entity_id?: string; action?: string; limit?: number }) {
  let sql = 'SELECT * FROM audit_logs';
  const params: any[] = [];
  const conditions: string[] = [];

  if (filter?.entity_id) {
    conditions.push('entity_id = ?');
    params.push(filter.entity_id);
  }
  if (filter?.action) {
    conditions.push('action = ?');
    params.push(filter.action);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY timestamp DESC';

  if (filter?.limit) {
    sql += ` LIMIT ${filter.limit}`;
  } else {
    sql += ' LIMIT 200';
  }

  return queryRows(sql, params);
}
