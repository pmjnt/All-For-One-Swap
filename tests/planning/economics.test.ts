import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { netOutputUsd, reserveNativeAmount } from '../../src/planning/economics.js';

describe('netOutputUsd', () => {
  it('does not subtract a fee already reflected in destination output', () => {
    expect(netOutputUsd({ outputUsd: '0.80', gasUsd: '0.10', explicitFeeUsd: '0.05', feeDeducted: true })).toBe('0.7');
  });

  it('subtracts a non-deducted explicit fee once', () => {
    expect(netOutputUsd({ outputUsd: '0.80', gasUsd: '0.10', explicitFeeUsd: '0.05', feeDeducted: false })).toBe('0.65');
  });

  it('never increases net output when gas increases', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000 }),
      fc.integer({ min: 0, max: 100_000 }),
      (left, right) => {
        const lower = Math.min(left, right);
        const higher = Math.max(left, right);
        const lowGas = Number(netOutputUsd({ outputUsd: '1000', gasUsd: String(lower), explicitFeeUsd: '0', feeDeducted: true }));
        const highGas = Number(netOutputUsd({ outputUsd: '1000', gasUsd: String(higher), explicitFeeUsd: '0', feeDeducted: true }));
        expect(highGas).toBeLessThanOrEqual(lowGas);
      },
    ));
  });
});

describe('reserveNativeAmount', () => {
  it('never spends more than balance after buffered gas reserve', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 0n, max: 10n ** 20n }),
      fc.bigInt({ min: 0n, max: 10n ** 18n }),
      (balance, gas) => {
        const result = reserveNativeAmount(balance, gas, 2_000);
        expect(result.spendable + result.reserve).toBeLessThanOrEqual(balance);
      },
    ));
  });
});
