import { describe, expect, it, vi } from 'vitest';

import { verifyRegistryOnline } from '../../src/config/verify.js';

const contract = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
  chainId: 1 as const,
  decimals: 6,
};

describe('online registry verification', () => {
  it('accepts deployed code with matching decimals', async () => {
    const client = {
      getBytecode: vi.fn().mockResolvedValue('0x1234'),
      readContract: vi.fn().mockResolvedValue(6),
    };

    await expect(
      verifyRegistryOnline({ assets: [contract], contracts: [contract], clientForChain: () => client }),
    ).resolves.toBeUndefined();
  });

  it('rejects missing bytecode', async () => {
    const client = {
      getBytecode: vi.fn().mockResolvedValue(undefined),
      readContract: vi.fn().mockResolvedValue(6),
    };

    await expect(
      verifyRegistryOnline({ assets: [contract], contracts: [], clientForChain: () => client }),
    ).rejects.toThrow('Missing bytecode');
  });

  it('rejects mismatched decimals', async () => {
    const client = {
      getBytecode: vi.fn().mockResolvedValue('0x1234'),
      readContract: vi.fn().mockResolvedValue(18),
    };

    await expect(
      verifyRegistryOnline({ assets: [contract], contracts: [], clientForChain: () => client }),
    ).rejects.toThrow('Decimals mismatch');
  });
});
