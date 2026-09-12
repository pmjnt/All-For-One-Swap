import { getAddress } from 'viem';

import { ASSETS } from '../config/assets.js';
import { PROTOCOLS } from '../config/protocols.js';
import type { AssetId, NormalizedRoute } from '../domain/model.js';

export type PolicyErrorCode =
  | 'ALTERED_AMOUNT'
  | 'APPROVAL_AMOUNT_MISMATCH'
  | 'CHAIN_MISMATCH'
  | 'EXPIRED_QUOTE'
  | 'OPAQUE_CALL_SHAPE'
  | 'RECIPIENT_MISMATCH'
  | 'SENDER_MISMATCH'
  | 'SLIPPAGE_EXCEEDED'
  | 'UNKNOWN_ASSET'
  | 'UNKNOWN_ENTRYPOINT'
  | 'UNKNOWN_SELECTOR'
  | 'UNKNOWN_TOOL'
  | 'UNLIMITED_APPROVAL'
  | 'VALUE_EXCEEDS_PLAN';

export class PolicyError extends Error {
  constructor(readonly code: PolicyErrorCode, message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

function canonicalAssetId(asset: AssetId): string {
  const separator = asset.indexOf(':');
  const chainId = asset.slice(0, separator);
  const address = asset.slice(separator + 1);
  return `${chainId}:${address === 'native' ? address : getAddress(address).toLowerCase()}`;
}

const knownAssets = new Set(
  ASSETS.map((asset) => `${asset.chainId}:${asset.address === 'native' ? 'native' : asset.address.toLowerCase()}`),
);
const knownTools = new Set(
  PROTOCOLS.flatMap((protocol) => [
    ...protocol.allowedBridgeTools,
    ...protocol.allowedExchangeTools,
  ]),
);

export interface RoutePolicyOptions {
  expectedToAmount?: bigint;
  maxPriceImpactBps?: number;
  maxSlippageBps: number;
  now?: number;
  priceImpactBps?: number;
}

export function validateRoute(route: NormalizedRoute, options: RoutePolicyOptions): void {
  for (const asset of [route.fromAsset, route.toAsset, ...route.intermediateAssets]) {
    if (!knownAssets.has(canonicalAssetId(asset))) {
      throw new PolicyError('UNKNOWN_ASSET', 'Route contains an asset outside the reviewed registry');
    }
  }
  for (const tool of route.toolIds) {
    if (!knownTools.has(tool)) {
      throw new PolicyError('UNKNOWN_TOOL', 'Route contains a tool outside the reviewed registry');
    }
  }
  if (Date.parse(route.expiresAt) <= (options.now ?? Date.now())) {
    throw new PolicyError('EXPIRED_QUOTE', 'Route quote has expired');
  }
  if (options.expectedToAmount !== undefined) {
    const minimum = options.expectedToAmount * BigInt(10_000 - options.maxSlippageBps) / 10_000n;
    if (route.quotedToAmount < minimum) {
      throw new PolicyError('SLIPPAGE_EXCEEDED', 'Route output exceeds the configured slippage');
    }
  }
  if (
    options.priceImpactBps !== undefined &&
    options.priceImpactBps > (options.maxPriceImpactBps ?? options.maxSlippageBps)
  ) {
    throw new PolicyError('SLIPPAGE_EXCEEDED', 'Route price impact exceeds the configured limit');
  }
}
