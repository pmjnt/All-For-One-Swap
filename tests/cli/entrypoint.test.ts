import { expect, it, vi } from 'vitest';

import { runCli } from '../../src/cli.js';

it('starts the wizard only for an empty CLI argument list', async () => {
  const wizard = vi.fn(async () => undefined);
  const parse = vi.fn(async () => undefined);

  await runCli(['node', 'dist/cli.js'], { parse, wizard });

  expect(wizard).toHaveBeenCalledOnce();
  expect(parse).not.toHaveBeenCalled();
});

it.each([
  ['--help'],
  ['plan', '--help'],
  ['execute', '--help'],
  ['resume', '--help'],
])('keeps explicit arguments on Commander: %s', async (...args) => {
  const wizard = vi.fn(async () => undefined);
  const parse = vi.fn(async () => undefined);

  await runCli(['node', 'dist/cli.js', ...args.flat()], { parse, wizard });

  expect(parse).toHaveBeenCalledOnce();
  expect(wizard).not.toHaveBeenCalled();
});
