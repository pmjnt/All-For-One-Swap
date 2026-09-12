import { getAddress } from 'viem';
import { createPublicClient, http } from 'viem';

import { runPlan } from '../src/cli/plan.js';
import { CHAINS } from '../src/config/chains.js';
import { ASSETS } from '../src/config/assets.js';
import { DEX_ROUTERS, PROTOCOLS } from '../src/config/protocols.js';
import { createAlchemyPortfolioProvider } from '../src/providers/alchemy.js';
import { discoverAssets } from '../src/providers/discovery.js';
import { createLifiRouteProvider } from '../src/providers/lifi.js';
import { createLifiPriceProvider } from '../src/providers/pricing.js';
import { createRegistryRpcReader, registryAssetIds } from '../src/providers/rpc.js';
import { reportPlan } from '../src/reporting/console.js';
import { computePlanId } from '../src/storage/plan-store.js';

const argumentsList = process.argv.slice(2);
if (argumentsList.length !== 2 || argumentsList[0] !== '--wallet' || !argumentsList[1]) {
  throw new Error('Usage: npm run smoke:mainnet -- --wallet <public-address>');
}
const wallet = getAddress(argumentsList[1]);
if (Object.keys(CHAINS).length !== 6 || ASSETS.length === 0 || PROTOCOLS.length !== 1) {
  throw new Error('Static registry is incomplete');
}
for (const chainId of Object.keys(CHAINS).map(Number)) {
  if (!ASSETS.some((asset) => asset.chainId === chainId && asset.destination)) {
    throw new Error(`Missing destination registry for chain ${chainId}`);
  }
  if (!DEX_ROUTERS.some((router) => router.chainId === chainId)) {
    throw new Error(`Missing DEX router registry for chain ${chainId}`);
  }
}
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const indexed = alchemyApiKey ? createAlchemyPortfolioProvider(alchemyApiKey) : undefined;
const rpc = createRegistryRpcReader();
const routes = createLifiRouteProvider();
const prices = createLifiPriceProvider();

const result = await runPlan({
  minNetUsd: '0.25', out: 'unused', targetChain: 'base', targetToken: 'USDC', wallet,
}, {
  discover: (address) => discoverAssets(address, {
    alchemyApiKey,
    ...(indexed ? { indexed } : {}),
    registryAssetIds: registryAssetIds(), rpc,
  }),
  getPrice: prices.getPrice,
  getRoutes: routes.getRoutes,
  nativeGasCost: async (chainId) => {
    const config = CHAINS[chainId];
    const client = createPublicClient({
      chain: config.chain,
      transport: http(process.env[config.rpcEnv] ?? config.publicRpcUrl, {
        retryCount: 0, timeout: 5_000,
      }),
    });
    return (await client.getGasPrice()) * 750_000n;
  },
  now: Date.now,
  report: reportPlan,
  save: async (_path, plan) => ({ ...plan, id: computePlanId(plan) }),
});

if (result.plan.discovery.completeChainIds.length !== 6 || result.warnings.length > 0) {
  throw new Error('Mainnet discovery was incomplete; inspect the warnings above');
}
