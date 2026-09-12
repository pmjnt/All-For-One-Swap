import { describe, expect, it, vi } from 'vitest';

import { connectVerifiedRpc, sanitizeRpcError } from '../../src/providers/rpc.js';

describe('connectVerifiedRpc', () => {
  it('rejects a wrong-chain endpoint and uses the next endpoint', async () => {
    const wrong = { getChainId: vi.fn().mockResolvedValue(56) };
    const correct = { getChainId: vi.fn().mockResolvedValue(1) };
    const createClient = vi.fn((url: string) => (url === 'wrong' ? wrong : correct));

    const result = await connectVerifiedRpc(1, ['wrong', 'correct'], createClient);

    expect(result).toBe(correct);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('fails when every endpoint reports the wrong chain', async () => {
    await expect(
      connectVerifiedRpc(1, ['wrong'], () => ({ getChainId: async () => 10 })),
    ).rejects.toThrow('No RPC endpoint verified chain 1');
  });

  it('redacts API keys from RPC errors', () => {
    const message = sanitizeRpcError(
      new Error('request failed: https://rpc.test/v2/path?apiKey=secret-value'),
    );

    expect(message).not.toContain('secret-value');
    expect(message).toContain('[REDACTED]');
  });
});
