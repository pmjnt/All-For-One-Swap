import { describe, expect, it } from 'vitest';

import { gasCostUsd } from '../../src/providers/pricing.js';

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
