import { describe, expect, it } from 'vitest';
import {
  calculateEntriesTotalMinutes,
  calculateTotalMinutes,
  createIdempotencyKey,
  formatClockDuration,
  isUnusualHours,
  reconcileStatus,
  statusAfterSync,
  statusPresentation,
} from '../src/domain/logic';

describe('time-entry totals', () => {
  it('adds regular and overtime minutes without rounding', () => {
    expect(calculateTotalMinutes({ regularMinutes: 480, overtimeMinutes: 90 })).toBe(570);
    expect(formatClockDuration(570)).toBe('09:30');
  });

  it('sums a ledger with tabular accuracy', () => {
    expect(calculateEntriesTotalMinutes([
      { regularMinutes: 480, overtimeMinutes: 0 },
      { regularMinutes: 960, overtimeMinutes: 0 },
      { regularMinutes: 450, overtimeMinutes: 0 },
    ])).toBe(1_890);
  });
});

describe('review and proof states', () => {
  it('labels the explicit 16-hour demo heuristic for review', () => {
    expect(isUnusualHours(959)).toBe(false);
    expect(isUnusualHours(960)).toBe(true);
    expect(statusAfterSync(960)).toBe('NEEDS_ATTENTION');
  });

  it('does not communicate state by color alone', () => {
    expect(statusPresentation('PENDING_SYNC')).toMatchObject({
      label: 'Pending sync',
      mark: 'ring',
      accessibilityLabel: expect.stringContaining('saved on this device'),
    });
    expect(statusPresentation('NEEDS_ATTENTION')).toMatchObject({ label: 'Needs attention', mark: 'alert' });
  });

  it('maps server approval to payroll-ready without regressing unknown states', () => {
    expect(reconcileStatus('SUBMITTED', 'approved')).toBe('PAYROLL_READY');
    expect(reconcileStatus('PENDING_SYNC', undefined)).toBe('PENDING_SYNC');
  });
});

describe('stable idempotency keys', () => {
  it('derives the same operation key for every retry', () => {
    const operationId = '018fc6cc-1234-7000-8000-123456789abc';
    expect(createIdempotencyKey(operationId)).toBe(createIdempotencyKey(operationId));
    expect(createIdempotencyKey(operationId)).toBe(`shiftproof:time-entry:${operationId}`);
  });
});
