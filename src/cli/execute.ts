import { input } from '@inquirer/prompts';
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';

import { ASSETS } from '../config/assets.js';
import { CHAINS } from '../config/chains.js';
import type { AssetId, NormalizedRoute, SupportedChainId } from '../domain/model.js';
import type { JournalV1, PlanV1 } from '../domain/schemas.js';
import { executeBatch } from '../execution/executor.js';
import { buildExactApprovalCalls, simulateCandidate, type SimulationClient } from '../execution/simulator.js';
import { validateTransaction } from '../policy/validate-transaction.js';
import { createLifiRouteProvider } from '../providers/lifi.js';
import { readSigner } from '../security/secret-input.js';
import { saveJournal } from '../storage/journal-store.js';

export interface ExecuteOptions {
  journal: string;
  plan: string;
}

export interface ExecuteCommandDependencies {
  execute(plan: PlanV1, journalPath: string): Promise<JournalV1>;
  load(path: string): Promise<PlanV1>;
}

export async function runExecute(
  options: ExecuteOptions,
  dependencies: ExecuteCommandDependencies,
): Promise<JournalV1> {
  const plan = await dependencies.load(options.plan);
  return dependencies.execute(plan, options.journal);
}

function chainIdOf(assetId: AssetId): SupportedChainId {
  return Number(assetId.slice(0, assetId.indexOf(':'))) as SupportedChainId;
}

function addressOf(assetId: AssetId): Address | 'native' {
  const value = assetId.slice(assetId.indexOf(':') + 1);
  return value === 'native' ? value : getAddress(value);
}

function publicClientFor(chainId: SupportedChainId) {
  const config = CHAINS[chainId];
  return createPublicClient({
    chain: config.chain,
    transport: http(process.env[config.rpcEnv] ?? config.publicRpcUrl),
  });
}

function simulationClient(chainId: SupportedChainId): SimulationClient {
  const client = publicClientFor(chainId);
  return {
    call: (request) => client.call(request),
    estimateGas: (request) => client.estimateGas(request),
    getBalance: (request) => client.getBalance(request),
    getBytecode: (request) => client.getBytecode(request),
    getTransactionCount: (request) => client.getTransactionCount(request),
  };
}

async function preflightLiveRoute(plan: PlanV1, route: NormalizedRoute): Promise<void> {
  const sourceAddress = addressOf(route.fromAsset);
  if (sourceAddress === 'native') {
    await simulateCandidate(simulationClient(route.transaction.chainId), route.transaction);
    return;
  }
  const spender = route.transaction.approvalAddress;
  if (!spender) throw new Error('LI.FI route did not provide an approval spender');
  const client = publicClientFor(route.transaction.chainId);
  const allowance = await client.readContract({
    abi: erc20Abi,
    address: sourceAddress,
    functionName: 'allowance',
    args: [getAddress(plan.wallet), spender],
  });
  const registryAsset = ASSETS.find(
    (asset) => asset.chainId === route.transaction.chainId
      && asset.address !== 'native'
      && asset.address === sourceAddress,
  );
  const approvals = buildExactApprovalCalls({
    amount: route.fromAmount,
    currentAllowance: allowance,
    requiresReset: registryAsset?.transferBehavior === 'legacy-no-return',
    spender,
  });
  for (const data of approvals) {
    await simulateCandidate(simulationClient(route.transaction.chainId), {
      chainId: route.transaction.chainId,
      data,
      from: getAddress(plan.wallet),
      gasLimit: 300_000n,
      to: sourceAddress,
      value: 0n,
    });
  }
  // A downstream call without sufficient allowance is expected to revert. If the exact allowance
  // already exists, it must pass the full simulation before confirmation.
  if (approvals.length === 0) {
    await simulateCandidate(simulationClient(route.transaction.chainId), route.transaction);
  }
}

