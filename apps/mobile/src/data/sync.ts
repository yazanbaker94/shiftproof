import type { SQLiteDatabase } from 'expo-sqlite';
import { calculateTotalMinutes, reconcileStatus, statusAfterSync } from '../domain/logic';
import type { EntryStatus, SyncOperation, TimeEntry } from '../domain/types';
import { logger } from '../observability/logger';
import { DEMO_CLIENT_IDS, DEMO_PERIOD_ID } from './database';
import {
  applyRemoteEntryStatus,
  applySyncSuccess,
  getEntry,
  listEntries,
  listDueOperations,
  markOperationFailed,
  markOperationSyncing,
} from './repository';

const REQUEST_TIMEOUT_MS = 8_000;

type RemoteEntry = {
  id?: string;
  clientId?: string;
  status?: string;
  requiresReview?: boolean;
};

type RemoteTimesheet = {
  status?: string;
  entries?: RemoteEntry[];
  timeEntries?: RemoteEntry[];
  receiptId?: string | null;
  approvedAt?: string | null;
};

type RemoteCreateEnvelope = {
  data?: {
    entry?: RemoteEntry;
    timesheet?: { entries?: RemoteEntry[]; timeEntries?: RemoteEntry[] };
    operationKey?: string;
  };
};

const CANONICAL_DEMO_CLIENT_IDS = new Set<string>([
  DEMO_CLIENT_IDS.apiMonday,
  DEMO_CLIENT_IDS.apiTuesdayAttention,
  DEMO_CLIENT_IDS.apiWednesday,
  DEMO_CLIENT_IDS.apiThursday,
]);

export interface SyncSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 200)}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRemoteResult(body: unknown): RemoteCreateEnvelope {
  return typeof body === 'object' && body !== null ? (body as RemoteCreateEnvelope) : {};
}

export function extractRecoveredCreate(body: unknown): RemoteCreateEnvelope | null {
  if (typeof body !== 'object' || body === null) return null;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const operation = data as { status?: string; response?: unknown };
  if (operation.status !== 'succeeded' || typeof operation.response !== 'object' || operation.response === null) return null;
  return operation.response as RemoteCreateEnvelope;
}

export function extractTimesheet(body: unknown): RemoteTimesheet | null {
  if (typeof body !== 'object' || body === null) return null;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const direct = data as RemoteTimesheet & { timesheet?: RemoteTimesheet };
  return direct.timesheet ?? direct;
}

export function isIsolatedReviewerEntry(
  entry: Pick<TimeEntry, 'id' | 'periodId' | 'serverId'>,
): boolean {
  return entry.periodId === DEMO_PERIOD_ID
    && Boolean(entry.serverId)
    && !CANONICAL_DEMO_CLIENT_IDS.has(entry.id);
}

async function recoverOperation(apiUrl: string, operation: SyncOperation): Promise<RemoteCreateEnvelope | null> {
  try {
    const body = await fetchJson(
      `${apiUrl}/v1/operations/${encodeURIComponent(operation.idempotencyKey)}`,
    );
    return extractRecoveredCreate(body);
  } catch (error) {
    logger.warn('sync_reconcile_miss', { key: operation.idempotencyKey, message: String(error) });
  }
  return null;
}

async function resolveServerEntryId(apiUrl: string, entry: TimeEntry): Promise<string> {
  if (entry.serverId) return entry.serverId;
  const body = await fetchJson(`${apiUrl}/v1/timesheets/demo`);
  const timesheet = extractTimesheet(body);
  const match = (timesheet?.entries ?? timesheet?.timeEntries ?? []).find((candidate) => candidate.clientId === entry.id);
  return match?.id ?? entry.id;
}

async function executeRemote(
  apiUrl: string,
  operation: SyncOperation,
  entry: TimeEntry,
): Promise<RemoteCreateEnvelope> {
  const isCreate = operation.operationType === 'CREATE_TIME_ENTRY';
  const serverEntryId = isCreate ? null : await resolveServerEntryId(apiUrl, entry);
  const path = isCreate
    ? '/v1/reviewer/time-entries'
    : `/v1/time-entries/${encodeURIComponent(serverEntryId ?? entry.id)}/confirm`;
  try {
    const body = await fetchJson(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': operation.idempotencyKey,
      },
      body: operation.payload,
    });
    return parseRemoteResult(body);
  } catch (error) {
    if (isCreate) {
      const recovered = await recoverOperation(apiUrl, operation);
      if (recovered) return recovered;
    }
    throw error;
  }
}

