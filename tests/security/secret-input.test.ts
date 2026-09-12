import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';

import { readSigner } from '../../src/security/secret-input.js';

const key = '0x0000000000000000000000000000000000000000000000000000000000000001';
const account = privateKeyToAccount(key);

describe('readSigner', () => {
  it('rejects execution without an interactive TTY', async () => {
    const prompt = vi.fn();

    await expect(readSigner(account.address, { isTTY: false, prompt })).rejects.toThrow(
      'interactive TTY',
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('rejects a key whose address does not match the plan', async () => {
    await expect(
      readSigner('0x0000000000000000000000000000000000000002', {
        isTTY: true,
        prompt: vi.fn().mockResolvedValue(key),
      }),
    ).rejects.toThrow('does not match');
  });

  it('returns the matching local account', async () => {
    const result = await readSigner(account.address, {
      isTTY: true,
      prompt: vi.fn().mockResolvedValue(key),
    });

    expect(result.address).toBe(account.address);
  });
});
