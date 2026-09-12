import { describe, expect, it } from 'vitest';

import { validateTransaction } from '../../src/policy/validate-transaction.js';
import { bridgeCalldata, makeSafeContext, mutate } from '../support/route-builders.js';

function codeOf(run: () => unknown): string | undefined {
  try { run(); } catch (error) { return (error as { code?: string }).code; }
  return undefined;
}

describe('validateTransaction', () => {
  it('accepts the reviewed bridge transaction', () => {
    expect(() => validateTransaction(makeSafeContext())).not.toThrow();
  });

  it.each([
    ['RECIPIENT_MISMATCH', mutate({ receiver: '0x0000000000000000000000000000000000000002' })],
    ['CHAIN_MISMATCH', mutate({ chainId: 56 })],
    ['UNKNOWN_ENTRYPOINT', mutate({ to: '0x0000000000000000000000000000000000000003' })],
    ['UNLIMITED_APPROVAL', mutate({ approvalAmount: (1n << 256n) - 1n })],
    ['UNKNOWN_SELECTOR', mutate({ data: '0xdeadbeef' })],
    ['VALUE_EXCEEDS_PLAN', mutate({ value: 10n ** 20n })],
    ['ALTERED_AMOUNT', mutate({ data: bridgeCalldata({ minAmount: 999_999n }) })],
    ['UNKNOWN_TOOL', mutate({ data: bridgeCalldata({ bridge: 'evil-bridge' }) })],
    ['OPAQUE_CALL_SHAPE', mutate({ data: '0xa1f1ce43' })],
  ])('rejects %s before signing', (expectedCode, applyMutation) => {
    expect(codeOf(() => validateTransaction(applyMutation(makeSafeContext())))).toBe(expectedCode);
  });
});
