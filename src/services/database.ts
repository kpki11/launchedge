// src/services/database.ts
// v5.0 â€” Bug 16: table_relationships table + CRUD. Bug 19: getMySubmissions. Bug 11: hygiene helpers.

import * as SQLite from 'expo-sqlite';

// â”€â”€â”€ Singleton with promise guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('launchedge.db');
      await database.execAsync('PRAGMA journal_mode = WAL;');
      dbInstance = database;
      return database;
    })();
  }
  return dbInitPromise;
};

// â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const initDatabase = async (): Promise<void> => {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      storageMode TEXT DEFAULT 'local',
      googleEmail TEXT,
      joinCode TEXT,
      isOwner INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tables_meta (
      id TEXT PRIMARY KEY,
      businessId TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'grid-outline',
      category TEXT DEFAULT 'Custom',
      description TEXT,
      isActive INTEGER DEFAULT 1,
      colorTag TEXT DEFAULT 'gold',
      analyticsRole TEXT DEFAULT 'none',
      primaryAmountField TEXT DEFAULT '',
      primaryDateField TEXT DEFAULT '',
      primaryLabelField TEXT DEFAULT '',
      secondaryGroupField TEXT DEFAULT '',
      reorderField TEXT DEFAULT '',
      targetAmount REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS table_fields (
      id TEXT PRIMARY KEY,
      tableId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      isRequired INTEGER DEFAULT 0,
      defaultValue TEXT,
      options TEXT,
      sortOrder INTEGER DEFAULT 0,
      FOREIGN KEY (tableId) REFERENCES tables_meta(id)
    );

    CREATE TABLE IF NOT EXISTS table_records (
      id TEXT PRIMARY KEY,
      tableId TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdBy TEXT DEFAULT 'owner',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      syncedAt TEXT,
      FOREIGN KEY (tableId) REFERENCES tables_meta(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      tableId TEXT NOT NULL,
      recordId TEXT,
      changeType TEXT NOT NULL,
      oldData TEXT,
      newData TEXT NOT NULL,
      requestedBy TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewedBy TEXT,
      reviewedAt TEXT,
      note TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      businessId TEXT,
      tableId TEXT,
      recordId TEXT,
      action TEXT NOT NULL,
      performedBy TEXT NOT NULL,
      details TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS table_relationships (
      id TEXT PRIMARY KEY,
      fromTableId TEXT NOT NULL,
      fromField TEXT NOT NULL,
      toTableId TEXT NOT NULL,
      toField TEXT NOT NULL,
      label TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fromTableId) REFERENCES tables_meta(id),
      FOREIGN KEY (toTableId)   REFERENCES tables_meta(id)
    );

    CREATE TABLE IF NOT EXISTS user_charts (
      id TEXT PRIMARY KEY,
      businessId TEXT NOT NULL,
      tableId TEXT NOT NULL,
      title TEXT NOT NULL,
      chartType TEXT DEFAULT 'bar',
      metricField TEXT NOT NULL,
      aggregation TEXT DEFAULT 'sum',
      dateField TEXT DEFAULT '',
      groupField TEXT DEFAULT '',
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    );
  `);

  // â”€â”€ Migration: add analytics columns to existing tables_meta rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const analyticsColumns: { col: string; def: string }[] = [
    { col: 'analyticsRole',       def: "TEXT DEFAULT 'none'" },
    { col: 'primaryAmountField',  def: "TEXT DEFAULT ''" },
    { col: 'primaryDateField',    def: "TEXT DEFAULT ''" },
    { col: 'primaryLabelField',   def: "TEXT DEFAULT ''" },
    { col: 'secondaryGroupField', def: "TEXT DEFAULT ''" },
    { col: 'reorderField',        def: "TEXT DEFAULT ''" },
    { col: 'targetAmount',        def: 'REAL DEFAULT 0' },
  ];
  for (const { col, def } of analyticsColumns) {
    try { await database.execAsync(`ALTER TABLE tables_meta ADD COLUMN ${col} ${def};`); }
    catch { /* column already exists â€” ignore */ }
  }

  // -- Migration: add joinCode / isOwner to existing businesses rows
  const businessColumns: { col: string; def: string }[] = [
    { col: 'joinCode', def: 'TEXT' },
    { col: 'isOwner',  def: 'INTEGER DEFAULT 1' },
  ];
  for (const { col, def } of businessColumns) {
    try { await database.execAsync(`ALTER TABLE businesses ADD COLUMN ${col} ${def};`); }
    catch { /* already exists */ }
  }

  // -- Migration: fix emoji icons in tables_meta to valid Ionicons names
  const emojiToIonicons: Record<string, string> = {
    '\u{1F4B0}': 'cash-outline',
    '\u{1F4B8}': 'trending-down-outline',
    '\u{1F4E6}': 'cube-outline',
    '\u{1F465}': 'people-outline',
    '\u{1F4CB}': 'clipboard-outline',
    '\u{1F4CA}': 'bar-chart-outline',
    '\u{1F6D2}': 'cart-outline',
    '\u{1F4C5}': 'calendar-outline',
    '\u2705': 'checkmark-circle-outline',
    '\u{1F527}': 'construct-outline',
    '\u{1F4DD}': 'create-outline',
    '\u{1F3E2}': 'business-outline',
    '\u{1F464}': 'person-outline',
    '\u{1F69A}': 'car-outline',
    '\u{1F48A}': 'medical-outline',
    '\u{1F4DE}': 'call-outline',
  };
  try {
    const allTableRows = await database.getAllAsync<{ id: string; icon: string }>('SELECT id, icon FROM tables_meta');
    for (const row of allTableRows) {
      const mapped = emojiToIonicons[row.icon];
      if (mapped) {
        await database.runAsync('UPDATE tables_meta SET icon = ? WHERE id = ?', [mapped, row.id]);
      } else if (row.icon && row.icon.length <= 2 && row.icon.charCodeAt(0) > 127) {
        await database.runAsync('UPDATE tables_meta SET icon = ? WHERE id = ?', ['grid-outline', row.id]);
      }
    }
  } catch { /* migration best-effort */ }
};

// â”€â”€â”€ BUSINESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const insertBusiness = async (data: {
  id: string; name: string; type: string; storageMode: string; googleEmail?: string; joinCode?: string; isOwner?: number;
}): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO businesses (id, name, type, storageMode, googleEmail, joinCode, isOwner) VALUES (?, ?, ?, ?, ?, ?, ?)`,  
    [data.id, data.name, data.type, data.storageMode, data.googleEmail ?? null, data.joinCode ?? null, data.isOwner ?? 1]
  );
};

