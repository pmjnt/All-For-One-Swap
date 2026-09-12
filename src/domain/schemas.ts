import { z } from 'zod';

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hexSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/);
const uintStringSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const decimalSchema = z.string().regex(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/);
const supportedChainIdSchema = z.union([
  z.literal(1),
  z.literal(10),
  z.literal(56),
  z.literal(137),
  z.literal(8453),
  z.literal(42161),
]);
const assetIdSchema = z
  .string()
  .regex(/^(?:1|10|56|137|8453|42161):(?:native|0x[0-9a-fA-F]{40})$/);

export const routeStateSchema = z.enum([
  'SKIPPED',
  'READY',
  'SUBMITTED',
  'CONFIRMED',
  'BRIDGE_PENDING',
  'COMPLETED',
  'FAILED',
]);

export type PersistedRouteState = z.infer<typeof routeStateSchema>;

const stateRank: Readonly<Partial<Record<PersistedRouteState, number>>> = {
  READY: 0,
  SUBMITTED: 1,
  CONFIRMED: 2,
  BRIDGE_PENDING: 3,
  COMPLETED: 4,
};

export function isMonotonicHistory(history: readonly PersistedRouteState[]): boolean {
  if (history.length === 0) return false;

  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    if (!previous || !current) return false;
    if (previous === 'SKIPPED' || previous === 'COMPLETED' || previous === 'FAILED') return false;
    if (current === 'FAILED') continue;
    if (current === 'SKIPPED') return false;
    const previousRank = stateRank[previous];
    const currentRank = stateRank[current];
    if (previousRank === undefined || currentRank === undefined || currentRank < previousRank) return false;
  }

  return true;
}

const warningSchema = z
  .object({
    chainId: supportedChainIdSchema,
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const readyRouteSchema = z
  .object({
    state: z.literal('READY'),
    routeId: z.string().min(1),
    fromAsset: assetIdSchema,
    toAsset: assetIdSchema,
    fromAmount: uintStringSchema,
    quotedToAmount: uintStringSchema,
    minToAmount: uintStringSchema,
    netOutputUsd: decimalSchema,
    expiresAt: z.iso.datetime(),
    toolIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const skippedRouteSchema = z
  .object({
    state: z.literal('SKIPPED'),
    routeId: z.string().min(1),
    fromAsset: assetIdSchema,
    reason: z.string().min(1),
  })
  .strict();

export const planSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    createdAt: z.iso.datetime(),
    wallet: addressSchema,
    target: z
      .object({
        chainId: supportedChainIdSchema,
        assetId: assetIdSchema,
      })
      .strict(),
    policy: z
      .object({
        registryVersion: z.string().min(1),
        maxSlippageBps: z.number().int().min(0).max(100),
        minNetUsd: decimalSchema,
      })
      .strict(),
    discovery: z
      .object({
        mode: z.enum(['INDEXED', 'ALLOWLIST_ONLY', 'PARTIAL']),
        completeChainIds: z.array(supportedChainIdSchema),
        warnings: z.array(warningSchema),
      })
      .strict(),
    routes: z.array(z.discriminatedUnion('state', [readyRouteSchema, skippedRouteSchema])),
  })
  .strict();

export type PlanV1 = z.infer<typeof planSchema>;

const journalRouteSchema = z
  .object({
    routeId: z.string().min(1),
    state: routeStateSchema,
    history: z.array(routeStateSchema).min(1),
    txHashes: z.array(hexSchema),
    destinationBalanceBefore: uintStringSchema.optional(),
  })
  .strict()
  .superRefine((route, context) => {
    if (!isMonotonicHistory(route.history)) {
      context.addIssue({ code: 'custom', message: 'Journal history moves backward' });
    }
    if (route.history.at(-1) !== route.state) {
      context.addIssue({ code: 'custom', message: 'Journal state must equal final history entry' });
    }
  });

export const journalSchema = z
  .object({
    version: z.literal(1),
    planId: z.string().min(1),
    updatedAt: z.iso.datetime(),
    routes: z.array(journalRouteSchema),
  })
  .strict();

export type JournalV1 = z.infer<typeof journalSchema>;
