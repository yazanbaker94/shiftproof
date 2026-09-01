import type { EntryStatus, StatusPresentation, TimeEntry } from './types';

export const UNUSUAL_HOURS_MINUTES = 16 * 60;

export function calculateTotalMinutes(
  value: Pick<TimeEntry, 'regularMinutes' | 'overtimeMinutes'>,
): number {
  return Math.max(0, value.regularMinutes) + Math.max(0, value.overtimeMinutes);
}

export function calculateEntriesTotalMinutes(
  entries: Array<Pick<TimeEntry, 'regularMinutes' | 'overtimeMinutes'>>,
): number {
  return entries.reduce((sum, entry) => sum + calculateTotalMinutes(entry), 0);
}

export function formatDecimalHours(minutes: number): string {
  const hours = Math.max(0, minutes) / 60;
  return Number.isInteger(hours) ? hours.toFixed(1) : hours.toFixed(1);
}

export function formatClockDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function isUnusualHours(minutes: number): boolean {
  return minutes >= UNUSUAL_HOURS_MINUTES;
}

export function statusAfterSync(totalMinutes: number): EntryStatus {
  return isUnusualHours(totalMinutes) ? 'NEEDS_ATTENTION' : 'SUBMITTED';
}

export function statusPresentation(status: EntryStatus): StatusPresentation {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', accessibilityLabel: 'Approved, synced', tone: 'green', mark: 'dot' };
    case 'NEEDS_ATTENTION':
      return {
        label: 'Needs attention',
        accessibilityLabel: 'Needs attention, review required',
        tone: 'amber',
        mark: 'alert',
      };
    case 'RETURNED':
      return {
        label: 'Returned by manager',
        accessibilityLabel: 'Returned by manager with a review note',
        tone: 'amber',
        mark: 'alert',
      };
    case 'PENDING_SYNC':
      return {
        label: 'Pending sync',
        accessibilityLabel: 'Pending sync, saved on this device',
        tone: 'hollow',
        mark: 'ring',
      };
    case 'SUBMITTED':
      return {
        label: 'Ready for review',
        accessibilityLabel: 'Synced and ready for manager review',
        tone: 'blue',
        mark: 'dot',
      };
    case 'LOCAL_DEMO':
      return {
        label: 'Local demo only',
        accessibilityLabel: 'Local demo only, no manager submission was sent',
        tone: 'blue',
        mark: 'ring',
      };
    case 'PAYROLL_READY':
      return {
        label: 'Payroll ready',
        accessibilityLabel: 'Approved and ready for payroll',
        tone: 'green',
        mark: 'check',
      };
  }
}

export function createIdempotencyKey(operationId: string): string {
  return `shiftproof:time-entry:${operationId}`;
}

export function reconcileStatus(local: EntryStatus, serverStatus: string | undefined): EntryStatus {
  const normalized = serverStatus?.toLowerCase();
  if (normalized === 'approved' || normalized === 'payroll_ready') return 'PAYROLL_READY';
  if (normalized === 'returned') return 'RETURNED';
  if (normalized === 'local_demo') return 'LOCAL_DEMO';
  if (normalized === 'needs_attention') return 'NEEDS_ATTENTION';
  if (normalized === 'submitted' || normalized === 'pending_review' || normalized === 'synced' || normalized === 'confirmed') return 'SUBMITTED';
  return local;
}

export function dayParts(date: string): { day: string; date: string } {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
  return {
    day: value.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
    date: String(value.getUTCDate()).padStart(2, '0'),
  };
}
