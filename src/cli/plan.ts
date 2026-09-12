import { Decimal } from 'decimal.js';
import { getAddress, type Address } from 'viem';

import { ASSETS, type AssetRegistryEntry } from '../config/assets.js';
import { CHAINS } from '../config/chains.js';
import type { AssetId, NormalizedRoute, SupportedChainId } from '../domain/model.js';
import type { PlanV1 } from '../domain/schemas.js';
import { selectBestRoute } from '../planning/planner.js';
import type { DiscoveryResult } from '../providers/discovery.js';
import type { LifiRouteRequest } from '../providers/lifi.js';
import { assertFreshPrice, type PriceObservation } from '../providers/pricing.js';
import type { PlanReport } from '../reporting/console.js';

export interface PlanOptions {
  minNetUsd: string;
  out: string;
  targetChain: string;
  targetToken: string;
  wallet: string;
}

export interface PlanDependencies {
  discover(wallet: Address): Promise<DiscoveryResult>;
  getPrice(chainId: number, token: string): Promise<PriceObservation>;
  getRoutes(request: LifiRouteRequest): Promise<NormalizedRoute[]>;
  now(): number;
  report(result: PlanReport): void;
  save(path: string, plan: PlanV1): Promise<PlanV1>;
}

function assetIdOf(asset: AssetRegistryEntry): AssetId {
  return `${asset.chainId}:${asset.address}` as AssetId;
}

function findAsset(assetId: AssetId): AssetRegistryEntry | undefined {
  return ASSETS.find((asset) => assetIdOf(asset).toLowerCase() === assetId.toLowerCase());
}

function resolveDestination(chainKey: string, symbol: string): AssetRegistryEntry {
  const chain = (Object.entries(CHAINS) as Array<[string, (typeof CHAINS)[SupportedChainId]]>)
    .find(([, config]) => config.key === chainKey.toLowerCase());
  if (!chain) throw new Error(`Unknown destination chain: ${chainKey}`);
  const chainId = Number(chain[0]) as SupportedChainId;
  const destination = ASSETS.find(
    (asset) => asset.chainId === chainId
      && asset.destination
      && asset.symbol.toLowerCase() === symbol.toLowerCase(),
  );
  if (!destination) throw new Error('Target token is not an approved destination on this chain');
  return destination;
}

function amountUsd(amount: bigint, asset: AssetRegistryEntry, priceUsd: string): string {
  return new Decimal(amount.toString())
    .div(new Decimal(10).pow(asset.decimals))
    .times(priceUsd)
    .toDecimalPlaces(8, Decimal.ROUND_DOWN)
    .toFixed();
}

export async function runPlan(options: PlanOptions, dependencies: PlanDependencies): Promise<PlanReport> {
  const wallet = getAddress(options.wallet);
  const destination = resolveDestination(options.targetChain, options.targetToken);
  const targetAssetId = assetIdOf(destination);
  const minimum = new Decimal(options.minNetUsd);
  if (!minimum.isFinite() || minimum.isNegative()) throw new Error('Minimum net USD must be non-negative');

  const discovery = await dependencies.discover(wallet);
  const price = await dependencies.getPrice(
    destination.chainId,
    destination.address === 'native' ? 'native' : destination.address,
  );
  assertFreshPrice(price, dependencies.now(), 60_000);

  const routes: PlanV1['routes'] = [];
  for (const holding of discovery.balances.filter(({ amount }) => amount > 0n)) {
    const source = findAsset(holding.assetId);
    const fallback = { routeId: `holding:${holding.assetId}`, fromAsset: holding.assetId } as const;
    if (!source) {
      routes.push({ ...fallback, state: 'SKIPPED', reason: 'UNKNOWN_ASSET' });
      continue;
    }
    if (holding.assetId.toLowerCase() === targetAssetId.toLowerCase()) {
      routes.push({ ...fallback, state: 'SKIPPED', reason: 'ALREADY_TARGET' });
      continue;
    }

    let candidates: NormalizedRoute[];
    try {
      candidates = await dependencies.getRoutes({
        amount: holding.amount,
        fromChainId: source.chainId,
        fromToken: source.address,
        toChainId: destination.chainId,
        toToken: destination.address,
        wallet,
      });
    } catch {
      routes.push({ ...fallback, state: 'SKIPPED', reason: 'NO_ALLOWED_ROUTE' });
      continue;
    }
    const selection = selectBestRoute({
      minNetUsd: options.minNetUsd,
      outputUsd: (route) => amountUsd(route.quotedToAmount, destination, price.priceUsd),
      routePolicy: { maxSlippageBps: 100, now: dependencies.now() },
      routes: candidates,
    });
    if (selection.state === 'SKIPPED') {
      routes.push({ ...fallback, state: 'SKIPPED', reason: selection.reason });
      continue;
    }
    routes.push({
      state: 'READY',
      routeId: selection.route.id,
      fromAsset: selection.route.fromAsset,
      toAsset: selection.route.toAsset,
      fromAmount: selection.route.fromAmount.toString(),
      quotedToAmount: selection.route.quotedToAmount.toString(),
      minToAmount: (selection.route.quotedToAmount * 9_900n / 10_000n).toString(),
      netOutputUsd: selection.netOutputUsd,
      expiresAt: selection.route.expiresAt,
      toolIds: [...selection.route.toolIds],
    });
  }

  const plan: PlanV1 = {
    version: 1,
    id: 'pending',
    createdAt: new Date(dependencies.now()).toISOString(),
    wallet,
    target: { chainId: destination.chainId, assetId: targetAssetId },
    policy: { registryVersion: '2026-09-12', maxSlippageBps: 100, minNetUsd: options.minNetUsd },
    discovery: {
      mode: discovery.mode,
      completeChainIds: [...discovery.completeChainIds],
      warnings: [...discovery.warnings],
    },
    routes,
  };
  const saved = await dependencies.save(options.out, plan);
  const result = { plan: saved, warnings: saved.discovery.warnings };
  dependencies.report(result);
  return result;
}
