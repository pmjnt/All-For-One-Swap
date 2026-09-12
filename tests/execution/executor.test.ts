import { describe, expect, it, vi } from 'vitest';

import { executeBatch } from '../../src/execution/executor.js';
import { validPlan, validRoute } from '../support/factories.js';

function planWithTwoRoutes() {
  const ready = {
    state: 'READY' as const,
    routeId: 'route-1',
    fromAsset: validRoute().fromAsset,
    toAsset: validRoute().toAsset,
    fromAmount: '1000000', quotedToAmount: '900000', minToAmount: '891000',
    netOutputUsd: '0.79', expiresAt: '2030-01-01T00:00:00.000Z', toolIds: ['across'],
  };
  return validPlan({ routes: [ready, { ...ready, routeId: 'route-2' }] });
}

describe('executeBatch', () => {
  it('refreshes every route before prompting and stops on one invalid route', async () => {
    const confirm = vi.fn();
    const readSigner = vi.fn();
    const refresh = vi.fn()
      .mockResolvedValueOnce({ valid: true, route: validRoute() })
      .mockResolvedValueOnce({ valid: false, code: 'QUOTE_EXPIRED' });
    await expect(executeBatch(planWithTwoRoutes(), {
      confirm, now: () => 0, persistJournal: vi.fn(), readSigner, refresh,
      recheck: vi.fn(), submit: vi.fn(), wait: vi.fn(),
    })).rejects.toThrow('QUOTE_EXPIRED');
    expect(confirm).not.toHaveBeenCalled();
    expect(readSigner).not.toHaveBeenCalled();
  });

  it('prompts once, then submits sequentially and journals hashes first', async () => {
    const events: string[] = [];
    const result = await executeBatch(validPlan({ routes: [planWithTwoRoutes().routes[0]!] }), {
      confirm: vi.fn(async () => 'EXECUTE'),
      now: () => Date.parse('2026-09-12T00:00:00.000Z'),
      persistJournal: vi.fn(async (journal) => { events.push(journal.routes[0]!.state); }),
      readSigner: vi.fn(async () => ({ address: validPlan().wallet })),
      refresh: vi.fn(async () => ({ valid: true as const, route: validRoute() })),
      recheck: vi.fn(async () => undefined),
      submit: vi.fn(async () => { events.push('SIGNED'); return '0x1234' as const; }),
      wait: vi.fn(async () => ({ status: 'success' as const })),
    });
    expect(events).toContain('SUBMITTED');
    expect(result.routes[0]?.state).toBe('CONFIRMED');
  });

  it('rejects a material tool change before prompting', async () => {
    const confirm = vi.fn();
    await expect(executeBatch(validPlan({ routes: [planWithTwoRoutes().routes[0]!] }), {
      confirm,
      now: () => Date.parse('2026-09-12T00:00:00.000Z'),
      persistJournal: vi.fn(),
      readSigner: vi.fn(),
      refresh: vi.fn(async () => ({
        valid: true as const,
        route: validRoute({ toolIds: ['stargateV2'] }),
      })),
      recheck: vi.fn(), submit: vi.fn(), wait: vi.fn(),
    })).rejects.toThrow('TOOLS_CHANGED');
    expect(confirm).not.toHaveBeenCalled();
  });
});
