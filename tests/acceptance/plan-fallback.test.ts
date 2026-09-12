import { describe, expect, it, vi } from 'vitest';

import { runPlan } from '../../src/cli/plan.js';
import { makePlanDeps } from '../support/factories.js';
import { validRoute } from '../support/factories.js';

describe('read-only acceptance', () => {
  it('creates an allowlist-only plan without Alchemy', async () => {
    const result = await runPlan({
      minNetUsd: '0.25', out: 'ignored.json', targetChain: 'base', targetToken: 'USDC',
      wallet: '0x0000000000000000000000000000000000000001',
    }, makePlanDeps());
    expect(result.plan.discovery.mode).toBe('ALLOWLIST_ONLY');
    expect(result.plan.discovery.completeChainIds).toHaveLength(6);
  });

  it('classifies an unknown indexed token without requesting a route', async () => {
    const dependencies = makePlanDeps();
    const getRoutes = vi.fn(dependencies.getRoutes);
    dependencies.getRoutes = getRoutes;
    dependencies.discover = async () => ({
      balances: [{ amount: 1n, assetId: '1:0x0000000000000000000000000000000000000009' }],
      completeChainIds: [1, 10, 56, 137, 8453, 42161], mode: 'INDEXED', warnings: [],
    });
    const result = await runPlan({
      minNetUsd: '0.25', out: 'ignored.json', targetChain: 'base', targetToken: 'USDC',
      wallet: '0x0000000000000000000000000000000000000001',
    }, dependencies);
    expect(result.plan.routes[0]).toEqual(expect.objectContaining({ reason: 'UNKNOWN_ASSET' }));
    expect(getRoutes).not.toHaveBeenCalled();
  });

  it('plans native input only after preserving a buffered gas reserve', async () => {
    const dependencies = makePlanDeps();
    let requestedAmount = 0n;
    dependencies.discover = async () => ({
      balances: [{ amount: 10n ** 18n, assetId: '1:native' }],
      completeChainIds: [1, 10, 56, 137, 8453, 42161], mode: 'ALLOWLIST_ONLY', warnings: [],
    });
    dependencies.nativeGasCost = async () => 10n ** 17n;
    dependencies.getRoutes = async (request) => {
      requestedAmount = request.amount;
      return [validRoute({ fromAmount: request.amount, fromAsset: '1:native' })];
    };
    await runPlan({
      minNetUsd: '0', out: 'ignored.json', targetChain: 'base', targetToken: 'USDC',
      wallet: '0x0000000000000000000000000000000000000001',
    }, dependencies);
    expect(requestedAmount).toBe(880_000_000_000_000_000n);
  });
});
