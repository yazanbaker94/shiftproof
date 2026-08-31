import type { SQLiteDatabase } from 'expo-sqlite';
import { logger } from '../observability/logger';

export const DATABASE_NAME = 'shiftproof.db';
const DATABASE_VERSION = 1;
export const DEMO_PERIOD_ID = 'sp-demo-2026-08-24';
export const HOME_SNAPSHOT_PERIOD_ID = 'sp-home-reference-snapshot';
export const REVIEW_SNAPSHOT_PERIOD_ID = 'sp-review-reference-snapshot';
export const DEMO_CLIENT_IDS = {
  apiMonday: '82f14000-0000-4000-9000-000000000011',
  apiThursday: '82f14000-0000-4000-9000-000000000012',
  apiWednesday: '82f14000-0000-4000-9000-000000000013',
  apiTuesdayAttention: '82f14000-0000-4000-9000-000000000014',
  homeMonday: '62f14000-0000-4000-9000-000000000011',
  homeTuesday: '62f14000-0000-4000-9000-000000000012',
  homeWednesday: '62f14000-0000-4000-9000-000000000013',
  homeThursday: '62f14000-0000-4000-9000-000000000014',
  reviewMonday: '72f14000-0000-4000-9000-000000000011',
  reviewTuesday: '72f14000-0000-4000-9000-000000000012',
  reviewWednesday: '72f14000-0000-4000-9000-000000000013',
  reviewThursday: '72f14000-0000-4000-9000-000000000014',
} as const;

export const API_DEMO_SEED = [
  { clientId: DEMO_CLIENT_IDS.apiMonday, workDate: '2026-08-24', regularMinutes: 480, overtimeMinutes: 0, note: '', status: 'APPROVED' },
  { clientId: DEMO_CLIENT_IDS.apiTuesdayAttention, workDate: '2026-08-25', regularMinutes: 960, overtimeMinutes: 0, note: 'Emergency inventory count after closing.', status: 'NEEDS_ATTENTION' },
  { clientId: DEMO_CLIENT_IDS.apiWednesday, workDate: '2026-08-26', regularMinutes: 480, overtimeMinutes: 0, note: '', status: 'APPROVED' },
  { clientId: DEMO_CLIENT_IDS.apiThursday, workDate: '2026-08-27', regularMinutes: 450, overtimeMinutes: 0, note: '', status: 'APPROVED' },
] as const;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = current?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        period_id TEXT NOT NULL,
        work_date TEXT NOT NULL,
        regular_minutes INTEGER NOT NULL CHECK (regular_minutes >= 0),
        overtime_minutes INTEGER NOT NULL CHECK (overtime_minutes >= 0),
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        local_created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        server_version INTEGER NOT NULL DEFAULT 0,
        receipt_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_time_entries_period_date
        ON time_entries(period_id, work_date);

      CREATE TABLE IF NOT EXISTS entry_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL,
        regular_minutes INTEGER NOT NULL,
        overtime_minutes INTEGER NOT NULL,
        note TEXT NOT NULL,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES time_entries(id)
      );

      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY NOT NULL,
        entry_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        operation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES time_entries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_operations_status
        ON sync_operations(status, next_attempt_at);

      CREATE TABLE IF NOT EXISTS sync_receipts (
        id TEXT PRIMARY KEY NOT NULL,
        entry_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        server_id TEXT NOT NULL,
        status TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        response_json TEXT NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES time_entries(id)
      );
    `);
  }

  await db.runAsync(
    'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
    'schema_version',
    String(DATABASE_VERSION),
  );
  await seedDemoIfNeeded(db);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  logger.info('database_migrated', { version: DATABASE_VERSION });
}

export async function seedDemoIfNeeded(db: SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM time_entries');
  if ((count?.count ?? 0) > 0) return;

  const createdAt = '2026-09-01T00:08:00.000Z';
  const rows = [
    ...API_DEMO_SEED.map((row) => [row.clientId, DEMO_PERIOD_ID, row.workDate, row.regularMinutes, row.overtimeMinutes, row.note, row.status] as const),
    [DEMO_CLIENT_IDS.homeMonday, HOME_SNAPSHOT_PERIOD_ID, '2026-08-24', 480, 0, '', 'APPROVED'],
    [DEMO_CLIENT_IDS.homeTuesday, HOME_SNAPSHOT_PERIOD_ID, '2026-08-25', 450, 0, '', 'APPROVED'],
    [DEMO_CLIENT_IDS.homeWednesday, HOME_SNAPSHOT_PERIOD_ID, '2026-08-26', 480, 0, '', 'APPROVED'],
    [DEMO_CLIENT_IDS.homeThursday, HOME_SNAPSHOT_PERIOD_ID, '2026-08-27', 480, 0, 'Inventory close ran late.', 'NEEDS_ATTENTION'],
    [DEMO_CLIENT_IDS.reviewMonday, REVIEW_SNAPSHOT_PERIOD_ID, '2026-08-31', 480, 0, '', 'APPROVED'],
    [DEMO_CLIENT_IDS.reviewTuesday, REVIEW_SNAPSHOT_PERIOD_ID, '2026-09-01', 960, 0, 'Emergency inventory count after closing.', 'NEEDS_ATTENTION'],
    [DEMO_CLIENT_IDS.reviewWednesday, REVIEW_SNAPSHOT_PERIOD_ID, '2026-09-02', 480, 0, '', 'APPROVED'],
    [DEMO_CLIENT_IDS.reviewThursday, REVIEW_SNAPSHOT_PERIOD_ID, '2026-09-03', 450, 0, '', 'PENDING_SYNC'],
  ] as const;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [id, periodId, date, regular, overtime, note, status] of rows) {
      await txn.runAsync(
        `INSERT INTO time_entries (
          id, server_id, period_id, work_date, regular_minutes, overtime_minutes,
          note, status, idempotency_key, local_created_at, updated_at, server_version, receipt_id
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        id,
        periodId,
        date,
        regular,
        overtime,
        note,
        status,
        `shiftproof:seed:${id}`,
        createdAt,
        createdAt,
      );
    }
  });
  logger.info('demo_seeded', { entries: rows.length });
}

export async function resetDemoDatabase(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      DELETE FROM sync_receipts;
      DELETE FROM sync_operations;
      DELETE FROM entry_revisions;
      DELETE FROM time_entries;
    `);
  });
  await seedDemoIfNeeded(db);
  logger.info('demo_reset');
}
