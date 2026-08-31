export const MAX_RETRY_DELAY_MS = 60_000;

export function nextRetryDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.floor(attempts));
  return Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** safeAttempts);
}

export function nextAttemptIso(attempts: number, nowMs = Date.now()): string {
  return new Date(nowMs + nextRetryDelayMs(attempts)).toISOString();
}

export function shouldAttempt(status: string, nextAttemptAt: string | null, nowMs = Date.now()): boolean {
  if (status === 'PENDING' || status === 'SYNCING') return true;
  if (status !== 'WAITING_RETRY') return false;
  return nextAttemptAt === null || Date.parse(nextAttemptAt) <= nowMs;
}
