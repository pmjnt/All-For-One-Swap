import { Command } from 'commander';
import { pathToFileURL } from 'node:url';
import { createPublicClient, http } from 'viem';

import { runPlan } from './cli/plan.js';
import { executeWithLiveProviders, runExecute } from './cli/execute.js';
import { resumeFromFiles } from './cli/resume.js';
import { readRuntimeEnvironment } from './config/env.js';
import { CHAINS } from './config/chains.js';
import { createAlchemyPortfolioProvider } from './providers/alchemy.js';
import { discoverAssets } from './providers/discovery.js';
import { createLifiRouteProvider } from './providers/lifi.js';
import { createLifiPriceProvider } from './providers/pricing.js';
import { createRegistryRpcReader, registryAssetIds } from './providers/rpc.js';
import { renderPlanJson, reportPlan } from './reporting/console.js';
import { savePlan } from './storage/plan-store.js';
import { loadPlan } from './storage/plan-store.js';

export function buildCli(): Command {
  const cli = new Command().name('all-for-one');

  cli
    .command('plan')
    .requiredOption('--wallet <address>')
    .requiredOption('--target-chain <key>')
    .requiredOption('--target-token <symbol>')
    .option('--min-net-usd <decimal>', 'minimum net output after gas', '0.25')
    .option('--out <path>', 'plan output path', 'plan.json')
    .option('--json', 'emit the strict plan schema as JSON', false)
    .action(async (options: {
      json: boolean;
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
    });
  cli
    .command('execute')
    .requiredOption('--plan <path>')
    .option('--journal <path>', 'execution journal output path', 'journal.json')
    .action(async (options: { journal: string; plan: string }) => {
      await runExecute(options, {
        execute: executeWithLiveProviders,
        load: loadPlan,
      });
    });
  cli
    .command('resume')
    .requiredOption('--plan <path>')
    .requiredOption('--journal <path>')
    .option('--timeout-seconds <seconds>', 'bridge observation timeout', '600')
    .action(async (options: { journal: string; plan: string; timeoutSeconds: string }) => {
      const timeoutSeconds = Number(options.timeoutSeconds);
      if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0) {
        throw new Error('Timeout must be a non-negative number of seconds');
      }
      await resumeFromFiles({ ...options, timeoutSeconds });
    });

  return cli;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await buildCli().parseAsync(process.argv);
}
