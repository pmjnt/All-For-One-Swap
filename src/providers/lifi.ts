import { Decimal } from 'decimal.js';
import { getAddress, type Address, type Hex } from 'viem';
import { z } from 'zod';

import type { AssetId, NormalizedRoute, SupportedChainId } from '../domain/model.js';

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const integerSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const decimalSchema = z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/);
const hexQuantitySchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hexDataSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/);
const supportedChainSchema = z.union([
  z.literal(1), z.literal(10), z.literal(56), z.literal(137), z.literal(8453), z.literal(42161),
]);

const tokenSchema = z.object({ chainId: supportedChainSchema, address: addressSchema }).passthrough();
const costSchema = z
  .object({ amountUSD: decimalSchema, included: z.boolean().optional() })
  .passthrough();
const transactionSchema = z
  .object({
    chainId: supportedChainSchema,
    from: addressSchema,
    to: addressSchema,
    data: hexDataSchema,
    value: hexQuantitySchema,
    gasLimit: hexQuantitySchema,
  })
  .passthrough();
const stepSchema = z
  .object({
    id: z.string().min(1),
    tool: z.string().min(1),
    estimate: z
      .object({
        approvalAddress: addressSchema.optional(),
        gasCosts: z.array(costSchema),
        feeCosts: z.array(costSchema),
      })
      .passthrough(),
    includedSteps: z.array(z.object({ tool: z.string().min(1) }).passthrough()),
    transactionRequest: transactionSchema,
  })
  .passthrough();
const quotedStepSchema = stepSchema.omit({ transactionRequest: true });
const routeSchema = z
  .object({
    id: z.string().min(1),
    fromChainId: supportedChainSchema,
    toChainId: supportedChainSchema,
    fromAmount: integerSchema,
    toAmount: integerSchema,
    fromToken: tokenSchema,
    toToken: tokenSchema,
    steps: z.array(stepSchema).length(1),
    expiresAt: z.iso.datetime(),
  })
  .passthrough();
const routesSchema = z.object({ routes: z.array(routeSchema) }).passthrough();
const quotedRouteSchema = routeSchema.extend({
  steps: z.array(quotedStepSchema).length(1),
  expiresAt: z.iso.datetime().optional(),
});
const quotedRoutesSchema = z.object({ routes: z.array(quotedRouteSchema) }).passthrough();

const zeroAddress = '0x0000000000000000000000000000000000000000';

function assetId(chainId: SupportedChainId, rawAddress: string): AssetId {
  const address = getAddress(rawAddress);
  return `${chainId}:${address === zeroAddress ? 'native' : address}` as AssetId;
}

function sumUsd(costs: readonly { amountUSD: string }[]): string {
  return costs
    .reduce((total, cost) => total.plus(cost.amountUSD), new Decimal(0))
    .toDecimalPlaces(8, Decimal.ROUND_UP)
    .toFixed();
}

export function normalizeLifiRoutes(input: unknown): NormalizedRoute[] {
  const response = routesSchema.parse(input);
  return response.routes.map((route) => {
    if (route.fromToken.chainId !== route.fromChainId || route.toToken.chainId !== route.toChainId) {
      throw new Error(`LI.FI route ${route.id} has inconsistent token chain IDs`);
    }
    const step = route.steps[0];
    if (!step || step.transactionRequest.chainId !== route.fromChainId) {
      throw new Error(`LI.FI route ${route.id} has an inconsistent transaction chain`);
    }
    const inclusion = new Set(step.estimate.feeCosts.map((cost) => cost.included ?? false));
    if (inclusion.size > 1) throw new Error(`LI.FI route ${route.id} mixes deducted and non-deducted fees`);

    return {
      explicitFeeAlreadyDeducted: inclusion.size === 0 || inclusion.has(true),
      explicitFeeUsd: sumUsd(step.estimate.feeCosts),
      expiresAt: route.expiresAt,
      fromAmount: BigInt(route.fromAmount),
      fromAsset: assetId(route.fromChainId, route.fromToken.address),
      gasUsd: sumUsd(step.estimate.gasCosts),
      id: route.id,
      intermediateAssets: [],
      quotedToAmount: BigInt(route.toAmount),
      toAsset: assetId(route.toChainId, route.toToken.address),
      toolIds: [...new Set([step.tool, ...step.includedSteps.map(({ tool }) => tool)])],
      transaction: {
        ...(step.estimate.approvalAddress
          ? { approvalAddress: getAddress(step.estimate.approvalAddress) }
          : {}),
        chainId: step.transactionRequest.chainId,
        data: step.transactionRequest.data as Hex,
        from: getAddress(step.transactionRequest.from),
        gasLimit: BigInt(step.transactionRequest.gasLimit),
        to: getAddress(step.transactionRequest.to),
        value: BigInt(step.transactionRequest.value),
      },
    };
  });
}

export interface LifiRouteRequest {
  amount: bigint;
  fromChainId: SupportedChainId;
  fromToken: Address | 'native';
  toChainId: SupportedChainId;
  toToken: Address | 'native';
  wallet: Address;
}

export function createLifiRouteProvider(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): {
  getRoutes(request: LifiRouteRequest): Promise<NormalizedRoute[]>;
} {
  return {
    async getRoutes(request) {
      const native = zeroAddress;
      let response: Response;
      try {
        response = await fetcher('https://li.quest/v1/advanced/routes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fromAddress: request.wallet,
            fromAmount: request.amount.toString(),
            fromChainId: request.fromChainId,
            fromTokenAddress: request.fromToken === 'native' ? native : request.fromToken,
            options: {
              bridges: { allow: ['across', 'stargateV2'] },
              exchanges: { allow: ['1inch', 'odos'] },
              order: 'RECOMMENDED',
              slippage: 0.01,
            },
            toAddress: request.wallet,
            toChainId: request.toChainId,
            toTokenAddress: request.toToken === 'native' ? native : request.toToken,
          }),
        });
      } catch {
        throw new Error('LI.FI route network request failed');
      }
      if (!response.ok) throw new Error(`LI.FI route request failed with HTTP ${response.status}`);
      const quoted = quotedRoutesSchema.parse(await response.json());
      const routes = await Promise.all(
        quoted.routes.map(async (route) => {
          const step = route.steps[0];
          if (!step) throw new Error(`LI.FI route ${route.id} does not contain exactly one step`);

          let transactionResponse: Response;
          try {
            transactionResponse = await fetcher('https://li.quest/v1/advanced/stepTransaction', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(step),
            });
          } catch {
            throw new Error('LI.FI transaction network request failed');
          }
          if (!transactionResponse.ok) {
            throw new Error(
              `LI.FI transaction request failed with HTTP ${transactionResponse.status}`,
            );
          }
          const hydratedStep = stepSchema.parse(await transactionResponse.json());
          return {
            ...route,
            expiresAt: new Date(now() + 30_000).toISOString(),
            steps: [hydratedStep],
          };
        }),
      );
      return normalizeLifiRoutes({ routes });
    },
  };
}