export const getActiveBusiness = async (): Promise<any> => {
  const database = await getDb();
  return await database.getFirstAsync(
    `SELECT * FROM businesses ORDER BY createdAt DESC LIMIT 1`
  );
};

export const getBusinessByJoinCode = async (joinCode: string): Promise<any> => {
  const database = await getDb();
  return await database.getFirstAsync(
    `SELECT * FROM businesses WHERE joinCode = ? LIMIT 1`,
    [joinCode]
  );
};

export const updateBusinessJoinCode = async (businessId: string, joinCode: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE businesses SET joinCode = ? WHERE id = ?`,
    [joinCode, businessId]
  );
};

export const updateBusinessName = async (businessId: string, name: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE businesses SET name = ? WHERE id = ?`,
    [name, businessId]
  );
};


// â”€â”€â”€ TABLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const createTable = async (data: {
  id: string; businessId: string; name: string; icon: string;
  category: string; description?: string;
  fields: Array<{ name: string; type: string; isRequired?: boolean; defaultValue?: string }>;
}): Promise<void> => {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO tables_meta (id, businessId, name, icon, category, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.id, data.businessId, data.name, data.icon, data.category, data.description ?? '']
    );
    for (let i = 0; i < data.fields.length; i++) {
      const f = data.fields[i];
      await database.runAsync(
        `INSERT INTO table_fields (id, tableId, name, type, isRequired, defaultValue, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`${data.id}_f${i}`, data.id, f.name, f.type, f.isRequired ? 1 : 0, f.defaultValue ?? '', i]
      );
    }
  });
};

export const getTables = async (businessId: string): Promise<any[]> => {
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT t.*,
       (SELECT COUNT(*) FROM table_records r WHERE r.tableId = t.id AND r.status != 'deleted') AS recordCount
     FROM tables_meta t
     WHERE t.businessId = ? AND t.isActive = 1
     ORDER BY t.createdAt`,
    [businessId]
  );
};

