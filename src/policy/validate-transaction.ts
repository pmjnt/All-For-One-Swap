import { getAddress, maxUint256, zeroAddress, type Address } from 'viem';

import { ASSETS } from '../config/assets.js';
import { DEX_ROUTERS, PROTOCOLS } from '../config/protocols.js';
import type { NormalizedRoute } from '../domain/model.js';
import {
  decodeAcrossIntent,
  decodeBridgeIntent,
  decodeSwapIntent,
  isBridgeSelector,
  selectorOf,
  type RawSwapData,
} from './decode.js';
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

function validateNestedSwaps(
  swaps: readonly RawSwapData[],
  route: NormalizedRoute,
): void {
  if (swaps.length !== 1) {
    throw new PolicyError('OPAQUE_CALL_SHAPE', 'Only one fully bounded aggregator swap is allowed');
  }
  for (const swap of swaps) {
    if (!swap.requiresDeposit || swap.fromAmount <= 0n || swap.callData.length < 10) {
      throw new PolicyError('OPAQUE_CALL_SHAPE', 'Nested swap deposit or calldata shape is unsafe');
    }
    const router = DEX_ROUTERS.find((entry) => entry.chainId === route.transaction.chainId
      && entry.address === swap.callTo && entry.address === swap.approveTo);
    if (!router || !route.toolIds.includes(router.tool)) {
      throw new PolicyError('UNKNOWN_TOOL', 'Nested swap router is not reviewed');
    }
    for (const address of [swap.sendingAssetId, swap.receivingAssetId]) {
      const known = address === zeroAddress || ASSETS.some((asset) => asset.chainId === route.transaction.chainId
        && asset.address !== 'native' && asset.address === address);
      if (!known) throw new PolicyError('UNKNOWN_ASSET', 'Nested swap contains an unknown asset');
    }
  }
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
  if (getAddress(context.receiver) !== getAddress(wallet)) {
    throw new PolicyError('RECIPIENT_MISMATCH', 'Requested receiver differs from the selected wallet');
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

  if (!isBridgeSelector(selector)) {
    let intent;
    try { intent = decodeSwapIntent(route.transaction.data); } catch {
      throw new PolicyError('OPAQUE_CALL_SHAPE', 'Transaction calldata could not be decoded safely');
    }
    if (chainOf(route.fromAsset) !== chainOf(route.toAsset)) {
      throw new PolicyError('CHAIN_MISMATCH', 'Generic swaps must remain on one chain');
    }
    if (intent.receiver !== getAddress(context.receiver)) {
      throw new PolicyError('RECIPIENT_MISMATCH', 'Decoded receiver differs from the requested receiver');
    }
    const first = intent.swaps[0];
    const last = intent.swaps.at(-1);
    if (!first || !last || first.sendingAssetId !== addressOf(route.fromAsset)
      || first.fromAmount !== route.fromAmount || last.receivingAssetId !== addressOf(route.toAsset)) {
      throw new PolicyError('ALTERED_AMOUNT', 'Decoded swap assets or amount differ from the route');
    }
    const minimum = route.quotedToAmount * 9_900n / 10_000n;
    if (intent.minAmountOut < minimum) {
      throw new PolicyError('SLIPPAGE_EXCEEDED', 'Decoded minimum output exceeds allowed slippage');
    }
    validateNestedSwaps(intent.swaps, route);
    const sourceIsNative = addressOf(route.fromAsset) === zeroAddress;
    if ((sourceIsNative && route.transaction.value !== route.fromAmount)
      || (!sourceIsNative && route.transaction.value !== 0n)) {
      throw new PolicyError('VALUE_EXCEEDS_PLAN', 'Swap native value does not match its source amount');
    }
    return;
  }

  let intent;
  try { intent = decodeBridgeIntent(route.transaction.data); } catch {
    throw new PolicyError('OPAQUE_CALL_SHAPE', 'Transaction calldata could not be decoded safely');
  }
  if (intent.receiver !== getAddress(context.receiver)) {
    throw new PolicyError('RECIPIENT_MISMATCH', 'Decoded receiver differs from the requested receiver');
  }
  if (intent.destinationChainId !== BigInt(chainOf(route.toAsset))) {
    throw new PolicyError('CHAIN_MISMATCH', 'Decoded destination chain differs from the route');
  }
  if (!intent.hasSourceSwaps
    && (intent.sendingAsset !== addressOf(route.fromAsset) || intent.minAmount !== route.fromAmount)) {
    throw new PolicyError('ALTERED_AMOUNT', 'Decoded source asset or amount differs from the route');
  }
  if (!route.toolIds.includes(intent.bridge) || !protocol.allowedBridgeTools.includes(intent.bridge)) {
    throw new PolicyError('UNKNOWN_TOOL', 'Decoded bridge is not reviewed');
  }
  if (intent.hasSourceSwaps || intent.hasDestinationCall) {
    if (intent.hasDestinationCall) {
      throw new PolicyError('OPAQUE_CALL_SHAPE', 'Destination calls are not supported safely');
    }
  }
  let across;
  try { across = decodeAcrossIntent(route.transaction.data); } catch {
    throw new PolicyError('OPAQUE_CALL_SHAPE', 'Across calldata could not be decoded safely');
  }
  if (across.receiver !== getAddress(context.receiver)
    || across.refundAddress !== getAddress(wallet)
    || across.receivingAsset !== addressOf(route.toAsset)) {
    throw new PolicyError('RECIPIENT_MISMATCH', 'Across destination intent differs from the route');
  }
  const minimumOutput = route.quotedToAmount * 9_900n / 10_000n;
  const conservativeAcrossOutput = intent.hasSourceSwaps
    ? intent.minAmount * across.outputAmountMultiplier / 10n ** 18n
    : across.outputAmount;
  if (conservativeAcrossOutput < minimumOutput) {
    throw new PolicyError('SLIPPAGE_EXCEEDED', 'Across output is below the allowed minimum');
  }
  if (across.fillDeadline * 1_000 <= (context.now ?? Date.now())) {
    throw new PolicyError('EXPIRED_QUOTE', 'Across fill deadline has expired');
  }
  if (intent.hasSourceSwaps) {
    const first = across.swaps[0];
    const last = across.swaps.at(-1);
    if (!first || !last || first.sendingAssetId !== addressOf(route.fromAsset)
      || first.fromAmount !== route.fromAmount || last.receivingAssetId !== across.sendingAsset
      || intent.sendingAsset !== across.sendingAsset || intent.minAmount <= 0n) {
      throw new PolicyError('ALTERED_AMOUNT', 'Across source swap differs from the route');
    }
    validateNestedSwaps(across.swaps, route);
  } else if (across.sendingAsset !== addressOf(route.fromAsset)) {
    throw new PolicyError('UNKNOWN_ASSET', 'Across sending asset differs from the route');
  }
}
