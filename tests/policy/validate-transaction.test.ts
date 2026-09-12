import { describe, expect, it } from 'vitest';
import { encodeFunctionData, parseAbi } from 'viem';

import { validateTransaction } from '../../src/policy/validate-transaction.js';
import {
  bridgeCalldata,
  makeSafeContext,
  mutate,
  swapAndBridgeCalldata,
} from '../support/route-builders.js';

function codeOf(run: () => unknown): string | undefined {
  try { run(); } catch (error) { return (error as { code?: string }).code; }
  return undefined;
}

describe('validateTransaction', () => {
  it('accepts the reviewed bridge transaction', () => {
    expect(() => validateTransaction(makeSafeContext())).not.toThrow();
  });

  it('accepts a decoded same-chain swap through a pinned DEX router', () => {
    const data = encodeFunctionData({
      abi: parseAbi([
        'function swapTokensSingleV3ERC20ToNative(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit) _swapData)',
      ]),
      functionName: 'swapTokensSingleV3ERC20ToNative',
      args: [
        `0x${'22'.repeat(32)}`, 'all-for-one', '',
        '0x0000000000000000000000000000000000000001', 990_000n,
        {
          callTo: '0x111111125421ca6dc452d289314280a0f8842a65',
          approveTo: '0x111111125421ca6dc452d289314280a0f8842a65',
          sendingAssetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          receivingAssetId: '0x0000000000000000000000000000000000000000',
          fromAmount: 1_000_000n, callData: '0x12345678', requiresDeposit: true,
        },
      ],
    });
    const context = makeSafeContext();
    context.route = {
      ...context.route,
      toAsset: '1:native',
      quotedToAmount: 1_000_000n,
      toolIds: ['1inch'],
      transaction: { ...context.route.transaction, data },
    };
    expect(() => validateTransaction(context)).not.toThrow();
  });

  it('accepts a fully decoded swap-then-Across route', () => {
    const context = makeSafeContext();
    context.approvalAmount = 10n ** 18n;
    context.route = {
      ...context.route,
      fromAmount: 10n ** 18n,
      fromAsset: '1:0x6B175474E89094C44Da98b954EedeAC495271d0F',
      toolIds: ['1inch', 'across'],
      transaction: { ...context.route.transaction, data: swapAndBridgeCalldata() },
    };
    expect(() => validateTransaction(context)).not.toThrow();
  });

  it('rejects a swap-then-Across route whose multiplier can deliver zero output', () => {
    const context = makeSafeContext();
    context.approvalAmount = 10n ** 18n;
    context.route = {
      ...context.route, fromAmount: 10n ** 18n,
      fromAsset: '1:0x6B175474E89094C44Da98b954EedeAC495271d0F',
      toolIds: ['1inch', 'across'],
      transaction: {
        ...context.route.transaction,
        data: swapAndBridgeCalldata({ outputAmountMultiplier: 0n }),
      },
    };
    expect(codeOf(() => validateTransaction(context))).toBe('SLIPPAGE_EXCEEDED');
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
