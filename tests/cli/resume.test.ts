import { expect, it, vi } from 'vitest';

import { runResume } from '../../src/cli/resume.js';
import { validJournal } from '../support/factories.js';

function journalAt(state: 'SUBMITTED' | 'BRIDGE_PENDING') {
  return validJournal({
    routes: [{
      routeId: 'route-1', state, history: state === 'SUBMITTED'
        ? ['READY', 'SUBMITTED']
        : ['READY', 'SUBMITTED', 'CONFIRMED', 'BRIDGE_PENDING'],
      txHashes: ['0x1234'], destinationBalanceBefore: '100',
    }],
  });
}

it('does not resubmit a journaled transaction whose receipt is unresolved', async () => {
  const submitReady = vi.fn();
  const result = await runResume(journalAt('SUBMITTED'), {
    monitor: vi.fn(), now: () => 0, persist: vi.fn(),
    receipt: async () => null, submitReady,
  });
  expect(result.routes[0]?.state).toBe('SUBMITTED');
  expect(submitReady).not.toHaveBeenCalled();
});

it('keeps bridge timeout pending without resubmitting', async () => {
  const submitReady = vi.fn();
  const result = await runResume(journalAt('BRIDGE_PENDING'), {
    monitor: async () => 'BRIDGE_PENDING', now: () => 0, persist: vi.fn(),
    receipt: vi.fn(), submitReady,
  });
  expect(result.routes[0]?.state).toBe('BRIDGE_PENDING');
  expect(submitReady).not.toHaveBeenCalled();
});
