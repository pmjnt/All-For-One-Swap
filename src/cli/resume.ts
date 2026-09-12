import { access } from 'node:fs/promises';

import { createPublicClient, erc20Abi, getAddress, http, type Hex } from 'viem';

import { CHAINS } from '../config/chains.js';
import type { JournalV1, PersistedRouteState, PlanV1 } from '../domain/schemas.js';
import { monitorBridge } from '../execution/bridge-monitor.js';
import { createLifiStatusProvider } from '../providers/lifi.js';
import { loadJournal, saveJournal } from '../storage/journal-store.js';
import { loadPlan } from '../storage/plan-store.js';
import { executeWithLiveProviders } from './execute.js';

type JournalRoute = JournalV1['routes'][number];
type ReadyPlanRoute = Extract<PlanV1['routes'][number], { state: 'READY' }>;

export interface ResumeDependencies {
  monitor(route: JournalRoute): Promise<'BRIDGE_PENDING' | 'COMPLETED' | 'FAILED'>;
  now(): number;
  persist(journal: JournalV1): Promise<void>;
  receipt(hash: Hex): Promise<{ status: 'success' | 'reverted' } | null>;
  submitReady?(routeId: string): Promise<Hex>;
}

function move(route: JournalRoute, state: PersistedRouteState, hash?: Hex): JournalRoute {
  if (route.state === state && hash === undefined) return route;
  return {
    ...route,
    state,
    history: [...route.history, state],
    txHashes: hash ? [...route.txHashes, hash] : route.txHashes,
  };
}

export async function runResume(
  input: JournalV1,
  dependencies: ResumeDependencies,
): Promise<JournalV1> {
  let journal = structuredClone(input);
  const persistRoute = async (index: number, route: JournalRoute) => {
    journal = {
      ...journal,
      updatedAt: new Date(dependencies.now()).toISOString(),
      routes: journal.routes.map((current, currentIndex) => currentIndex === index ? route : current),
    };
    await dependencies.persist(journal);
  };

  for (let index = 0; index < journal.routes.length; index += 1) {
    let route = journal.routes[index];
    if (!route) continue;
    if (route.state === 'COMPLETED' || route.state === 'FAILED' || route.state === 'SKIPPED') continue;

    if (route.state === 'READY') {
      if (!dependencies.submitReady) continue;
      const hash = await dependencies.submitReady(route.routeId);
      route = move(route, 'SUBMITTED', hash);
      await persistRoute(index, route);
      continue;
    }
    if (route.state === 'SUBMITTED') {
      const hash = route.txHashes.at(-1) as Hex | undefined;
      if (!hash) throw new Error(`Submitted route ${route.routeId} has no transaction hash`);
      const receipt = await dependencies.receipt(hash);
      if (!receipt) continue;
      if (receipt.status === 'reverted') {
        await persistRoute(index, move(route, 'FAILED'));
        continue;
      }
      route = move(route, 'CONFIRMED');
      await persistRoute(index, route);
    }
    if (route.state === 'CONFIRMED') {
      route = move(route, 'BRIDGE_PENDING');
      await persistRoute(index, route);
    }
    if (route.state === 'BRIDGE_PENDING') {
      const result = await dependencies.monitor(route);
      if (result !== 'BRIDGE_PENDING') await persistRoute(index, move(route, result));
    }
  }
  return journal;
}

export interface ResumeOptions {
  journal: string;
  plan: string;
  timeoutSeconds: number;
}

function planRoute(plan: PlanV1, routeId: string): ReadyPlanRoute | undefined {
  return plan.routes.find(
    (route): route is ReadyPlanRoute => route.state === 'READY' && route.routeId === routeId,
  );
}

function chainOf(assetId: string) {
  return Number(assetId.slice(0, assetId.indexOf(':'))) as keyof typeof CHAINS;
}

function tokenOf(assetId: string) {
  return assetId.slice(assetId.indexOf(':') + 1);
}

