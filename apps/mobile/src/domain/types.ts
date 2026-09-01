export type EntryStatus =
  | 'APPROVED'
  | 'NEEDS_ATTENTION'
  | 'PENDING_SYNC'
  | 'SUBMITTED'
  | 'PAYROLL_READY';

export type QueueStatus = 'PENDING' | 'SYNCING' | 'WAITING_RETRY' | 'SUCCEEDED';

export interface TimeEntry {
  id: string;
  serverId: string | null;
  periodId: string;
  workDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  note: string;
  status: EntryStatus;
  idempotencyKey: string;
  localCreatedAt: string;
  updatedAt: string;
  serverVersion: number;
  receiptId: string | null;
}

export interface SyncOperation {
  id: string;
  entryId: string;
  idempotencyKey: string;
  operationType: 'CREATE_TIME_ENTRY' | 'CONFIRM_TIME_ENTRY';
  payload: string;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncReceipt {
  id: string;
  entryId: string;
  idempotencyKey: string;
  serverId: string;
  status: EntryStatus;
  syncedAt: string;
  responseJson: string;
}

export interface DraftEntry {
  workDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  note: string;
}

export interface SavedEntryResult {
  entry: TimeEntry;
  operation: SyncOperation;
}

export type DemoNetworkMode = 'automatic' | 'offline';

export interface StatusPresentation {
  label: string;
  accessibilityLabel: string;
  tone: 'green' | 'amber' | 'hollow' | 'blue';
  mark: 'dot' | 'alert' | 'ring' | 'check';
}
