import { Command } from 'commander';
import { pathToFileURL } from 'node:url';

export function buildCli(): Command {
  const cli = new Command().name('all-for-one');

  cli.command('plan');
  cli.command('execute');
  cli.command('resume');

  return cli;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await buildCli().parseAsync(process.argv);
}
