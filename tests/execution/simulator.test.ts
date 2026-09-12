import { describe, expect, it, vi } from 'vitest';

import { decodeFunctionData, erc20Abi } from 'viem';
import { buildExactApprovalCalls, simulateCandidate } from '../../src/execution/simulator.js';
import { validRoute } from '../support/factories.js';

describe('simulateCandidate', () => {
  it('requires bytecode and a successful call before execution', async () => {
    const client = {
      call: vi.fn(async () => ({ data: '0x' as const })),
      estimateGas: vi.fn(async () => 200_000n),
      getBalance: vi.fn(async () => 1_000_000n),
      getBytecode: vi.fn(async () => '0x1234' as const),
      getTransactionCount: vi.fn(async () => 7),
    };
    const result = await simulateCandidate(client, validRoute().transaction);
    expect(result).toEqual({ balance: 1_000_000n, estimatedGas: 200_000n, nonce: 7 });
  });

  it('rejects an EOA transaction target', async () => {
    const client = {
      call: vi.fn(), estimateGas: vi.fn(), getBalance: vi.fn(),
      getBytecode: vi.fn(async () => undefined), getTransactionCount: vi.fn(),
    };
    await expect(simulateCandidate(client, validRoute().transaction)).rejects.toThrow('bytecode');
  });

  it('stops before gas and nonce reads when eth_call fails', async () => {
    const client = {
      call: vi.fn(async () => { throw new Error('SIMULATION_FAILED'); }),
      estimateGas: vi.fn(async () => 200_000n),
      getBalance: vi.fn(async () => 1_000_000n),
      getBytecode: vi.fn(async () => '0x1234' as const),
      getTransactionCount: vi.fn(async () => 7),
    };

    await expect(simulateCandidate(client, validRoute().transaction))
      .rejects.toThrow('SIMULATION_FAILED');
    expect(client.estimateGas).not.toHaveBeenCalled();
    expect(client.getTransactionCount).not.toHaveBeenCalled();
  });
});

describe('buildExactApprovalCalls', () => {
  it('resets a legacy non-zero allowance then approves only the exact amount', () => {
    const calls = buildExactApprovalCalls({
      amount: 1_000_000n,
      currentAllowance: 2n,
      requiresReset: true,
      spender: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    });
    expect(calls).toHaveLength(2);
    expect(calls.map((data) => decodeFunctionData({ abi: erc20Abi, data }).args?.[1]))
      .toEqual([0n, 1_000_000n]);
  });

  it('rejects unlimited approval', () => {
    expect(() => buildExactApprovalCalls({
      amount: (1n << 256n) - 1n,
      currentAllowance: 0n,
      requiresReset: false,
      spender: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    })).toThrow('Unlimited');
  });
});