export async function executeWithLiveProviders(plan: PlanV1, journalPath: string): Promise<JournalV1> {
  const routeProvider = createLifiRouteProvider();
  return executeBatch(plan, {
    confirm: (message) => input({ message }),
    destinationBalance: async (route) => {
      const destinationChainId = chainIdOf(route.toAsset);
      const destinationAddress = addressOf(route.toAsset);
      const client = publicClientFor(destinationChainId);
      return destinationAddress === 'native'
        ? client.getBalance({ address: getAddress(plan.wallet) })
        : client.readContract({
            abi: erc20Abi,
            address: destinationAddress,
            functionName: 'balanceOf',
            args: [getAddress(plan.wallet)],
          });
    },
    now: Date.now,
    persistJournal: (journal) => saveJournal(journalPath, journal),
    readSigner: () => readSigner(getAddress(plan.wallet)),
    refresh: async (planned) => {
      try {
        const fromChainId = chainIdOf(planned.fromAsset as AssetId);
        const toChainId = chainIdOf(planned.toAsset as AssetId);
        const candidates = await routeProvider.getRoutes({
          amount: BigInt(planned.fromAmount),
          fromChainId,
          fromToken: addressOf(planned.fromAsset as AssetId),
          toChainId,
          toToken: addressOf(planned.toAsset as AssetId),
          wallet: getAddress(plan.wallet),
        });
        for (const route of candidates) {
          try {
            validateTransaction({
              approvalAmount: route.fromAmount,
              ...(route.transaction.approvalAddress
                ? { approvalSpender: route.transaction.approvalAddress }
                : {}),
              maxNativeValue: route.transaction.value,
              now: Date.now(),
              receiver: getAddress(plan.wallet),
              route,
              wallet: getAddress(plan.wallet),
            });
            await preflightLiveRoute(plan, route);
            return { valid: true as const, route };
          } catch {
            continue;
          }
        }
        return { valid: false as const, code: 'NO_SAFE_REFRESHED_ROUTE' };
      } catch {
        return { valid: false as const, code: 'REFRESH_FAILED' };
      }
    },
    recheck: async (route) => {
      validateTransaction({
        approvalAmount: route.fromAmount,
        ...(route.transaction.approvalAddress
          ? { approvalSpender: route.transaction.approvalAddress }
          : {}),
        maxNativeValue: route.transaction.value,
        now: Date.now(),
        receiver: getAddress(plan.wallet),
        route,
        wallet: getAddress(plan.wallet),
      });
      await preflightLiveRoute(plan, route);
    },
    submit: async (route, account) => {
      const config = CHAINS[route.transaction.chainId];
      const publicClient = publicClientFor(route.transaction.chainId);
      const walletClient = createWalletClient({
        account,
        chain: config.chain,
        transport: http(process.env[config.rpcEnv] ?? config.publicRpcUrl),
      });
      const sourceAddress = addressOf(route.fromAsset);
      if (sourceAddress !== 'native') {
        const spender = route.transaction.approvalAddress;
        if (!spender) throw new Error('LI.FI route did not provide an approval spender');
        const allowance = await publicClient.readContract({
          abi: erc20Abi,
          address: sourceAddress,
          functionName: 'allowance',
          args: [getAddress(plan.wallet), spender],
        });
        const registryAsset = ASSETS.find(
          (asset) => asset.chainId === route.transaction.chainId
            && asset.address !== 'native'
            && asset.address === sourceAddress,
        );
        const approvals = buildExactApprovalCalls({
          amount: route.fromAmount,
          currentAllowance: allowance,
          requiresReset: registryAsset?.transferBehavior === 'legacy-no-return',
          spender,
        });
        for (const data of approvals) {
          const approvalHash = await walletClient.sendTransaction({
            account,
            chain: config.chain,
            data,
            to: sourceAddress,
            value: 0n,
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (receipt.status !== 'success') throw new Error(`Approval reverted: ${approvalHash}`);
        }
        // The route must now simulate successfully before its own signature is submitted.
        await simulateCandidate(simulationClient(route.transaction.chainId), route.transaction);
      }
      return walletClient.sendTransaction({
        account,
        chain: config.chain,
        data: route.transaction.data,
        gas: route.transaction.gasLimit,
        to: route.transaction.to,
        value: route.transaction.value,
      });
    },
    wait: async (hash: Hex, chainId: SupportedChainId) => {
      const receipt = await publicClientFor(chainId).waitForTransactionReceipt({
        confirmations: CHAINS[chainId].confirmations,
        hash,
      });
      return { status: receipt.status === 'success' ? 'success' as const : 'reverted' as const };
    },
  });
}
