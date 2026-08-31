import type { SQLiteDatabase } from 'expo-sqlite';
import { createIdempotencyKey } from '../domain/logic';
import type {
  DraftEntry,
  EntryStatus,
  SavedEntryResult,
  SyncOperation,
  SyncReceipt,
  TimeEntry,
} from '../domain/types';
import { DEMO_PERIOD_ID, HOME_SNAPSHOT_PERIOD_ID, REVIEW_SNAPSHOT_PERIOD_ID } from './database';
import { nextAttemptIso, shouldAttempt } from './queuePolicy';

type EntryRow = {
  id: string;
  server_id: string | null;
  period_id: string;
  work_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  note: string;
  status: EntryStatus;
  idempotency_key: string;
  local_created_at: string;
  updated_at: string;
  server_version: number;
  receipt_id: string | null;
};

type OperationRow = {
  id: string;
  entry_id: string;
  idempotency_key: string;
  operation_type: SyncOperation['operationType'];
  payload: string;
  status: SyncOperation['status'];
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const mapEntry = (row: EntryRow): TimeEntry => ({
  id: row.id,
  serverId: row.server_id,
  periodId: row.period_id,
  workDate: row.work_date,
  regularMinutes: row.regular_minutes,
  overtimeMinutes: row.overtime_minutes,
  note: row.note,
  status: row.status,
  idempotencyKey: row.idempotency_key,
  localCreatedAt: row.local_created_at,
  updatedAt: row.updated_at,
  serverVersion: row.server_version,
  receiptId: row.receipt_id,
});

const mapOperation = (row: OperationRow): SyncOperation => ({
  id: row.id,
  entryId: row.entry_id,
  idempotencyKey: row.idempotency_key,
  operationType: row.operation_type,
  payload: row.payload,
  status: row.status,
  attempts: row.attempts,
  nextAttemptAt: row.next_attempt_at,
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listEntries(db: SQLiteDatabase): Promise<TimeEntry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM time_entries WHERE period_id IN (?, ?, ?) ORDER BY work_date ASC, updated_at ASC',
    DEMO_PERIOD_ID,
    HOME_SNAPSHOT_PERIOD_ID,
    REVIEW_SNAPSHOT_PERIOD_ID,
  );
  return rows.map(mapEntry);
}

export async function getEntry(db: SQLiteDatabase, id: string): Promise<TimeEntry | null> {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM time_entries WHERE id = ?', id);
  return row ? mapEntry(row) : null;
}

export async function saveEntryAndEnqueue(
  db: SQLiteDatabase,
  draft: DraftEntry,
  operationId: string,
): Promise<SavedEntryResult> {
  const now = new Date().toISOString();
  const operationKey = createIdempotencyKey(operationId);
  let entryId = operationId;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<EntryRow>(
      'SELECT * FROM time_entries WHERE period_id = ? AND work_date = ? ORDER BY updated_at DESC LIMIT 1',
      DEMO_PERIOD_ID,
      draft.workDate,
    );

    if (existing) {
      entryId = existing.id;
      await txn.runAsync(
        `INSERT INTO entry_revisions
          (entry_id, regular_minutes, overtime_minutes, note, status, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        existing.id,
        existing.regular_minutes,
        existing.overtime_minutes,
        existing.note,
        existing.status,
        now,
      );
      await txn.runAsync(
        `UPDATE time_entries SET
          regular_minutes = ?, overtime_minutes = ?, note = ?, status = 'PENDING_SYNC',
          idempotency_key = ?, updated_at = ?, server_version = server_version + 1
         WHERE id = ?`,
        draft.regularMinutes,
        draft.overtimeMinutes,
        draft.note,
        operationKey,
        now,
        existing.id,
      );
    } else {
      await txn.runAsync(
        `INSERT INTO time_entries (
          id, server_id, period_id, work_date, regular_minutes, overtime_minutes,
          note, status, idempotency_key, local_created_at, updated_at, server_version, receipt_id
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?, ?, 0, NULL)`,
        entryId,
        DEMO_PERIOD_ID,
        draft.workDate,
        draft.regularMinutes,
        draft.overtimeMinutes,
        draft.note,
        operationKey,
        now,
        now,
      );
    }

    const payload = JSON.stringify({
      clientId: entryId,
      workDate: draft.workDate,
      regularMinutes: draft.regularMinutes,
      overtimeMinutes: draft.overtimeMinutes,
      note: draft.note || undefined,
    });
    await txn.runAsync(
      `INSERT INTO sync_operations (
        id, entry_id, idempotency_key, operation_type, payload,
        status, attempts, next_attempt_at, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, 'CREATE_TIME_ENTRY', ?, 'PENDING', 0, NULL, NULL, ?, ?)`,
      operationId,
      entryId,
      operationKey,
      payload,
      now,
      now,
    );
  });

  const entry = await getEntry(db, entryId);
  const operation = await getOperation(db, operationId);
  if (!entry || !operation) throw new Error('Atomic save did not produce the expected entry and queue row.');
  return { entry, operation };
}

export async function confirmEntryAndEnqueue(
  db: SQLiteDatabase,
  entryId: string,
  note: string,
  operationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const operationKey = `shiftproof:confirm:${operationId}`;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE time_entries SET note = ?, status = 'SUBMITTED', updated_at = ? WHERE id = ?`,
      note,
      now,
      entryId,
    );
    await txn.runAsync(
      `INSERT INTO sync_operations (
        id, entry_id, idempotency_key, operation_type, payload,
        status, attempts, next_attempt_at, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, 'CONFIRM_TIME_ENTRY', ?, 'PENDING', 0, NULL, NULL, ?, ?)`,
      operationId,
      entryId,
      operationKey,
      JSON.stringify({ note }),
      now,
      now,
    );
  });
}

