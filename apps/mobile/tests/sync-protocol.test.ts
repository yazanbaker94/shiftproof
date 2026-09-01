import { describe, expect, it } from 'vitest';
import { API_DEMO_SEED, DEMO_CLIENT_IDS, DEMO_PERIOD_ID } from '../src/data/database';
import { extractRecoveredCreate, extractTimesheet, isIsolatedReviewerEntry } from '../src/data/sync';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('mobile/API wire protocol', () => {
  it('keeps every seeded client ID valid for the API UUID contract', () => {
    for (const clientId of Object.values(DEMO_CLIENT_IDS)) expect(clientId).toMatch(uuid);
  });

  it('matches the canonical API demo client/date/hour mapping exactly', () => {
    expect(API_DEMO_SEED).toEqual([
      { clientId: '82f14000-0000-4000-9000-000000000011', workDate: '2026-08-24', regularMinutes: 480, overtimeMinutes: 0, note: '', status: 'APPROVED' },
      { clientId: '82f14000-0000-4000-9000-000000000014', workDate: '2026-08-25', regularMinutes: 960, overtimeMinutes: 0, note: 'Emergency inventory count after closing.', status: 'NEEDS_ATTENTION' },
      { clientId: '82f14000-0000-4000-9000-000000000013', workDate: '2026-08-26', regularMinutes: 480, overtimeMinutes: 0, note: '', status: 'APPROVED' },
      { clientId: '82f14000-0000-4000-9000-000000000012', workDate: '2026-08-27', regularMinutes: 450, overtimeMinutes: 0, note: '', status: 'APPROVED' },
    ]);
  });

  it('reads the direct GET /v1/timesheets/demo response envelope', () => {
    const timesheet = extractTimesheet({
      data: {
        id: '82f14000-0000-4000-8000-000000000001',
        status: 'approved',
        receiptId: 'SP-82F14',
            entries: [{ id: 'server-entry', clientId: DEMO_CLIENT_IDS.apiMonday, status: 'confirmed' }],
      },
    });
    expect(timesheet?.status).toBe('approved');
    expect(timesheet?.entries?.[0]?.clientId).toBe(DEMO_CLIENT_IDS.apiMonday);
  });

  it('recovers the original create response after a lost POST response', () => {
    const recovered = extractRecoveredCreate({
      data: {
        key: 'shiftproof:time-entry:abc',
        status: 'succeeded',
        response: {
          data: {
            entry: { id: 'server-entry', clientId: DEMO_CLIENT_IDS.reviewTuesday, status: 'needs_attention' },
            timesheet: { status: 'needs_attention', entries: [] },
            operationKey: 'shiftproof:time-entry:abc',
          },
        },
      },
    });
    expect(recovered?.data?.entry?.id).toBe('server-entry');
    expect(recovered?.data?.operationKey).toBe('shiftproof:time-entry:abc');
  });

  it('rejects incomplete operation lookups instead of assuming success', () => {
    expect(extractRecoveredCreate({ data: { status: 'pending' } })).toBeNull();
  });

  it('reconciles synced mobile submissions independently from the canonical sample', () => {
    expect(isIsolatedReviewerEntry({
      id: '8372fa17-2c44-4f9d-a183-71f4fc5c03cc',
      periodId: DEMO_PERIOD_ID,
      serverId: 'server-entry',
    })).toBe(true);
    expect(isIsolatedReviewerEntry({
      id: DEMO_CLIENT_IDS.apiMonday,
      periodId: DEMO_PERIOD_ID,
      serverId: 'server-entry',
    })).toBe(false);
    expect(isIsolatedReviewerEntry({
      id: '8372fa17-2c44-4f9d-a183-71f4fc5c03cc',
      periodId: DEMO_PERIOD_ID,
      serverId: null,
    })).toBe(false);
  });
});
