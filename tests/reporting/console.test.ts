import { describe, expect, it } from 'vitest';

import { renderPlan } from '../../src/reporting/console.js';
import { validPlan } from '../support/factories.js';

describe('renderPlan', () => {
  it('shows discovery warnings before stable per-holding rows', () => {
    const output = renderPlan(validPlan({
      discovery: {
        mode: 'PARTIAL', completeChainIds: [1],
        warnings: [{ chainId: 56, code: 'RPC_CHAIN_FAILED', message: 'unavailable' }],
      },
      routes: [{ state: 'SKIPPED', routeId: 'holding:56:native', fromAsset: '56:native', reason: 'INSUFFICIENT_GAS' }],
    }));
    expect(output.indexOf('RPC_CHAIN_FAILED')).toBeLessThan(output.indexOf('INSUFFICIENT_GAS'));
    expect(output).toContain('Discovery: PARTIAL');
  });
});