export async function getOperation(db: SQLiteDatabase, id: string): Promise<SyncOperation | null> {
  const row = await db.getFirstAsync<OperationRow>('SELECT * FROM sync_operations WHERE id = ?', id);
  return row ? mapOperation(row) : null;
}

export async function listDueOperations(db: SQLiteDatabase): Promise<SyncOperation[]> {
  const rows = await db.getAllAsync<OperationRow>(
    `SELECT * FROM sync_operations
     WHERE status IN ('PENDING', 'SYNCING', 'WAITING_RETRY')
     ORDER BY created_at ASC`,
  );
  return rows.map(mapOperation).filter((row) => shouldAttempt(row.status, row.nextAttemptAt));
}

export async function markOperationSyncing(db: SQLiteDatabase, operationId: string): Promise<void> {
  await db.runAsync(
    `UPDATE sync_operations SET status = 'SYNCING', updated_at = ? WHERE id = ?`,
    new Date().toISOString(),
    operationId,
  );
}

export async function markOperationFailed(
  db: SQLiteDatabase,
  operation: SyncOperation,
  message: string,
): Promise<void> {
  const attempts = operation.attempts + 1;
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_operations SET status = 'WAITING_RETRY', attempts = ?, next_attempt_at = ?,
      last_error = ?, updated_at = ? WHERE id = ?`,
    attempts,
    nextAttemptIso(attempts),
    message.slice(0, 500),
    now,
    operation.id,
  );
}

export async function applySyncSuccess(
  db: SQLiteDatabase,
  operation: SyncOperation,
  values: { serverId: string; status: EntryStatus; response: unknown },
): Promise<void> {
  const now = new Date().toISOString();
  const receipt: SyncReceipt = {
    id: `receipt:${operation.idempotencyKey}`,
    entryId: operation.entryId,
    idempotencyKey: operation.idempotencyKey,
    serverId: values.serverId,
    status: values.status,
    syncedAt: now,
    responseJson: JSON.stringify(values.response),
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE time_entries SET server_id = ?, status = ?, updated_at = ?, receipt_id = ? WHERE id = ?`,
      values.serverId,
      values.status,
      now,
      receipt.id,
      operation.entryId,
    );
    await txn.runAsync(
      `UPDATE sync_operations SET status = 'SUCCEEDED', next_attempt_at = NULL,
        last_error = NULL, updated_at = ? WHERE id = ?`,
      now,
      operation.id,
    );
    await txn.runAsync(
      `INSERT OR REPLACE INTO sync_receipts
        (id, entry_id, idempotency_key, server_id, status, synced_at, response_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      receipt.id,
      receipt.entryId,
      receipt.idempotencyKey,
      receipt.serverId,
      receipt.status,
      receipt.syncedAt,
      receipt.responseJson,
    );
  });
}

export async function applyRemoteEntryStatus(
  db: SQLiteDatabase,
  clientId: string,
  serverId: string,
  status: EntryStatus,
  receiptId?: string | null,
): Promise<void> {
  await db.runAsync(
    `UPDATE time_entries SET server_id = ?, status = ?, receipt_id = COALESCE(?, receipt_id), updated_at = ? WHERE id = ?`,
    serverId,
    status,
    receiptId ?? null,
    new Date().toISOString(),
    clientId,
  );
}