export const getTableFields = async (tableId: string): Promise<any[]> => {
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT * FROM table_fields WHERE tableId = ? ORDER BY sortOrder`, [tableId]
  );
};

export const renameTable = async (tableId: string, newName: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE tables_meta SET name = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [newName, tableId]
  );
};

export const deleteTable = async (tableId: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE tables_meta SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [tableId]
  );
};

// â”€â”€â”€ ANALYTICS CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const saveAnalyticsConfig = async (
  tableId: string,
  config: {
    analyticsRole: string; primaryAmountField: string; primaryDateField: string;
    primaryLabelField?: string; secondaryGroupField?: string;
    reorderField?: string; targetAmount?: number;
  }
): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE tables_meta SET
       analyticsRole=?, primaryAmountField=?, primaryDateField=?,
       primaryLabelField=?, secondaryGroupField=?, reorderField=?,
       targetAmount=?, updatedAt=CURRENT_TIMESTAMP
     WHERE id=?`,
    [
      config.analyticsRole, config.primaryAmountField, config.primaryDateField,
      config.primaryLabelField ?? '', config.secondaryGroupField ?? '',
      config.reorderField ?? '', config.targetAmount ?? 0, tableId,
    ]
  );
};

export const getTableAnalyticsConfig = async (tableId: string): Promise<any> => {
  const database = await getDb();
  const meta: any = await database.getFirstAsync(`SELECT * FROM tables_meta WHERE id = ?`, [tableId]);
  const fields: any[] = await database.getAllAsync(
    `SELECT * FROM table_fields WHERE tableId = ? ORDER BY sortOrder`, [tableId]
  );
  return {
    analyticsRole: meta?.analyticsRole ?? 'none',
    primaryAmountField: meta?.primaryAmountField ?? '',
    primaryDateField: meta?.primaryDateField ?? '',
    primaryLabelField: meta?.primaryLabelField ?? '',
    secondaryGroupField: meta?.secondaryGroupField ?? '',
    reorderField: meta?.reorderField ?? '',
    targetAmount: meta?.targetAmount ?? 0,
    fields,
    ...(meta ?? {}),
  };
};

// â”€â”€â”€ TABLE RELATIONSHIPS (Bug 16) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getTableRelationships = async (tableId: string): Promise<any[]> => {
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT r.*,
       tf.name AS fromTableName,
       tt.name AS toTableName
     FROM table_relationships r
     JOIN tables_meta tf ON r.fromTableId = tf.id
     JOIN tables_meta tt ON r.toTableId   = tt.id
     WHERE r.fromTableId = ? OR r.toTableId = ?
     ORDER BY r.createdAt`,
    [tableId, tableId]
  );
};

export const createTableRelationship = async (rel: {
  id: string; fromTableId: string; fromField: string;
  toTableId: string; toField: string; label?: string;
}): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO table_relationships (id, fromTableId, fromField, toTableId, toField, label)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rel.id, rel.fromTableId, rel.fromField, rel.toTableId, rel.toField, rel.label ?? '']
  );
};

export const deleteTableRelationship = async (relId: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(`DELETE FROM table_relationships WHERE id = ?`, [relId]);
};

// â”€â”€â”€ RECORDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const addRecord = async (data: {
  id: string; tableId: string; data: object; createdBy: string; requiresApproval?: boolean;
}): Promise<void> => {
  const database = await getDb();
  const status = data.requiresApproval ? 'pending_approval' : 'active';
  await database.runAsync(
    `INSERT INTO table_records (id, tableId, data, status, createdBy) VALUES (?, ?, ?, ?, ?)`,
    [data.id, data.tableId, JSON.stringify(data.data), status, data.createdBy]
  );
};

export const addRecordsBatch = async (tableId: string, rows: object[], createdBy = 'owner'): Promise<void> => {
  if (rows.length === 0) return;
  const database = await getDb();
  const now = Date.now();
  await database.withTransactionAsync(async () => {
    for (let i = 0; i < rows.length; i++) {
      const id = `${tableId}_${now}_${i}_${Math.random().toString(36).slice(2, 5)}`;
      await database.runAsync(
        `INSERT INTO table_records (id, tableId, data, status, createdBy) VALUES (?, ?, ?, 'active', ?)`,
        [id, tableId, JSON.stringify(rows[i]), createdBy]
      );
    }
  });
};

export const getRecords = async (
  tableId: string,
  filters?: { status?: string; search?: string; limit?: number }
): Promise<any[]> => {
  const database = await getDb();
  let query = `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted'`;
  const params: any[] = [tableId];
  if (filters?.status) { query += ` AND status = ?`; params.push(filters.status); }
  query += ` ORDER BY createdAt DESC`;
  if (filters?.limit) { query += ` LIMIT ?`; params.push(filters.limit); }
  const rows: any[] = await database.getAllAsync(query, params);
  return rows.map((r) => ({ ...r, data: JSON.parse(r.data) }));
};

export const updateRecord = async (recordId: string, newData: object): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE table_records SET data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(newData), recordId]
  );
};

export const deleteRecord = async (recordId: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE table_records SET status = 'deleted', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [recordId]
  );
};

