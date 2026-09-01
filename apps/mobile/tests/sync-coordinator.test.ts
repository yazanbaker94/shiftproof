import { describe, expect, it, vi } from 'vitest';
import { AutomaticSyncCoordinator } from '../src/data/syncCoordinator';

describe('automatic sync coordinator', () => {
  it('runs a trailing pass when work arrives during an in-flight pass', async () => {
    const coordinator = new AutomaticSyncCoordinator();
    let releaseFirstPass: (() => void) | undefined;
    const firstPassGate = new Promise<void>((resolve) => { releaseFirstPass = resolve; });
    const runPass = vi.fn()
      .mockImplementationOnce(async () => {
        await firstPassGate;
        return { attempted: 1, succeeded: 1, failed: 0 };
      })
      .mockResolvedValueOnce({ attempted: 1, succeeded: 1, failed: 0 });

    const first = coordinator.request(runPass);
    const second = coordinator.request(runPass);
    releaseFirstPass?.();

    await expect(first).resolves.toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    await expect(second).resolves.toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    expect(runPass).toHaveBeenCalledTimes(2);
  });
});
