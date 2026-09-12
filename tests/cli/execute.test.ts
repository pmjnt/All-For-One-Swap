import { expect, it, vi } from 'vitest';

import { runExecute } from '../../src/cli/execute.js';
import { validPlan } from '../support/factories.js';

it('loads a plan and delegates to the batch safety gate', async () => {
  const execute = vi.fn(async () => ({ version: 1 as const, planId: 'plan-1', updatedAt: '2026-09-12T00:00:00.000Z', routes: [] }));
  await runExecute({ journal: 'journal.json', plan: 'plan.json' }, {
    execute,
    load: async () => validPlan(),
  });
  expect(execute).toHaveBeenCalledOnce();
});
