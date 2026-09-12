import { getAddress, maxUint256, zeroAddress, type Address } from 'viem';

import { PROTOCOLS } from '../config/protocols.js';
import type { NormalizedRoute } from '../domain/model.js';
import { decodeBridgeIntent, selectorOf } from './decode.js';
import { PolicyError, validateRoute } from './validate-route.js';

export interface TransactionPolicyContext {
  approvalAmount: bigint;
  approvalSpender?: Address;
  maxNativeValue: bigint;
  now?: number;
  receiver: Address;
  route: NormalizedRoute;
  wallet: Address;
}

function chainOf(assetId: string): number {
  return Number(assetId.slice(0, assetId.indexOf(':')));
}

function addressOf(assetId: string): Address {
  const address = assetId.slice(assetId.indexOf(':') + 1);
  return address === 'native' ? zeroAddress : getAddress(address);
}

export function validateTransaction(context: TransactionPolicyContext): void {
  const { route, wallet } = context;
  validateRoute(route, {
    maxSlippageBps: 100,
    ...(context.now === undefined ? {} : { now: context.now }),
  });
  if (route.transaction.chainId !== chainOf(route.fromAsset)) {
    throw new PolicyError('CHAIN_MISMATCH', 'Transaction chain differs from the source asset chain');
  }
  if (getAddress(route.transaction.from) !== getAddress(wallet)) {
    throw new PolicyError('SENDER_MISMATCH', 'Transaction sender differs from the selected wallet');
  }

  const protocol = PROTOCOLS.find(
    (entry) => entry.chainIds.includes(route.transaction.chainId)
      && entry.entrypoints.some((address) => address === getAddress(route.transaction.to)),
  );
  if (!protocol) {
    throw new PolicyError('UNKNOWN_ENTRYPOINT', 'Transaction target is not a reviewed entrypoint');
  }
  const selector = selectorOf(route.transaction.data);
  if (!protocol.selectors.includes(selector)) {
    throw new PolicyError('UNKNOWN_SELECTOR', 'Transaction selector is not reviewed');
  }
  if (route.transaction.value > context.maxNativeValue) {
    throw new PolicyError('VALUE_EXCEEDS_PLAN', 'Transaction native value exceeds the plan');
  }
  if (context.approvalAmount === maxUint256) {
    throw new PolicyError('UNLIMITED_APPROVAL', 'Unlimited token approvals are forbidden');
  }
  if (context.approvalAmount !== undefined && context.approvalAmount !== route.fromAmount) {
    throw new PolicyError('APPROVAL_AMOUNT_MISMATCH', 'Approval must equal the planned source amount');
  }
  if (
    context.approvalSpender !== undefined
    && !protocol.approvedSpenders.some((spender) => spender === getAddress(context.approvalSpender!))
  ) {
    throw new PolicyError('UNKNOWN_ENTRYPOINT', 'Approval spender is not reviewed');
  }

  let intent;
  try {
    intent = decodeBridgeIntent(route.transaction.data);
  } catch {
    throw new PolicyError('OPAQUE_CALL_SHAPE', 'Transaction calldata could not be decoded safely');
  }
  if (intent.receiver !== getAddress(context.receiver)) {
    throw new PolicyError('RECIPIENT_MISMATCH', 'Decoded receiver differs from the requested receiver');
  }
  if (intent.destinationChainId !== BigInt(chainOf(route.toAsset))) {
    throw new PolicyError('CHAIN_MISMATCH', 'Decoded destination chain differs from the route');
  }
  if (intent.sendingAsset !== addressOf(route.fromAsset) || intent.minAmount !== route.fromAmount) {
    throw new PolicyError('ALTERED_AMOUNT', 'Decoded source asset or amount differs from the route');
  }
  if (!route.toolIds.includes(intent.bridge) || !protocol.allowedBridgeTools.includes(intent.bridge)) {
    throw new PolicyError('UNKNOWN_TOOL', 'Decoded bridge is not reviewed');
  }
  if (intent.hasSourceSwaps || intent.hasDestinationCall) {
    throw new PolicyError('OPAQUE_CALL_SHAPE', 'Nested swap or destination call is not supported safely');
  }
}
