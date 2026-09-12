import { describe, expect, it, vi } from 'vitest';

import { executeBatch } from '../../src/execution/executor.js';
import { buildExactApprovalCalls } from '../../src/execution/simulator.js';
import { reserveNativeAmount } from '../../src/planning/economics.js';
import { validateTransaction } from '../../src/policy/validate-transaction.js';
import { validPlan, validRoute } from '../support/factories.js';
import { makeSafeContext, swapAndBridgeCalldata } from '../support/route-builders.js';

const ready = {
  state: 'READY' as const, routeId: 'route-1', fromAsset: validRoute().fromAsset,
  toAsset: validRoute().toAsset, fromAmount: '1000000', quotedToAmount: '900000',
  minToAmount: '891000', netOutputUsd: '0.79', expiresAt: '2030-01-01T00:00:00.000Z',
  toolIds: ['across'],
};

describe('execution acceptance', () => {
  it('builds one exact approval and validates swap-then-bridge calldata', () => {
    expect(buildExactApprovalCalls({
      amount: 1_000_000n, currentAllowance: 0n, requiresReset: false,
      spender: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    })).toHaveLength(1);
    const context = makeSafeContext();
    context.approvalAmount = 10n ** 18n;
    context.route = {
      ...context.route, fromAmount: 10n ** 18n,
      fromAsset: '1:0x6B175474E89094C44Da98b954EedeAC495271d0F',
      toolIds: ['1inch', 'across'],
      transaction: { ...context.route.transaction, data: swapAndBridgeCalldata() },
    };
    expect(() => validateTransaction(context)).not.toThrow();
  });

  it('never confirms or reads a signer when one refreshed route is adversarial', async () => {
    const confirm = vi.fn();
    const readSigner = vi.fn();
    await expect(executeBatch(validPlan({ routes: [ready] }), {
      confirm, now: () => 0, persistJournal: vi.fn(), readSigner,
      refresh: async () => ({ valid: false, code: 'UNKNOWN_TOOL' }),
      recheck: vi.fn(), submit: vi.fn(), wait: vi.fn(),
    })).rejects.toThrow('UNKNOWN_TOOL');
    expect(confirm).not.toHaveBeenCalled();
    expect(readSigner).not.toHaveBeenCalled();
  });

  it('keeps native spend plus buffered reserve within balance', () => {
    const result = reserveNativeAmount(1_000_000n, 100_000n, 2_000);
    expect(result.spendable + result.reserve).toBe(1_000_000n);
    expect(result.reserve).toBeGreaterThanOrEqual(120_000n);
  });

  it('marks a successful same-chain swap completed', async () => {
    const sameChainRoute = validRoute({ toAsset: '1:native' });
    const sameChainPlan = validPlan({ routes: [{
      ...ready, toAsset: '1:native', minToAmount: '891000', quotedToAmount: '900000',
    }] });
    const result = await executeBatch(sameChainPlan, {
      confirm: async () => 'EXECUTE', now: () => Date.parse('2026-09-12T00:00:00.000Z'),
      persistJournal: async () => undefined, readSigner: async () => ({}),
      refresh: async () => ({ valid: true, route: sameChainRoute }),
      recheck: async () => undefined, submit: async () => '0x1234',
      wait: async () => ({ status: 'success' }),
    });
    expect(result.routes[0]?.state).toBe('COMPLETED');
  });
});
