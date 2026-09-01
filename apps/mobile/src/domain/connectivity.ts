import type { DemoNetworkMode } from './types';

export function resolveOnlineState(
  mode: DemoNetworkMode,
  actualNetworkReachable: boolean | null,
): boolean {
  return mode === 'automatic' && actualNetworkReachable === true;
}
