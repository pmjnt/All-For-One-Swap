import { Decimal } from 'decimal.js';

import type { NormalizedRoute } from '../domain/model.js';
import { validateRoute, type RoutePolicyOptions } from '../policy/validate-route.js';
import { netOutputUsd } from './economics.js';

export type PlanningSkipReason =
  | 'UNKNOWN_ASSET'
  | 'UNSUPPORTED_BEHAVIOR'
  | 'MISSING_PRICE'
  | 'INSUFFICIENT_GAS'
  | 'NO_ALLOWED_ROUTE'
  | 'PRICE_IMPACT'
  | 'BELOW_MIN_NET_USD';

export type RouteSelection =
  | { state: 'READY'; netOutputUsd: string; route: NormalizedRoute }
  | { state: 'SKIPPED'; reason: PlanningSkipReason };

export interface RouteSelectionInput {
  minNetUsd: string;
  outputUsd(route: NormalizedRoute): string;
  routePolicy: RoutePolicyOptions;
  routes: readonly NormalizedRoute[];
}

export function selectBestRoute(input: RouteSelectionInput): RouteSelection {
  let best: { net: Decimal; netOutputUsd: string; route: NormalizedRoute } | undefined;
  let missingPrice = false;

  for (const route of input.routes) {
    try {
      validateRoute(route, input.routePolicy);
    } catch {
      continue;
    }
    let outputUsd: string;
    try {
      outputUsd = input.outputUsd(route);
    } catch {
      missingPrice = true;
      continue;
    }
    const net = netOutputUsd({
      explicitFeeUsd: route.explicitFeeUsd,
      feeDeducted: route.explicitFeeAlreadyDeducted,
      gasUsd: route.gasUsd,
      outputUsd,
    });
    const decimalNet = new Decimal(net);
    if (!best || decimalNet.gt(best.net)) best = { net: decimalNet, netOutputUsd: net, route };
  }

  if (!best) {
    return { state: 'SKIPPED', reason: missingPrice ? 'MISSING_PRICE' : 'NO_ALLOWED_ROUTE' };
  }
  if (best.net.lt(new Decimal(input.minNetUsd))) {
    return { state: 'SKIPPED', reason: 'BELOW_MIN_NET_USD' };
  }
  return { state: 'READY', netOutputUsd: best.netOutputUsd, route: best.route };
}
