import type { Address } from 'viem';

import type { AssetId } from '../domain/model.js';
import type { RpcBalanceResult } from './rpc.js';

export interface DiscoveryResult extends RpcBalanceResult {
  mode: 'INDEXED' | 'ALLOWLIST_ONLY' | 'PARTIAL';
}

interface DiscoveryDependencies {
  alchemyApiKey: string | undefined;
  registryAssetIds: readonly AssetId[];
  rpc: {
    balances(wallet: Address, assetIds: readonly AssetId[]): Promise<RpcBalanceResult>;
  };
}

export async function discoverAssets(
  wallet: Address,
  dependencies: DiscoveryDependencies,
): Promise<DiscoveryResult> {
  const result = await dependencies.rpc.balances(wallet, dependencies.registryAssetIds);
  return {
    ...result,
    mode: 'ALLOWLIST_ONLY',
  };
}
