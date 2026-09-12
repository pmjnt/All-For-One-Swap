import { describe, expect, it } from 'vitest';

import { buildCli } from '../../src/cli.js';

describe('CLI help', () => {
  it('registers plan, execute, and resume', () => {
    const names = buildCli().commands.map((command) => command.name());

    expect(names).toEqual(['plan', 'execute', 'resume']);
  });
});
