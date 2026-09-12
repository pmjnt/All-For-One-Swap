import { describe, expect, it } from 'vitest';

import { ASSETS } from '../../src/config/assets.js';
import { CHAINS } from '../../src/config/chains.js';
import { PROTOCOLS } from '../../src/config/protocols.js';

describe('pinned registries', () => {
  it('contains exactly the six approved chain IDs', () => {
    expect(Object.keys(CHAINS).map(Number).sort((a, b) => a - b)).toEqual([
      1, 10, 56, 137, 8453, 42161,
    ]);
  });

  it('has unique chain/address asset identities with evidence', () => {
    const ids = ASSETS.map((asset) => `${asset.chainId}:${asset.address.toLowerCase()}`);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ASSETS.every((asset) => asset.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('supports an approved destination on every chain', () => {
    for (const chainId of Object.keys(CHAINS).map(Number)) {
      expect(ASSETS.some((asset) => asset.chainId === chainId && asset.destination)).toBe(true);
    }
  });

  it('does not trust a protocol without entrypoint, selector, and evidence', () => {
    expect(
      PROTOCOLS.every(
        (protocol) =>
          protocol.entrypoints.length > 0 &&
          protocol.selectors.length > 0 &&
          protocol.sourceUrl.startsWith('https://'),
      ),
    ).toBe(true);
  });
});
