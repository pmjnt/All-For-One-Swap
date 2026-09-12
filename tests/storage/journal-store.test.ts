import { describe, expect, it } from 'vitest';

import { transitionRoute } from '../../src/storage/journal-store.js';

describe('transitionRoute', () => {
  it('does not transition backward or out of a terminal state', () => {
    expect(() => transitionRoute('SUBMITTED', 'READY')).toThrow('backward');
    expect(() => transitionRoute('COMPLETED', 'SUBMITTED')).toThrow('terminal');
  });

  it('permits the reviewed forward path and failure', () => {
    expect(transitionRoute('READY', 'SUBMITTED')).toBe('SUBMITTED');
    expect(transitionRoute('CONFIRMED', 'BRIDGE_PENDING')).toBe('BRIDGE_PENDING');
    expect(transitionRoute('SUBMITTED', 'FAILED')).toBe('FAILED');
  });
});
