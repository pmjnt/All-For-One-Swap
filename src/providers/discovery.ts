import type { Address } from 'viem';

import type { AssetId, SupportedChainId } from '../domain/model.js';
import type { IndexedBalanceResult } from './alchemy.js';
import type { RpcBalanceResult } from './rpc.js';

export interface DiscoveryResult extends RpcBalanceResult {
  mode: 'INDEXED' | 'ALLOWLIST_ONLY' | 'PARTIAL';
}

interface DiscoveryDependencies {
  alchemyApiKey: string | undefined;
  indexed?: {
    balances(wallet: Address): Promise<IndexedBalanceResult>;
  };
  registryAssetIds: readonly AssetId[];
  rpc: {
    balances(wallet: Address, assetIds: readonly AssetId[]): Promise<RpcBalanceResult>;
  };
}

export async function discoverAssets(
  wallet: Address,
  dependencies: DiscoveryDependencies,
): Promise<DiscoveryResult> {
  if (dependencies.alchemyApiKey) {
    if (!dependencies.indexed) throw new Error('Alchemy API key is configured without an indexed provider');
    const indexed = await dependencies.indexed.balances(wallet);
    const failed = new Set(indexed.failedChainIds);
    const retryAssetIds = dependencies.registryAssetIds.filter((assetId) => {
      const chainId = Number(assetId.slice(0, assetId.indexOf(':')));
      return failed.has(chainId as SupportedChainId);
    });
    const fallback =
      retryAssetIds.length > 0
        ? await dependencies.rpc.balances(wallet, retryAssetIds)
        : { balances: [], completeChainIds: [], warnings: [] };
    const recovered = new Set(fallback.completeChainIds);
    const stillIncomplete = indexed.failedChainIds.some((chainId) => !recovered.has(chainId));

    return {
      balances: [...indexed.balances, ...fallback.balances],
      completeChainIds: [...new Set([...indexed.completeChainIds, ...fallback.completeChainIds])],
      mode: stillIncomplete ? 'PARTIAL' : 'INDEXED',
      warnings: [...indexed.warnings, ...fallback.warnings],
    };
  }

  const result = await dependencies.rpc.balances(wallet, dependencies.registryAssetIds);
  return {
    ...result,
    mode: 'ALLOWLIST_ONLY',
  };
}
