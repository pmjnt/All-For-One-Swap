import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/alchemy/partial-success.json' with { type: 'json' };
import { createAlchemyPortfolioProvider, normalizeAlchemyBalances } from '../../src/providers/alchemy.js';

describe('normalizeAlchemyBalances', () => {
  it('keeps successful balances and exposes partial network errors', () => {
    const result = normalizeAlchemyBalances(fixture);

    expect(result.balances).toHaveLength(3);
    expect(result.failedNetworks).toEqual(['bnb-mainnet']);
    expect(result.failedChainIds).toEqual([56]);
  });

  it('preserves an unknown contract identity for report-only classification', () => {
    const result = normalizeAlchemyBalances(fixture);

    expect(result.balances).toContainEqual({
      amount: 1n,
      assetId: '8453:0x00000000000000000000000000000000000000AA',
    });
  });

  it('does not expose an API key from a rejected fetch', async () => {
    const provider = createAlchemyPortfolioProvider(
      'super-secret-key',
      (() => Promise.reject(new Error('failed https://api.g.alchemy.com/data/v1/super-secret-key'))) as typeof fetch,
    );

    const error = await provider
      .balances('0x0000000000000000000000000000000000000001')
      .catch((cause: unknown) => cause);
    expect(String(error)).not.toContain('super-secret-key');
  });
});