// â”€â”€â”€ MY SUBMISSIONS (Bug 19) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getMySubmissions = async (
  businessId: string,
  submittedBy: string,
  limit = 50
): Promise<any[]> => {
  const database = await getDb();
  const rows: any[] = await database.getAllAsync(
    `SELECT r.*, t.name AS tableName, t.icon AS tableIcon
     FROM table_records r
     JOIN tables_meta t ON r.tableId = t.id
     WHERE t.businessId = ?
       AND r.createdBy  = ?
       AND r.status    != 'deleted'
     ORDER BY r.createdAt DESC
     LIMIT ?`,
    [businessId, submittedBy, limit]
  );
  return rows.map((r) => ({
    ...r,
    data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
  }));
};

// â”€â”€â”€ DATA HYGIENE helpers (Bug 11) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Returns every record across all tables that has at least one null/empty field. */
export const getNullFieldRecords = async (
  businessId: string
): Promise<{ tableId: string; tableName: string; recordId: string; emptyFields: string[]; data: any }[]> => {
  const database = await getDb();
  const tables: any[] = await database.getAllAsync(
    `SELECT * FROM tables_meta WHERE businessId = ? AND isActive = 1`, [businessId]
  );
  const results: any[] = [];
  for (const t of tables) {
    const fields: any[] = await database.getAllAsync(
      `SELECT * FROM table_fields WHERE tableId = ? ORDER BY sortOrder`, [t.id]
    );
    const records: any[] = await database.getAllAsync(
      `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted'`, [t.id]
    );
    for (const rec of records) {
      let parsed: any = {};
      try { parsed = JSON.parse(rec.data); } catch { /* ignore */ }
      const emptyFields = fields
        .map((f: any) => f.name)
        .filter((name: string) => {
          const v = parsed[name];
          return v === undefined || v === null || String(v).trim() === '';
        });
      if (emptyFields.length > 0) {
        results.push({ tableId: t.id, tableName: t.name, recordId: rec.id, emptyFields, data: parsed });
      }
    }
  }
  return results;
};

/** Trim all string fields in a record in-place. */
export const trimRecordFields = async (recordId: string): Promise<void> => {
  const database = await getDb();
  const row: any = await database.getFirstAsync(
    `SELECT data FROM table_records WHERE id = ?`, [recordId]
  );
  if (!row) return;
  let parsed: any = {};
  try { parsed = JSON.parse(row.data); } catch { return; }
  const trimmed: any = {};
  for (const [k, v] of Object.entries(parsed)) {
    trimmed[k] = typeof v === 'string' ? v.trim() : v;
  }
  await database.runAsync(
    `UPDATE table_records SET data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(trimmed), recordId]
  );
};

/** Fill a specific field across many records with a given value. */
export const bulkFillField = async (
  tableId: string,
  fieldName: string,
  fillValue: string
): Promise<number> => {
  const database = await getDb();
  const records: any[] = await database.getAllAsync(
    `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted'`, [tableId]
  );
  let count = 0;
  for (const rec of records) {
    let parsed: any = {};
    try { parsed = JSON.parse(rec.data); } catch { continue; }
    const val = parsed[fieldName];
    if (val === undefined || val === null || String(val).trim() === '') {
      parsed[fieldName] = fillValue;
      await database.runAsync(
        `UPDATE table_records SET data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(parsed), rec.id]
      );
      count++;
    }
  }
  return count;
};

/** Find duplicate records within a table (same value in the specified field). */
export const findDuplicates = async (
  tableId: string,
  keyField: string
): Promise<{ key: string; records: any[] }[]> => {
  const database = await getDb();
  const records: any[] = await database.getAllAsync(
    `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted' ORDER BY createdAt`, [tableId]
  );
  const groups: Record<string, any[]> = {};
  for (const rec of records) {
    let parsed: any = {};
    try { parsed = JSON.parse(rec.data); } catch { continue; }
    const key = String(parsed[keyField] ?? '').trim().toLowerCase();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...rec, data: parsed });
  }
  return Object.entries(groups)
    .filter(([, arr]) => arr.length > 1)
    .map(([key, records]) => ({ key, records }));
};

// â”€â”€â”€ APPROVALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getPendingApprovals = async (businessId: string): Promise<any[]> => {
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT a.*, t.name AS tableName FROM approvals a
     JOIN tables_meta t ON a.tableId = t.id
     WHERE t.businessId = ? AND a.status = 'pending'
     ORDER BY a.createdAt DESC`,
    [businessId]
  );
};

export const approveRecord = async (approvalId: string, reviewedBy: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE approvals SET status='approved', reviewedBy=?, reviewedAt=CURRENT_TIMESTAMP WHERE id=?`,
    [reviewedBy, approvalId]
  );
};

