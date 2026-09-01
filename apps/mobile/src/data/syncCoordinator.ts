import type { SyncSummary } from './sync';

const emptySummary = (): SyncSummary => ({ attempted: 0, succeeded: 0, failed: 0 });

export class AutomaticSyncCoordinator {
  private inFlight: Promise<SyncSummary> | null = null;
  private trailingPassRequested = false;

  get running(): boolean {
    return this.inFlight !== null;
  }

  request(
    runPass: () => Promise<SyncSummary>,
    canContinue: () => boolean = () => true,
  ): Promise<SyncSummary> {
    if (this.inFlight) {
      this.trailingPassRequested = true;
      return this.inFlight;
    }

    const task = (async () => {
      const total = emptySummary();
      do {
        this.trailingPassRequested = false;
        const pass = await runPass();
        total.attempted += pass.attempted;
        total.succeeded += pass.succeeded;
        total.failed += pass.failed;
      } while (this.trailingPassRequested && canContinue());
      return total;
    })();

    const tracked = task.finally(() => {
      if (this.inFlight === tracked) this.inFlight = null;
    });
    this.inFlight = tracked;
    return tracked;
  }
}
