import type { Address } from 'viem';

import type { NormalizedRoute } from '../../src/domain/model.js';
import type { JournalV1, PlanV1 } from '../../src/domain/schemas.js';
import type { PlanDependencies } from '../../src/cli/plan.js';

export const TEST_WALLET = '0x0000000000000000000000000000000000000001' as Address;

export function validRoute(overrides: Partial<NormalizedRoute> = {}): NormalizedRoute {
  return {
    explicitFeeAlreadyDeducted: true,
    explicitFeeUsd: '0.01',
    expiresAt: '2030-01-01T00:00:00.000Z',
    fromAmount: 1_000_000n,
    fromAsset: '1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    gasUsd: '0.10',
    id: 'route-1',
    intermediateAssets: [],
    quotedToAmount: 900_000n,
    toAsset: '8453:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    toolIds: ['across'],
    transaction: {
      chainId: 1,
      data: '0x12345678',
      from: TEST_WALLET,
      gasLimit: 250_000n,
      to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
      value: 0n,
    },
    ...overrides,
  };
}

export function validPlan(overrides: Partial<PlanV1> = {}): PlanV1 {
  return {
    version: 1,
    id: 'plan-1',
    createdAt: '2026-09-12T00:00:00.000Z',
    wallet: TEST_WALLET,
    target: {
      chainId: 8453,
      assetId: '8453:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
    policy: {
      registryVersion: '2026-09-12',
      maxSlippageBps: 100,
      minNetUsd: '0.25',
    },
    discovery: {
      mode: 'ALLOWLIST_ONLY',
      completeChainIds: [1, 10, 56, 137, 8453, 42161],
      warnings: [],
    },
    routes: [],
    ...overrides,
  };
}

export function validJournal(overrides: Partial<JournalV1> = {}): JournalV1 {
  return {
    version: 1,
    planId: 'plan-1',
    updatedAt: '2026-09-12T00:00:00.000Z',
    routes: [],
    ...overrides,
  };
}

export function makePlanDeps(options: {
  partialChain?: 1 | 10 | 56 | 137 | 8453 | 42161;
  save?: PlanDependencies['save'];
} = {}): PlanDependencies {
  return {
    discover: async () => ({
      balances: [{
        amount: 1_000_000n,
        assetId: '1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      }],
      completeChainIds: [1, 10, 137, 8453, 42161],
      mode: options.partialChain ? 'PARTIAL' : 'ALLOWLIST_ONLY',
      warnings: options.partialChain
        ? [{ chainId: options.partialChain, code: 'RPC_CHAIN_FAILED', message: 'unavailable' }]
        : [],
    }),
    getPrice: async () => ({ observedAt: '2026-09-12T00:00:00.000Z', priceUsd: '1' }),
    getRoutes: async () => [validRoute()],
    now: () => Date.parse('2026-09-12T00:00:00.000Z'),
    report: () => undefined,
    save: options.save ?? (async (_path, plan) => plan),
  };
}
