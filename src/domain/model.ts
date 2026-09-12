import type { Address, Hex } from 'viem';

export type SupportedChainId = 1 | 10 | 56 | 137 | 8453 | 42161;
export type AssetId = `${SupportedChainId}:${Address | 'native'}`;
export type RouteState =
  | 'SKIPPED'
  | 'READY'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'BRIDGE_PENDING'
  | 'COMPLETED'
  | 'FAILED';

export interface TxCandidate {
  approvalAddress?: Address;
  chainId: SupportedChainId;
  data: Hex;
  from: Address;
  gasLimit: bigint;
  to: Address;
  value: bigint;
}

export interface NormalizedRoute {
  explicitFeeAlreadyDeducted: boolean;
  explicitFeeUsd: string;
  expiresAt: string;
  fromAmount: bigint;
  fromAsset: AssetId;
  gasUsd: string;
  id: string;
  intermediateAssets: readonly AssetId[];
  quotedToAmount: bigint;
  toAsset: AssetId;
  toolIds: readonly string[];
  transaction: TxCandidate;
}
