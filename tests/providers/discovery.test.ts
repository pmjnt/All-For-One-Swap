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

  it('retries failed indexer chains through allowlist RPC', async () => {
    const indexed = {
      balances: vi.fn().mockResolvedValue({
        balances: [{ amount: 1n, assetId: '1:native' }],
        completeChainIds: [1, 10, 137, 8453, 42161],
        failedChainIds: [56],
        warnings: [{ chainId: 56, code: 'ALCHEMY_PARTIAL', message: 'timeout' }],
      }),
    };
    const rpc = {
      balances: vi.fn().mockResolvedValue({
        balances: [{ amount: 2n, assetId: '56:native' }],
        completeChainIds: [56],
        warnings: [],
      }),
    };

    const result = await discoverAssets(TEST_WALLET, {
      alchemyApiKey: 'configured',
      indexed,
      registryAssetIds: ['1:native', '56:native'],
      rpc,
    });

    expect(result.mode).toBe('INDEXED');
    expect(result.balances).toHaveLength(2);
    expect(rpc.balances).toHaveBeenCalledWith(TEST_WALLET, ['56:native']);
  });

  it('reports partial mode when indexer and RPC both miss a chain', async () => {
    const indexed = {
      balances: vi.fn().mockResolvedValue({
        balances: [],
        completeChainIds: [1, 10, 137, 8453, 42161],
        failedChainIds: [56],
        warnings: [{ chainId: 56, code: 'ALCHEMY_PARTIAL', message: 'timeout' }],
      }),
    };
    const rpc = {
      balances: vi.fn().mockResolvedValue({
        balances: [],
        completeChainIds: [],
        warnings: [{ chainId: 56, code: 'RPC_CHAIN_FAILED', message: 'unavailable' }],
      }),
    };

    const result = await discoverAssets(TEST_WALLET, {
      alchemyApiKey: 'configured',
      indexed,
      registryAssetIds: ['56:native'],
      rpc,
    });

    expect(result.mode).toBe('PARTIAL');
  });
});
