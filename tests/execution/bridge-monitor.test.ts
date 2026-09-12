import { describe, expect, it, vi } from 'vitest';

import { monitorBridge } from '../../src/execution/bridge-monitor.js';

describe('monitorBridge', () => {
  it('requires both a successful destination receipt and a balance increase', async () => {
    const result = await monitorBridge({ balanceBefore: 100n, timeoutMs: 100 }, {
      balance: async () => 101n,
      now: (() => { let value = 0; return () => value += 10; })(),
      sleep: vi.fn(async () => undefined),
      status: async () => ({ destinationTxHash: '0x1234', status: 'DONE' }),
      transactionReceipt: async () => ({ status: 'success' }),
    });
    expect(result).toBe('COMPLETED');
  });

  it('keeps a provider DONE response pending without destination evidence', async () => {
    const result = await monitorBridge({ balanceBefore: 100n, timeoutMs: 20 }, {
      balance: async () => 100n,
      now: (() => { let value = 0; return () => value += 10; })(),
      sleep: vi.fn(async () => undefined),
      status: async () => ({ destinationTxHash: '0x1234', status: 'DONE' }),
      transactionReceipt: async () => ({ status: 'success' }),
    });
    expect(result).toBe('BRIDGE_PENDING');
  });
});
