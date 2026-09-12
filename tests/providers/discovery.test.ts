import { describe, expect, it, vi } from 'vitest';

import { discoverAssets } from '../../src/providers/discovery.js';
import { TEST_WALLET } from '../support/factories.js';

describe('discoverAssets', () => {
  it('queries only registry assets when no indexer key exists', async () => {
    const rpc = {
      balances: vi.fn().mockResolvedValue({
        balances: [],
        completeChainIds: [1],
        warnings: [],
      }),
    };

    const result = await discoverAssets(TEST_WALLET, {
      alchemyApiKey: undefined,
      registryAssetIds: [
        '1:native',
        '1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ],
      rpc,
    });

    expect(result.mode).toBe('ALLOWLIST_ONLY');
    expect(rpc.balances).toHaveBeenCalledWith(TEST_WALLET, [
      '1:native',
      '1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    ]);
  });
});