function localFallbackResult(entry: TimeEntry, operation: SyncOperation): RemoteCreateEnvelope {
  const syncedStatus = statusAfterSync(calculateTotalMinutes(entry));
  const status = operation.operationType === 'CONFIRM_TIME_ENTRY'
    ? 'local_demo'
    : syncedStatus === 'SUBMITTED'
      ? 'local_demo'
      : syncedStatus.toLowerCase();
  return {
    data: {
      entry: {
        id: `demo-server-${entry.id}`,
        clientId: entry.id,
        status,
        requiresReview: status === 'needs_attention',
      },
      operationKey: operation.idempotencyKey,
    },
  };
}

export async function syncPendingOperations(
  db: SQLiteDatabase,
  apiUrl: string | undefined,
): Promise<SyncSummary> {
  const operations = await listDueOperations(db);
  const summary: SyncSummary = { attempted: operations.length, succeeded: 0, failed: 0 };

  for (const operation of operations) {
    const entry = await getEntry(db, operation.entryId);
    if (!entry) {
      await markOperationFailed(db, operation, 'Entry no longer exists.');
      summary.failed += 1;
      continue;
    }

    await markOperationSyncing(db, operation.id);
    const startedAt = Date.now();
    try {
      const body = apiUrl
        ? await executeRemote(apiUrl.replace(/\/$/, ''), operation, entry)
        : localFallbackResult(entry, operation);
      const remoteEntry = body.data?.entry;
      const status = reconcileStatus(entry.status, remoteEntry?.status);
      await applySyncSuccess(db, operation, {
        serverId: remoteEntry?.id ?? `demo-server-${entry.id}`,
        status,
        response: body,
      });
      summary.succeeded += 1;
      logger.info('sync_operation_succeeded', {
        key: operation.idempotencyKey,
        durationMs: Date.now() - startedAt,
        transport: apiUrl ? 'api' : 'local-demo',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markOperationFailed(db, operation, message);
      summary.failed += 1;
      logger.warn('sync_operation_deferred', {
        key: operation.idempotencyKey,
        durationMs: Date.now() - startedAt,
        message,
      });
    }
  }
  return summary;
}

export async function reconcileTimesheet(db: SQLiteDatabase, apiUrl: string | undefined): Promise<void> {
  if (!apiUrl) return;
  const normalizedApiUrl = apiUrl.replace(/\/$/, '');
  try {
    const body = await fetchJson(`${normalizedApiUrl}/v1/timesheets/demo`);
    const timesheet = extractTimesheet(body);
    const remoteEntries = timesheet?.entries ?? timesheet?.timeEntries ?? [];
    for (const remote of remoteEntries) {
      if (!remote.clientId || !remote.id) continue;
      const status = timesheet?.status === 'approved'
        ? 'PAYROLL_READY'
        : reconcileStatus('SUBMITTED', remote.status) as EntryStatus;
      await applyRemoteEntryStatus(db, remote.clientId, remote.id, status, timesheet?.receiptId);
    }
  } catch (error) {
    logger.warn('timesheet_reconcile_failed', { message: String(error) });
  }

  const localEntries = await listEntries(db);
  for (const localEntry of localEntries.filter(isIsolatedReviewerEntry)) {
    try {
      const body = await fetchJson(
        `${normalizedApiUrl}/v1/timesheets/${encodeURIComponent(localEntry.id)}`,
      );
      const timesheet = extractTimesheet(body);
      const remoteEntries = timesheet?.entries ?? timesheet?.timeEntries ?? [];
      const remote = remoteEntries.find((candidate) => candidate.clientId === localEntry.id);
      if (!remote?.id) continue;

      const status: EntryStatus = timesheet?.status === 'approved'
        ? 'PAYROLL_READY'
        : timesheet?.status === 'returned'
          ? 'RETURNED'
          : reconcileStatus('SUBMITTED', remote.status);
      await applyRemoteEntryStatus(
        db,
        localEntry.id,
        remote.id,
        status,
        timesheet?.receiptId,
      );
    } catch (error) {
      logger.warn('reviewer_timesheet_reconcile_failed', {
        timesheetId: localEntry.id,
        message: String(error),
      });
    }
  }
}
