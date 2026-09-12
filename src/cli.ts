import { Command } from 'commander';
import { pathToFileURL } from 'node:url';

import { executeWithLiveProviders, runExecute } from './cli/execute.js';
import { runPlanWithLiveProviders } from './cli/live-plan.js';
import { resumeFromFiles } from './cli/resume.js';
import { runLiveWizard } from './cli/wizard.js';
import { loadPlan } from './storage/plan-store.js';

export interface CliDispatchDependencies {
  parse(argv: readonly string[]): Promise<unknown>;
  wizard(): Promise<unknown>;
}

export async function runCli(
  argv: readonly string[],
  dependencies: CliDispatchDependencies = {
    parse: (values) => buildCli().parseAsync([...values]),
    wizard: runLiveWizard,
  },
): Promise<void> {
  if (argv.length === 2) {
    await dependencies.wizard();
    return;
  }
  await dependencies.parse(argv);
}

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
      await runPlanWithLiveProviders(options);
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
  await runCli(process.argv);
}
