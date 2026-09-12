import { encodeFunctionData, erc20Abi, maxUint256, type Address, type Hex } from 'viem';

import type { TxCandidate } from '../domain/model.js';

export interface SimulationClient {
  call(request: { account: Address; data: Hex; to: Address; value: bigint }): Promise<unknown>;
  estimateGas(request: { account: Address; data: Hex; to: Address; value: bigint }): Promise<bigint>;
  getBalance(request: { address: Address }): Promise<bigint>;
  getBytecode(request: { address: Address }): Promise<Hex | undefined>;
  getTransactionCount(request: { address: Address }): Promise<number>;
}

export interface SimulationSnapshot {
  balance: bigint;
  estimatedGas: bigint;
  nonce: number;
}

export async function simulateCandidate(
  client: SimulationClient,
  candidate: TxCandidate,
): Promise<SimulationSnapshot> {
  const bytecode = await client.getBytecode({ address: candidate.to });
  if (!bytecode || bytecode === '0x') throw new Error('Transaction target has no bytecode');
  const balance = await client.getBalance({ address: candidate.from });
  if (balance < candidate.value) throw new Error('Insufficient native balance for transaction value');
  await client.call({
    account: candidate.from,
    data: candidate.data,
    to: candidate.to,
    value: candidate.value,
  });
  const estimatedGas = await client.estimateGas({
    account: candidate.from,
    data: candidate.data,
    to: candidate.to,
    value: candidate.value,
  });
  if (estimatedGas > candidate.gasLimit) throw new Error('Estimated gas exceeds quoted gas limit');
  const nonce = await client.getTransactionCount({ address: candidate.from });
  return { balance, estimatedGas, nonce };
}

export function buildExactApprovalCalls(input: {
  amount: bigint;
  currentAllowance: bigint;
  requiresReset: boolean;
  spender: Address;
}): Hex[] {
  if (input.amount === maxUint256) throw new Error('Unlimited approval is forbidden');
  if (input.amount < 0n || input.currentAllowance < 0n) throw new Error('Approval values must be non-negative');
  if (input.currentAllowance === input.amount) return [];
  const calls: Hex[] = [];
  if (input.requiresReset && input.currentAllowance !== 0n) {
    calls.push(encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [input.spender, 0n] }));
  }
  calls.push(encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [input.spender, input.amount],
  }));
  return calls;
}
