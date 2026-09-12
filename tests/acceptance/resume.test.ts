import { describe, expect, it, vi } from 'vitest';

import { runResume } from '../../src/cli/resume.js';
import { monitorBridge } from '../../src/execution/bridge-monitor.js';
import { validJournal } from '../support/factories.js';

describe('resume acceptance', () => {
  it('requires destination evidence before completing a bridge', async () => {
    await expect(monitorBridge({ balanceBefore: 10n, timeoutMs: 100 }, {
      balance: async () => 11n, now: (() => { let n = 0; return () => n += 10; })(),
      sleep: async () => undefined,
      status: async () => ({ status: 'DONE', destinationTxHash: '0x1234' }),
      transactionReceipt: async () => ({ status: 'success' }),
    })).resolves.toBe('COMPLETED');
  });

  it('does not duplicate a source submission after interruption', async () => {
    const submitReady = vi.fn();
    const journal = validJournal({ routes: [{
      routeId: 'route-1', state: 'SUBMITTED', history: ['READY', 'SUBMITTED'],
      txHashes: ['0x1234'], destinationBalanceBefore: '10',
    }] });
    const result = await runResume(journal, {
      monitor: vi.fn(), now: () => 0, persist: vi.fn(), receipt: async () => null, submitReady,
    });
    expect(result.routes[0]?.state).toBe('SUBMITTED');
    expect(submitReady).not.toHaveBeenCalled();
  });
});
