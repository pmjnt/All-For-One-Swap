import { createPublicClient, erc20Abi, http, type Address } from 'viem';

import { ASSETS } from '../config/assets.js';
import { CHAINS } from '../config/chains.js';
import type { AssetId, SupportedChainId } from '../domain/model.js';
import { redact } from '../security/redact.js';

export interface ChainIdClient {
  getChainId(): Promise<number>;
}

export async function connectVerifiedRpc<T extends ChainIdClient>(
  expectedChainId: number,
  urls: readonly string[],
  createClient: (url: string) => T,
): Promise<T> {
  for (const url of urls) {
    const client = createClient(url);
    try {
      if ((await client.getChainId()) === expectedChainId) return client;
    } catch {
      continue;
    }
  }
  throw new Error(`No RPC endpoint verified chain ${expectedChainId}`);
}

export interface AssetBalance {
  amount: bigint;
  assetId: AssetId;
}

export interface DiscoveryWarning {
  chainId: SupportedChainId;
  code: string;
  message: string;
}

export interface RpcBalanceResult {
  balances: readonly AssetBalance[];
  completeChainIds: readonly SupportedChainId[];
  warnings: readonly DiscoveryWarning[];
}

export function sanitizeRpcError(error: unknown): string {
  const safe = redact(error);
  if (safe && typeof safe === 'object' && 'message' in safe && typeof safe.message === 'string') {
    return safe.message;
  }
  return typeof safe === 'string' ? safe : JSON.stringify(safe);
}

function parseAssetId(assetId: AssetId): { chainId: SupportedChainId; address: Address | 'native' } {
  const separator = assetId.indexOf(':');
  const chainId = Number(assetId.slice(0, separator)) as SupportedChainId;
  const address = assetId.slice(separator + 1) as Address | 'native';
  return { address, chainId };
}

export function registryAssetIds(): AssetId[] {
  return ASSETS.filter((asset) => asset.source).map(
    (asset) => `${asset.chainId}:${asset.address}` as AssetId,
  );
}

export function createRegistryRpcReader(): {
  balances(wallet: Address, requestedAssetIds: readonly AssetId[]): Promise<RpcBalanceResult>;
} {
  return {
    async balances(wallet, requestedAssetIds) {
      const balances: AssetBalance[] = [];
      const completeChainIds: SupportedChainId[] = [];
      const warnings: DiscoveryWarning[] = [];

      for (const chainId of Object.keys(CHAINS).map(Number) as SupportedChainId[]) {
        const requested = requestedAssetIds.map(parseAssetId).filter((asset) => asset.chainId === chainId);
        if (requested.length === 0) continue;
        const config = CHAINS[chainId];
        const configuredUrl = process.env[config.rpcEnv];
        const urls = configuredUrl ? [configuredUrl, config.publicRpcUrl] : [config.publicRpcUrl];
        let chainComplete = true;

        try {
          const client = await connectVerifiedRpc(chainId, urls, (url) =>
            createPublicClient({ chain: config.chain, transport: http(url) }),
          );
          if (requested.some((asset) => asset.address === 'native')) {
            try {
              balances.push({ amount: await client.getBalance({ address: wallet }), assetId: `${chainId}:native` });
            } catch (error) {
              chainComplete = false;
              warnings.push({ chainId, code: 'NATIVE_BALANCE_FAILED', message: sanitizeRpcError(error) });
            }
          }

          const tokens = requested.filter(
            (asset): asset is { chainId: SupportedChainId; address: Address } => asset.address !== 'native',
          );
          if (tokens.length > 0) {
            const results = await client.multicall({
              allowFailure: true,
              contracts: tokens.map((token) => ({
                abi: erc20Abi,
                address: token.address,
                args: [wallet] as const,
                functionName: 'balanceOf' as const,
              })),
            });
            results.forEach((result, index) => {
              const token = tokens[index];
              if (!token) return;
              if (result.status === 'success') {
                balances.push({ amount: result.result, assetId: `${chainId}:${token.address}` });
              } else {
                chainComplete = false;
                warnings.push({
                  chainId,
                  code: 'TOKEN_BALANCE_FAILED',
                  message: `${token.address}: ${sanitizeRpcError(result.error)}`,
                });
              }
            });
          }

          if (chainComplete) completeChainIds.push(chainId);
        } catch (error) {
          warnings.push({ chainId, code: 'RPC_CHAIN_FAILED', message: sanitizeRpcError(error) });
        }
      }

      return { balances, completeChainIds, warnings };
    },
  };
}
