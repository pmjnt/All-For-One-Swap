import { Command } from 'commander';
import { pathToFileURL } from 'node:url';

import { runPlan } from './cli/plan.js';
import { readRuntimeEnvironment } from './config/env.js';
import { createAlchemyPortfolioProvider } from './providers/alchemy.js';
import { discoverAssets } from './providers/discovery.js';
import { createLifiRouteProvider } from './providers/lifi.js';
import { createLifiPriceProvider } from './providers/pricing.js';
import { createRegistryRpcReader, registryAssetIds } from './providers/rpc.js';
import { reportPlan } from './reporting/console.js';
import { savePlan } from './storage/plan-store.js';

export function buildCli(): Command {
  const cli = new Command().name('all-for-one');

  cli
    .command('plan')
    .requiredOption('--wallet <address>')
    .requiredOption('--target-chain <key>')
    .requiredOption('--target-token <symbol>')
    .option('--min-net-usd <decimal>', 'minimum net output after gas', '0.25')
    .option('--out <path>', 'plan output path', 'plan.json')
    .action(async (options: {
      minNetUsd: string;
      out: string;
      targetChain: string;
      targetToken: string;
      wallet: string;
    }) => {
      const environment = readRuntimeEnvironment();
      const rpc = createRegistryRpcReader();
      const routeProvider = createLifiRouteProvider();
      const priceProvider = createLifiPriceProvider();
      const indexed = environment.alchemyApiKey
        ? createAlchemyPortfolioProvider(environment.alchemyApiKey)
        : undefined;
      await runPlan(options, {
        discover: (wallet) => discoverAssets(wallet, {
          alchemyApiKey: environment.alchemyApiKey,
          ...(indexed ? { indexed } : {}),
          registryAssetIds: registryAssetIds(),
          rpc,
        }),
        getPrice: priceProvider.getPrice,
        getRoutes: routeProvider.getRoutes,
        now: Date.now,
        report: reportPlan,
        save: savePlan,
      });
    });
  cli.command('execute');
  cli.command('resume');

  return cli;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await buildCli().parseAsync(process.argv);
}