export const rejectRecord = async (approvalId: string, reviewedBy: string, note: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `UPDATE approvals SET status='rejected', reviewedBy=?, reviewedAt=CURRENT_TIMESTAMP, note=? WHERE id=?`,
    [reviewedBy, note, approvalId]
  );
};

// â”€â”€â”€ AUDIT LOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const logAction = async (data: {
  id: string; businessId: string; tableId?: string;
  recordId?: string; action: string; performedBy: string; details?: string;
}): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO audit_log (id, businessId, tableId, recordId, action, performedBy, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.id, data.businessId, data.tableId ?? null, data.recordId ?? null,
     data.action, data.performedBy, data.details ?? null]
  );
};

export const getRecentAuditLog = async (businessId: string, limit = 10): Promise<any[]> => {
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT a.*, t.name AS tableName FROM audit_log a
     LEFT JOIN tables_meta t ON a.tableId = t.id
     WHERE a.businessId = ? ORDER BY a.createdAt DESC LIMIT ?`,
    [businessId, limit]
  );
};

// â”€â”€â”€ LINK HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const searchLinkedRecords = async (tableId: string, query: string, limit = 50): Promise<any[]> => {
  const database = await getDb();
  let rows: any[];
  if (query && query.trim().length > 0) {
    rows = await database.getAllAsync(
      `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted' AND data LIKE ?
       ORDER BY createdAt DESC LIMIT ?`,
      [tableId, `%${query}%`, limit]
    );
  } else {
    rows = await database.getAllAsync(
      `SELECT * FROM table_records WHERE tableId = ? AND status != 'deleted'
       ORDER BY createdAt DESC LIMIT ?`,
      [tableId, limit]
    );
  }
  return rows.map((r) => ({ ...r, data: JSON.parse(r.data) }));
};

export const getLinkedRecord = async (tableId: string, recordId: string): Promise<any | null> => {
  const database = await getDb();
  const row: any = await database.getFirstAsync(
    `SELECT * FROM table_records WHERE tableId = ? AND id = ? AND status != 'deleted'`,
    [tableId, recordId]
  );
  if (!row) return null;
  let parsed: any = {};
  try { if (row.data) parsed = JSON.parse(row.data); } catch { parsed = {}; }
  return { ...row, data: parsed };
};

// â”€â”€ user_charts: CRUD for user-created charts in InsightsScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getUserCharts = async (businessId: string): Promise<any[]> => {
  const db = await getDb();
  const result = await db.getAllAsync(
    'SELECT * FROM user_charts WHERE businessId = ? ORDER BY sortOrder ASC, createdAt ASC',
    [businessId]
  );
  return result as any[];
};

export const saveUserChart = async (chart: {
  id: string;
  businessId: string;
  tableId: string;
  title: string;
  chartType: string;
  metricField: string;
  aggregation: string;
  dateField: string;
  groupField: string;
  sortOrder: number;
}): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO user_charts
     (id, businessId, tableId, title, chartType, metricField, aggregation, dateField, groupField, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chart.id, chart.businessId, chart.tableId, chart.title,
      chart.chartType, chart.metricField, chart.aggregation,
      chart.dateField, chart.groupField, chart.sortOrder,
    ]
  );
};

export const updateUserChart = async (
  chartId: string,
  updates: { title?: string; chartType?: string }
): Promise<void> => {
  const db = await getDb();
  if (updates.title !== undefined) {
    await db.runAsync('UPDATE user_charts SET title = ? WHERE id = ?', [updates.title, chartId]);
  }
  if (updates.chartType !== undefined) {
    await db.runAsync('UPDATE user_charts SET chartType = ? WHERE id = ?', [updates.chartType, chartId]);
  }
};

export const deleteUserChart = async (chartId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync('DELETE FROM user_charts WHERE id = ?', [chartId]);
};



// -- clearAllData: wipe every table for a full reset
export const clearAllData = async (): Promise<void> => {
  const db = await getDb();
  // Delete in FK-safe order: children first, then parents
  await db.runAsync('DELETE FROM user_charts');
  await db.runAsync('DELETE FROM table_relationships');
  await db.runAsync('DELETE FROM audit_log');
  await db.runAsync('DELETE FROM approvals');
  await db.runAsync('DELETE FROM table_records');
  await db.runAsync('DELETE FROM table_fields');
  await db.runAsync('DELETE FROM tables_meta');
  await db.runAsync('DELETE FROM businesses');
};