function mergeJournal(base: JournalV1, overlay: JournalV1, now: number): JournalV1 {
  const byId = new Map(overlay.routes.map((route) => [route.routeId, route]));
  return {
    ...base,
    updatedAt: new Date(now).toISOString(),
    routes: base.routes.map((route) => byId.get(route.routeId) ?? route),
  };
}

export async function resumeFromFiles(options: ResumeOptions): Promise<JournalV1> {
  const plan = await loadPlan(options.plan);
  let journal = await loadJournal(options.journal);
  if (journal.planId !== plan.id) throw new Error('Journal does not belong to the supplied plan');
  const sidecarPath = `${options.journal}.ready`;
  try {
    await access(sidecarPath);
    const sidecar = await loadJournal(sidecarPath);
    if (sidecar.planId !== plan.id) throw new Error('Resume sidecar belongs to another plan');
    journal = mergeJournal(journal, sidecar, Date.now());
    await saveJournal(options.journal, journal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const statusProvider = createLifiStatusProvider();
  const dependencies: ResumeDependencies = {
    now: Date.now,
    persist: (next) => saveJournal(options.journal, next),
    receipt: async (hash) => {
      const entry = journal.routes.find((route) => route.txHashes.includes(hash));
      const planned = entry ? planRoute(plan, entry.routeId) : undefined;
      if (!planned) throw new Error('Cannot resolve source chain for journaled hash');
      try {
        const receipt = await publicClient(chainOf(planned.fromAsset)).getTransactionReceipt({ hash });
        return { status: receipt.status === 'success' ? 'success' as const : 'reverted' as const };
      } catch {
        return null;
      }
    },
    monitor: async (entry) => {
      const planned = planRoute(plan, entry.routeId);
      const sourceTxHash = entry.txHashes.at(-1) as Hex | undefined;
      if (!planned || !sourceTxHash || entry.destinationBalanceBefore === undefined) {
        return 'BRIDGE_PENDING';
      }
      const destinationChainId = chainOf(planned.toAsset);
      const destinationToken = tokenOf(planned.toAsset);
      const destinationClient = publicClient(destinationChainId);
      const bridge = planned.toolIds.find((tool) => tool === 'across' || tool === 'stargateV2');
      if (!bridge) return 'FAILED';
      return monitorBridge({
        balanceBefore: BigInt(entry.destinationBalanceBefore),
        timeoutMs: options.timeoutSeconds * 1_000,
      }, {
        balance: () => destinationToken === 'native'
          ? destinationClient.getBalance({ address: getAddress(plan.wallet) })
          : destinationClient.readContract({
              abi: erc20Abi,
              address: getAddress(destinationToken),
              functionName: 'balanceOf',
              args: [getAddress(plan.wallet)],
            }),
        now: Date.now,
        sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
        status: () => statusProvider.status({
          bridge,
          fromChainId: chainOf(planned.fromAsset),
          sourceTxHash,
          toChainId: destinationChainId,
        }),
        transactionReceipt: async (hash) => {
          try {
            const receipt = await destinationClient.getTransactionReceipt({ hash });
            return { status: receipt.status === 'success' ? 'success' as const : 'reverted' as const };
          } catch {
            return null;
          }
        },
      });
    },
  };

  journal = await runResume(journal, dependencies);
  const readyIds = new Set(journal.routes.filter((route) => route.state === 'READY').map((route) => route.routeId));
  if (readyIds.size > 0) {
    const filteredPlan: PlanV1 = {
      ...plan,
      routes: plan.routes.filter((route) => route.state === 'READY' && readyIds.has(route.routeId)),
    };
    const executed = await executeWithLiveProviders(filteredPlan, sidecarPath);
    journal = mergeJournal(journal, executed, Date.now());
    await saveJournal(options.journal, journal);
    journal = await runResume(journal, dependencies);
  }
  return journal;
}

function publicClient(chainId: keyof typeof CHAINS) {
  const config = CHAINS[chainId];
  return createPublicClient({
    chain: config.chain,
    transport: http(process.env[config.rpcEnv] ?? config.publicRpcUrl),
  });
}
