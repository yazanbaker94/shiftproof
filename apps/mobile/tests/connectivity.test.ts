import { describe, expect, it } from 'vitest';
import { resolveOnlineState } from '../src/domain/connectivity';

describe('automatic connectivity', () => {
  it('uses the real device connection in automatic mode', () => {
    expect(resolveOnlineState('automatic', true)).toBe(true);
    expect(resolveOnlineState('automatic', false)).toBe(false);
    expect(resolveOnlineState('automatic', null)).toBe(false);
  });

  it('keeps work offline when the reviewer simulation is enabled', () => {
    expect(resolveOnlineState('offline', true)).toBe(false);
    expect(resolveOnlineState('offline', false)).toBe(false);
  });
});
