import { describe, expect, it } from 'vitest';
import { nextAttemptIso, nextRetryDelayMs, shouldAttempt } from '../src/data/queuePolicy';

describe('durable queue retry policy', () => {
  it('uses capped exponential delays', () => {
    expect(nextRetryDelayMs(0)).toBe(1_000);
    expect(nextRetryDelayMs(3)).toBe(8_000);
    expect(nextRetryDelayMs(20)).toBe(60_000);
  });

  it('keeps deferred work dormant until its next attempt', () => {
    const now = Date.parse('2026-09-01T00:00:00.000Z');
    expect(shouldAttempt('WAITING_RETRY', '2026-09-01T00:00:02.000Z', now)).toBe(false);
    expect(shouldAttempt('WAITING_RETRY', '2026-08-31T23:59:59.000Z', now)).toBe(true);
    expect(shouldAttempt('SUCCEEDED', null, now)).toBe(false);
  });

  it('produces deterministic retry timestamps for telemetry and tests', () => {
    const now = Date.parse('2026-09-01T00:00:00.000Z');
    expect(nextAttemptIso(2, now)).toBe('2026-09-01T00:00:04.000Z');
  });
});
