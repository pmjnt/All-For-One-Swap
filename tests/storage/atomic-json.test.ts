import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeJsonAtomic } from '../../src/storage/atomic-json.js';

describe('writeJsonAtomic', () => {
  it('keeps the previous file intact when rename fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'all-for-one-'));
    const destination = join(directory, 'plan.json');
    await writeFile(destination, '{"old":true}\n', { mode: 0o600 });

    await expect(writeJsonAtomic(destination, { next: true }, {
      rename: async () => { throw new Error('injected rename failure'); },
    })).rejects.toThrow('injected rename failure');

    expect(JSON.parse(await readFile(destination, 'utf8'))).toEqual({ old: true });
  });

  it('writes private files containing valid JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'all-for-one-'));
    const destination = join(directory, 'journal.json');
    await writeJsonAtomic(destination, { ok: true });
    expect(JSON.parse(await readFile(destination, 'utf8'))).toEqual({ ok: true });
    expect((await stat(destination)).mode & 0o777).toBe(0o600);
  });
});
