import { encodeAbiParameters, getAddress, pad, type Address, type Hex } from 'viem';

import type { NormalizedRoute, SupportedChainId } from '../../src/domain/model.js';
import type { TransactionPolicyContext } from '../../src/policy/validate-transaction.js';
import { TEST_WALLET, validRoute } from './factories.js';

const BRIDGE_DATA = {
  type: 'tuple',
  components: [
    { name: 'transactionId', type: 'bytes32' },
    { name: 'bridge', type: 'string' },
    { name: 'integrator', type: 'string' },
    { name: 'referrer', type: 'address' },
    { name: 'sendingAssetId', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'minAmount', type: 'uint256' },
    { name: 'destinationChainId', type: 'uint256' },
    { name: 'hasSourceSwaps', type: 'bool' },
    { name: 'hasDestinationCall', type: 'bool' },
  ],
} as const;
const ACROSS_DATA = {
  type: 'tuple',
  components: [
    { name: 'receiverAddress', type: 'bytes32' }, { name: 'refundAddress', type: 'bytes32' },
    { name: 'sendingAssetId', type: 'bytes32' }, { name: 'receivingAssetId', type: 'bytes32' },
    { name: 'outputAmount', type: 'uint256' }, { name: 'outputAmountMultiplier', type: 'uint128' },
    { name: 'exclusiveRelayer', type: 'bytes32' }, { name: 'quoteTimestamp', type: 'uint32' },
    { name: 'fillDeadline', type: 'uint32' }, { name: 'exclusivityParameter', type: 'uint32' },
    { name: 'message', type: 'bytes' },
  ],
} as const;
const SWAP_DATA = {
  type: 'tuple[]',
  components: [
    { name: 'callTo', type: 'address' }, { name: 'approveTo', type: 'address' },
    { name: 'sendingAssetId', type: 'address' }, { name: 'receivingAssetId', type: 'address' },
    { name: 'fromAmount', type: 'uint256' }, { name: 'callData', type: 'bytes' },
    { name: 'requiresDeposit', type: 'bool' },
  ],
} as const;

export function bridgeCalldata(overrides: {
  bridge?: string;
  minAmount?: bigint;
  receiver?: Address;
} = {}): Hex {
  const encoded = encodeAbiParameters(
    [BRIDGE_DATA, ACROSS_DATA],
    [{
      transactionId: `0x${'11'.repeat(32)}`,
      bridge: overrides.bridge ?? 'across',
      integrator: 'all-for-one',
      referrer: '0x0000000000000000000000000000000000000000',
      sendingAssetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      receiver: overrides.receiver ?? TEST_WALLET,
      minAmount: overrides.minAmount ?? 1_000_000n,
      destinationChainId: 8453n,
      hasSourceSwaps: false,
      hasDestinationCall: false,
    }, {
      receiverAddress: pad(overrides.receiver ?? TEST_WALLET, { size: 32 }),
      refundAddress: pad(TEST_WALLET, { size: 32 }),
      sendingAssetId: pad('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', { size: 32 }),
      receivingAssetId: pad('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', { size: 32 }),
      outputAmount: 900_000n,
      outputAmountMultiplier: 0n,
      exclusiveRelayer: `0x${'00'.repeat(32)}`,
      quoteTimestamp: 1_757_635_200,
      fillDeadline: 1_893_456_000,
      exclusivityParameter: 0,
      message: '0x',
    }],
  );
  return `0xa1f1ce43${encoded.slice(2)}`;
}

export function swapAndBridgeCalldata(overrides: { outputAmountMultiplier?: bigint } = {}): Hex {
  const daiAmount = 10n ** 18n;
  const router = getAddress('0x111111125421ca6dc452d289314280a0f8842a65');
  const encoded = encodeAbiParameters([BRIDGE_DATA, SWAP_DATA, ACROSS_DATA], [{
    transactionId: `0x${'33'.repeat(32)}`,
    bridge: 'across', integrator: 'all-for-one',
    referrer: '0x0000000000000000000000000000000000000000',
    sendingAssetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    receiver: TEST_WALLET, minAmount: 1_000_000n, destinationChainId: 8453n,
    hasSourceSwaps: true, hasDestinationCall: false,
  }, [{
    callTo: router, approveTo: router,
    sendingAssetId: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    receivingAssetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    fromAmount: daiAmount, callData: '0x12345678', requiresDeposit: true,
  }], {
    receiverAddress: pad(TEST_WALLET, { size: 32 }), refundAddress: pad(TEST_WALLET, { size: 32 }),
    sendingAssetId: pad('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', { size: 32 }),
    receivingAssetId: pad('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', { size: 32 }),
    outputAmount: 900_000n,
    outputAmountMultiplier: overrides.outputAmountMultiplier ?? 900_000_000_000_000_000n,
    exclusiveRelayer: `0x${'00'.repeat(32)}`, quoteTimestamp: 1_757_635_200,
    fillDeadline: 1_893_456_000, exclusivityParameter: 0, message: '0x',
  }]);
  return `0x1794958f${encoded.slice(2)}`;
}

export function makeSafeContext(): TransactionPolicyContext {
  const route: NormalizedRoute = validRoute({
    transaction: {
      chainId: 1,
      data: bridgeCalldata(),
      from: TEST_WALLET,
      gasLimit: 250_000n,
      to: getAddress('0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'),
      value: 0n,
    },
  });
  return {
    approvalAmount: 1_000_000n,
    maxNativeValue: 0n,
    now: Date.parse('2026-09-12T00:00:00.000Z'),
    receiver: TEST_WALLET,
    route,
    wallet: TEST_WALLET,
  };
}

export interface ContextMutation {
  approvalAmount?: bigint;
  chainId?: SupportedChainId;
  data?: Hex;
  receiver?: Address;
  to?: Address;
  value?: bigint;
}

export function mutate(change: ContextMutation): (context: TransactionPolicyContext) => TransactionPolicyContext {
  return (context) => ({
    ...context,
    approvalAmount: change.approvalAmount ?? context.approvalAmount,
    receiver: change.receiver ?? context.receiver,
    route: {
      ...context.route,
      transaction: {
        ...context.route.transaction,
        chainId: change.chainId ?? context.route.transaction.chainId,
        data: change.data ?? context.route.transaction.data,
        to: change.to ?? context.route.transaction.to,
        value: change.value ?? context.route.transaction.value,
      },
    },
  });
}
