import { encodeAbiParameters, getAddress, type Address, type Hex } from 'viem';

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

export function bridgeCalldata(overrides: {
  bridge?: string;
  minAmount?: bigint;
  receiver?: Address;
} = {}): Hex {
  const encoded = encodeAbiParameters(
    [BRIDGE_DATA],
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
    }],
  );
  return `0xa1f1ce43${encoded.slice(2)}`;
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
