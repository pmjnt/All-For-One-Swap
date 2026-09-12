import { getAddress, type Address } from 'viem';
import { z } from 'zod';

import type { AssetId, SupportedChainId } from '../domain/model.js';
import { sanitizeRpcError, type AssetBalance, type DiscoveryWarning } from './rpc.js';

const networkToChainId: Readonly<Record<string, SupportedChainId>> = {
  'arb-mainnet': 42161,
  'base-mainnet': 8453,
  'bnb-mainnet': 56,
  'eth-mainnet': 1,
  'matic-mainnet': 137,
  'opt-mainnet': 10,
  'polygon-mainnet': 137,
};

const tokenSchema = z
  .object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    network: z.string().min(1),
    tokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).nullable(),
    tokenBalance: z.string().regex(/^0x[0-9a-fA-F]+$/),
  })
  .passthrough();

const responseSchema = z
  .object({
    data: z.object({ tokens: z.array(tokenSchema) }).passthrough(),
    error: z
      .object({
        partialErrors: z.array(
          z.object({ network: z.string().min(1), message: z.string().min(1) }).passthrough(),
        ),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export interface IndexedBalanceResult {
  balances: readonly AssetBalance[];
  completeChainIds: readonly SupportedChainId[];
  failedChainIds: readonly SupportedChainId[];
  failedNetworks: readonly string[];
  warnings: readonly DiscoveryWarning[];
}

export function normalizeAlchemyBalances(input: unknown): IndexedBalanceResult {
  const response = responseSchema.parse(input);
  const failedNetworks = response.error?.partialErrors.map((error) => error.network) ?? [];
  const failedChainIds = failedNetworks.flatMap((network) => {
    const chainId = networkToChainId[network];
    return chainId ? [chainId] : [];
  });
  const balances: AssetBalance[] = response.data.tokens.map((token) => {
    const chainId = networkToChainId[token.network];
    if (!chainId) throw new Error(`Unsupported Alchemy network ${token.network}`);
    const address = token.tokenAddress ? getAddress(token.tokenAddress) : 'native';
    return {
      amount: BigInt(token.tokenBalance),
      assetId: `${chainId}:${address}` as AssetId,
    };
  });
  const allChainIds = [1, 10, 56, 137, 8453, 42161] as const;

  return {
    balances,
    completeChainIds: allChainIds.filter((chainId) => !failedChainIds.includes(chainId)),
    failedChainIds,
    failedNetworks,
    warnings: (response.error?.partialErrors ?? []).flatMap((error) => {
      const chainId = networkToChainId[error.network];
      return chainId
        ? [{ chainId, code: 'ALCHEMY_PARTIAL', message: sanitizeRpcError(error.message) }]
        : [];
    }),
  };
}

const requestedNetworks = [
  'eth-mainnet',
  'opt-mainnet',
  'bnb-mainnet',
  'polygon-mainnet',
  'base-mainnet',
  'arb-mainnet',
];

export function createAlchemyPortfolioProvider(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): { balances(wallet: Address): Promise<IndexedBalanceResult> } {
  return {
    async balances(wallet) {
      let response: Response;
      try {
        response = await fetcher(
          `https://api.g.alchemy.com/data/v1/${encodeURIComponent(apiKey)}/assets/tokens/balances/by-address`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              addresses: [{ address: wallet, networks: requestedNetworks }],
              includeBlockMetadata: false,
              includeErc20Tokens: true,
              includeNativeTokens: true,
            }),
          },
        );
      } catch {
        throw new Error('Alchemy Portfolio network request failed');
      }
      if (!response.ok) throw new Error(`Alchemy Portfolio request failed with HTTP ${response.status}`);
      return normalizeAlchemyBalances(await response.json());
    },
  };
}
