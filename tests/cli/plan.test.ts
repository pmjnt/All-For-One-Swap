import { expect, it, vi } from 'vitest';

import { runPlan } from '../../src/cli/plan.js';
import { makePlanDeps } from '../support/factories.js';

it('creates a secret-free plan and reports incomplete discovery', async () => {
  const save = vi.fn(async (_path, plan) => plan);
  const result = await runPlan({
    minNetUsd: '0.25',
    out: 'plan.json',
    targetChain: 'base',
    targetToken: 'USDC',
    wallet: '0x0000000000000000000000000000000000000001',
  }, makePlanDeps({ partialChain: 56, save }));

  expect(save).toHaveBeenCalledOnce();
  expect(JSON.stringify(result)).not.toMatch(/private.?key/i);
  expect(result.warnings).toContainEqual(expect.objectContaining({ chainId: 56 }));
  expect(result.plan.discovery.mode).toBe('PARTIAL');
});

it('rejects an arbitrary destination contract', async () => {
  await expect(runPlan({
    minNetUsd: '0.25',
    out: 'plan.json',
    targetChain: 'base',
    targetToken: '0x0000000000000000000000000000000000000009',
    wallet: '0x0000000000000000000000000000000000000001',
  }, makePlanDeps())).rejects.toThrow('destination');
});
