import { createPublicClient, http } from 'viem';

import { CHAINS } from '../config/chains.js';
import { readRuntimeEnvironment } from '../config/env.js';
import { createAlchemyPortfolioProvider } from '../providers/alchemy.js';
import { discoverAssets } from '../providers/discovery.js';
import { createLifiRouteProvider } from '../providers/lifi.js';
import { createLifiPriceProvider } from '../providers/pricing.js';
import { createRegistryRpcReader, registryAssetIds } from '../providers/rpc.js';
import { renderPlanJson, reportPlan, type PlanReport } from '../reporting/console.js';
import { savePlan } from '../storage/plan-store.js';
import { runPlan, type PlanOptions } from './plan.js';

export async function runPlanWithLiveProviders(
  options: PlanOptions & { json?: boolean },
): Promise<PlanReport> {
  const environment = readRuntimeEnvironment();
  const rpc = createRegistryRpcReader();
  const routeProvider = createLifiRouteProvider();
  const priceProvider = createLifiPriceProvider();
  const indexed = environment.alchemyApiKey
    ? createAlchemyPortfolioProvider(environment.alchemyApiKey)
    : undefined;

  return runPlan(options, {
    discover: (wallet) => discoverAssets(wallet, {
      alchemyApiKey: environment.alchemyApiKey,
      ...(indexed ? { indexed } : {}),
      registryAssetIds: registryAssetIds(),
      rpc,
    }),
    getPrice: priceProvider.getPrice,
    getRoutes: routeProvider.getRoutes,
    nativeGasCost: async (chainId) => {
      const config = CHAINS[chainId];
      const client = createPublicClient({
        chain: config.chain,
        transport: http(process.env[config.rpcEnv] ?? config.publicRpcUrl, {
          retryCount: 0,
          timeout: 5_000,
        }),
      });
      return (await client.getGasPrice()) * 750_000n;
    },
    now: Date.now,
    report: options.json
      ? (result) => process.stdout.write(`${renderPlanJson(result.plan)}\n`)
      : reportPlan,
    save: savePlan,
  });
}
