import type { Hex } from 'viem';

export type BridgeTerminalState = 'BRIDGE_PENDING' | 'COMPLETED' | 'FAILED';

export interface BridgeStatusObservation {
  destinationTxHash?: Hex;
  status: 'PENDING' | 'DONE' | 'FAILED';
}

export interface BridgeMonitorDependencies {
  balance(): Promise<bigint>;
  now(): number;
  sleep(milliseconds: number): Promise<void>;
  status(): Promise<BridgeStatusObservation>;
  transactionReceipt(hash: Hex): Promise<{ status: 'success' | 'reverted' } | null>;
}

export async function monitorBridge(
  input: { balanceBefore: bigint; timeoutMs: number },
  dependencies: BridgeMonitorDependencies,
): Promise<BridgeTerminalState> {
  if (input.timeoutMs < 0) throw new Error('Bridge observation timeout must be non-negative');
  const startedAt = dependencies.now();
  const backoff = [5_000, 10_000, 20_000, 30_000] as const;
  let attempt = 0;

  while (true) {
    const observation = await dependencies.status();
    if (observation.status === 'FAILED') return 'FAILED';
    if (observation.status === 'DONE' && observation.destinationTxHash) {
      const receipt = await dependencies.transactionReceipt(observation.destinationTxHash);
      if (receipt?.status === 'reverted') return 'FAILED';
      if (receipt?.status === 'success' && await dependencies.balance() > input.balanceBefore) {
        return 'COMPLETED';
      }
    }
    if (dependencies.now() - startedAt >= input.timeoutMs) return 'BRIDGE_PENDING';
    const delay = backoff[Math.min(attempt, backoff.length - 1)] ?? 30_000;
    attempt += 1;
    await dependencies.sleep(delay);
  }
}
