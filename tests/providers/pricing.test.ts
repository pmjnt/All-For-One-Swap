import { describe, expect, it, vi } from 'vitest';

import { createLifiPriceProvider, gasCostUsd } from '../../src/providers/pricing.js';

describe('gasCostUsd', () => {
  it('uses bigint units and decimal USD arithmetic', () => {
    expect(
      gasCostUsd({
        gasUnits: 21_000n,
        maxFeePerGas: 20_000_000_000n,
        nativeDecimals: 18,
        nativeUsd: '2500',
      }),
    ).toBe('1.05');
  });

  it('rejects a non-positive price', () => {
    expect(() =>
      gasCostUsd({ gasUnits: 1n, maxFeePerGas: 1n, nativeDecimals: 18, nativeUsd: '0' }),
    ).toThrow('positive');
  });
});

it('maps native assets to the LI.FI zero-address identity', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    priceUSD: '1',
  }), { status: 200 }));
  await createLifiPriceProvider(fetcher).getPrice(56, 'native');
  expect(String(fetcher.mock.calls[0]?.[0])).toContain(
    'token=0x0000000000000000000000000000000000000000',
  );
});
