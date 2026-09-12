import { describe, expect, it } from 'vitest';

import { validateRoute } from '../../src/policy/validate-route.js';
import { validRoute } from '../support/factories.js';

function rejectionCode(route: ReturnType<typeof validRoute>): string | undefined {
  try {
    validateRoute(route, { maxSlippageBps: 100, now: Date.parse('2026-09-12T00:00:00.000Z') });
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('validateRoute', () => {
  it('accepts reviewed assets and tools', () => {
    expect(rejectionCode(validRoute())).toBeUndefined();
  });

  it('rejects unknown assets, tools, intermediates, and expired quotes', () => {
    expect(rejectionCode(validRoute({ fromAsset: '1:0x0000000000000000000000000000000000000009' }))).toBe('UNKNOWN_ASSET');
    expect(rejectionCode(validRoute({ toolIds: ['scam-bridge'] }))).toBe('UNKNOWN_TOOL');
    expect(rejectionCode(validRoute({ intermediateAssets: ['1:0x0000000000000000000000000000000000000009'] }))).toBe('UNKNOWN_ASSET');
    expect(rejectionCode(validRoute({ expiresAt: '2020-01-01T00:00:00.000Z' }))).toBe('EXPIRED_QUOTE');
  });

  it('enforces slippage and price-impact bounds', () => {
    expect(() => validateRoute(validRoute({ quotedToAmount: 989n }), {
      expectedToAmount: 1_000n,
      maxSlippageBps: 100,
    })).toThrowError(expect.objectContaining({ code: 'SLIPPAGE_EXCEEDED' }));
    expect(() => validateRoute(validRoute(), {
      maxPriceImpactBps: 100,
      maxSlippageBps: 100,
      priceImpactBps: 101,
    })).toThrowError(expect.objectContaining({ code: 'SLIPPAGE_EXCEEDED' }));
  });
});
