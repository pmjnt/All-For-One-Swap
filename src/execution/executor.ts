import type { Hex } from 'viem';

import type { NormalizedRoute } from '../domain/model.js';
import type { JournalV1, PlanV1 } from '../domain/schemas.js';

type ReadyPlanRoute = Extract<PlanV1['routes'][number], { state: 'READY' }>;

export type RefreshResult =
  | { valid: true; route: NormalizedRoute }
  | { valid: false; code: string };

export interface ExecutionDependencies<Signer = unknown> {
  confirm(message: string): Promise<string>;
  destinationBalance?(route: NormalizedRoute): Promise<bigint>;
  now(): number;
  persistJournal(journal: JournalV1): Promise<void>;
  readSigner(): Promise<Signer>;
  recheck(route: NormalizedRoute): Promise<void>;
  refresh(route: ReadyPlanRoute): Promise<RefreshResult>;
  submit(route: NormalizedRoute, signer: Signer): Promise<Hex>;
  wait(hash: Hex, chainId: NormalizedRoute['transaction']['chainId']): Promise<{ status: 'success' | 'reverted' }>;
}

function assertRefreshMatches(planned: ReadyPlanRoute, refreshed: NormalizedRoute, now: number): void {
  if (
    refreshed.fromAsset.toLowerCase() !== planned.fromAsset.toLowerCase()
    || refreshed.toAsset.toLowerCase() !== planned.toAsset.toLowerCase()
    || refreshed.fromAmount !== BigInt(planned.fromAmount)
  ) throw new Error(`REFRESH_MISMATCH:${planned.routeId}`);
  const plannedTools = [...planned.toolIds].sort().join(',');
  const refreshedTools = [...refreshed.toolIds].sort().join(',');
  if (plannedTools !== refreshedTools) throw new Error(`TOOLS_CHANGED:${planned.routeId}`);
  if (refreshed.quotedToAmount < BigInt(planned.minToAmount)) {
    throw new Error(`MIN_OUTPUT_CHANGED:${planned.routeId}`);
  }
  if (Date.parse(refreshed.expiresAt) <= now) throw new Error(`QUOTE_EXPIRED:${planned.routeId}`);
}

export async function executeBatch<Signer>(
  plan: PlanV1,
  dependencies: ExecutionDependencies<Signer>,
): Promise<JournalV1> {
  const ready = plan.routes.filter((route): route is ReadyPlanRoute => route.state === 'READY');
  if (ready.length === 0) throw new Error('Plan has no executable routes');

  const refreshed: NormalizedRoute[] = [];
  for (const planned of ready) {
    const result = await dependencies.refresh(planned);
    if (!result.valid) throw new Error(result.code);
    assertRefreshMatches(planned, result.route, dependencies.now());
    refreshed.push(result.route);
  }

  const answer = await dependencies.confirm(`Execute ${ready.length} routes? Type EXECUTE to continue`);
  if (answer !== 'EXECUTE') throw new Error('Execution cancelled');
  const signer = await dependencies.readSigner();
  let journal: JournalV1 = {
    version: 1,
    planId: plan.id,
    updatedAt: new Date(dependencies.now()).toISOString(),
    routes: ready.map((route) => ({
      routeId: route.routeId,
      state: 'READY',
      history: ['READY'],
      txHashes: [],
    })),
  };
  await dependencies.persistJournal(journal);

  for (let index = 0; index < refreshed.length; index += 1) {
    const route = refreshed[index];
    if (!route) continue;
    await dependencies.recheck(route);
    if (dependencies.destinationBalance) {
      const destinationBalanceBefore = await dependencies.destinationBalance(route);
      journal = {
        ...journal,
        updatedAt: new Date(dependencies.now()).toISOString(),
        routes: journal.routes.map((entry, routeIndex) => routeIndex === index ? {
          ...entry,
          destinationBalanceBefore: destinationBalanceBefore.toString(),
        } : entry),
      };
      await dependencies.persistJournal(journal);
    }
    const hash = await dependencies.submit(route, signer);
    const current = journal.routes[index];
    if (!current) throw new Error('Journal route is missing');
    journal = {
      ...journal,
      updatedAt: new Date(dependencies.now()).toISOString(),
      routes: journal.routes.map((entry, routeIndex) => routeIndex === index ? {
        ...entry,
        state: 'SUBMITTED' as const,
        history: [...entry.history, 'SUBMITTED' as const],
        txHashes: [...entry.txHashes, hash],
      } : entry),
    };
    await dependencies.persistJournal(journal);

    const receipt = await dependencies.wait(hash, route.transaction.chainId);
    const nextState = receipt.status === 'success' ? 'CONFIRMED' as const : 'FAILED' as const;
    journal = {
      ...journal,
      updatedAt: new Date(dependencies.now()).toISOString(),
      routes: journal.routes.map((entry, routeIndex) => routeIndex === index ? {
        ...entry,
        state: nextState,
        history: [...entry.history, nextState],
      } : entry),
    };
    await dependencies.persistJournal(journal);
    if (nextState === 'FAILED') throw new Error(`Transaction reverted: ${hash}`);

    const fromChainId = Number(route.fromAsset.slice(0, route.fromAsset.indexOf(':')));
    const toChainId = Number(route.toAsset.slice(0, route.toAsset.indexOf(':')));
    const finalState = fromChainId === toChainId ? 'COMPLETED' as const : 'BRIDGE_PENDING' as const;
    journal = {
      ...journal,
      updatedAt: new Date(dependencies.now()).toISOString(),
      routes: journal.routes.map((entry, routeIndex) => routeIndex === index ? {
        ...entry,
        state: finalState,
        history: [...entry.history, finalState],
      } : entry),
    };
    await dependencies.persistJournal(journal);
  }
  return journal;
}
