# All For One Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, non-custodial TypeScript CLI that safely consolidates reviewed EVM assets across six chains into an approved native coin, USDC, or officially supported USDT destination.

**Architecture:** Provider adapters normalize public RPC, Alchemy Portfolio, and LI.FI data into a small domain model. Deterministic local registries, policy validation, profitability checks, and transaction decoding sit between every external response and the local `viem` signer. Planning is read-only; execution refreshes the complete plan, asks for one confirmation and a masked private key, then journals sequential transactions for idempotent resume.

**Tech Stack:** Node.js 22+, TypeScript, `viem`, `zod`, `commander`, `@inquirer/prompts`, `decimal.js`, Vitest, `fast-check`, `tsx`, and `tsup`.

---

**Design reference:** `docs/superpowers/specs/2026-09-11-all-for-one-swap-design.md`

## File map

| Path | Responsibility |
|---|---|
| `src/domain/model.ts` | Branded chain/address/amount types and normalized route models |
| `src/domain/schemas.ts` | Versioned Zod schemas for plans and journals |
| `src/config/chains.ts` | Six-chain metadata, RPC environment names, confirmations, gas buffers |
| `src/config/assets.ts` | Pinned source and destination asset registry |
| `src/config/protocols.ts` | Pinned LI.FI entrypoints, tool identifiers, spenders, and selectors |
| `src/config/env.ts` | Non-secret runtime configuration and API-key presence |
| `src/security/redact.ts` | Recursive redaction for errors and logs |
| `src/security/secret-input.ts` | Masked TTY-only private-key input and address verification |
| `src/providers/rpc.ts` | Verified-chain public clients and RPC failover |
| `src/providers/alchemy.ts` | Alchemy Portfolio normalization with partial-error handling |
| `src/providers/discovery.ts` | Alchemy-first and registry-only RPC discovery orchestration |
| `src/providers/lifi.ts` | LI.FI route, quote, transaction, and status adapter |
| `src/providers/pricing.ts` | Fresh native/token USD observations used for incremental gas accounting |
| `src/policy/decode.ts` | Supported LI.FI calldata decoding |
| `src/policy/validate-route.ts` | Asset/tool/intermediate-step route policy |
| `src/policy/validate-transaction.ts` | Chain, recipient, spender, calldata, value, deadline, and allowance policy |
| `src/planning/economics.ts` | Fixed-point USD and non-duplicated fee accounting |
| `src/planning/planner.ts` | Classification, route selection, gas reserve, skip reasons |
| `src/storage/atomic-json.ts` | Durable temporary-write-plus-rename JSON storage |
| `src/storage/plan-store.ts` | Versioned plan persistence and validation |
| `src/storage/journal-store.ts` | Monotonic execution-state persistence |
| `src/execution/simulator.ts` | `eth_call`, gas estimate, code, balance, and nonce preflight |
| `src/execution/executor.ts` | Exact approval and sequential transaction state machine |
| `src/execution/bridge-monitor.ts` | LI.FI status plus destination evidence polling |
| `src/reporting/console.ts` | Plans, differences, skips, receipts, and partial-discovery warnings |
| `src/cli/plan.ts` | Read-only plan command |
| `src/cli/execute.ts` | Refresh, confirmation, signing, and execution command |
| `src/cli/resume.ts` | On-chain reconciliation and safe continuation command |
| `src/cli.ts` | Commander entrypoint |
| `tests/fixtures/` | Recorded safe and adversarial provider/RPC responses |
| `tests/support/factories.ts` | Typed valid plan, route, refresh, execution, and journal builders |
| `tests/support/route-builders.ts` | Safe decoded transaction context and one-field adversarial mutations |
| `docs/operations.md` | Mainnet safety, registry review, canary, and incident runbook |

## Task 1: Scaffold the typed CLI and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `tsup.config.ts`
- Create: `src/cli.ts`
- Create: `tests/cli/help.test.ts`

- [x] **Step 1: Initialize dependencies**

Run:

```bash
npm init -y
npm install viem zod commander @inquirer/prompts decimal.js
npm install --save-dev typescript @types/node vitest @vitest/coverage-v8 fast-check tsx tsup
```

Expected: `package-lock.json` is created and `npm audit` reports no unresolved critical vulnerability. If a critical advisory exists, stop and select a patched dependency before proceeding.

- [x] **Step 2: Write the failing CLI help test**

```ts
// tests/cli/help.test.ts
import { describe, expect, it } from 'vitest';
import { buildCli } from '../../src/cli.js';

describe('CLI help', () => {
  it('registers plan, execute, and resume', () => {
    const names = buildCli().commands.map((command) => command.name());
    expect(names).toEqual(['plan', 'execute', 'resume']);
  });
});
```

- [x] **Step 3: Run the test and verify the expected failure**

Run: `npx vitest run tests/cli/help.test.ts`

Expected: FAIL because `src/cli.ts` or `buildCli` does not exist.

- [x] **Step 4: Add strict project configuration and the minimal CLI**

Update the generated `package.json` with these module, binary, script, and engine fields while retaining the dependency sections written by npm:

```json
{
  "type": "module",
  "bin": { "all-for-one": "dist/cli.js" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm test && npm run build"
  },
  "engines": { "node": ">=22" }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vitest.config.ts", "tsup.config.ts"]
}
```

```ts
// src/cli.ts
import { Command } from 'commander';

export function buildCli(): Command {
  const cli = new Command().name('all-for-one');
  cli.command('plan');
  cli.command('execute');
  cli.command('resume');
  return cli;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildCli().parseAsync(process.argv);
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', clearMocks: true, restoreMocks: true },
});
```

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
});
```

- [x] **Step 5: Verify and commit**

Run: `npm run check`

Expected: one passing test, successful typecheck, and `dist/cli.js` built.

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts tsup.config.ts src/cli.ts tests/cli/help.test.ts
git commit -m "chore: scaffold typed CLI"
```

## Task 2: Define normalized domain models and versioned schemas

**Files:**
- Create: `src/domain/model.ts`
- Create: `src/domain/schemas.ts`
- Create: `tests/support/factories.ts`
- Create: `tests/domain/schemas.test.ts`

- [x] **Step 1: Write failing schema tests**

```ts
// tests/domain/schemas.test.ts
import { describe, expect, it } from 'vitest';
import { isMonotonicHistory, planSchema } from '../../src/domain/schemas.js';

describe('persisted schemas', () => {
  it('does not expose a private-key field in the strict plan schema', () => {
    expect(planSchema.keyof().safeParse('privateKey').success).toBe(false);
  });

  it('rejects a backward journal transition', () => {
    expect(isMonotonicHistory(['SUBMITTED', 'READY'])).toBe(false);
  });
});
```

- [x] **Step 2: Run the tests and verify failure**

Run: `npx vitest run tests/domain/schemas.test.ts`

Expected: FAIL because the schemas do not exist.

- [x] **Step 3: Define the shared types and strict schemas**

```ts
// src/domain/model.ts
import type { Address, Hex } from 'viem';

export type SupportedChainId = 1 | 10 | 56 | 137 | 8453 | 42161;
export type AssetId = `${SupportedChainId}:${Address | 'native'}`;
export type RouteState =
  | 'SKIPPED' | 'READY' | 'SUBMITTED' | 'CONFIRMED'
  | 'BRIDGE_PENDING' | 'COMPLETED' | 'FAILED';

export interface TxCandidate {
  chainId: SupportedChainId;
  from: Address;
  to: Address;
  data: Hex;
  value: bigint;
  gasLimit: bigint;
  approvalAddress?: Address;
}

export interface NormalizedRoute {
  id: string;
  fromAsset: AssetId;
  toAsset: AssetId;
  fromAmount: bigint;
  quotedToAmount: bigint;
  toolIds: readonly string[];
  intermediateAssets: readonly AssetId[];
  gasUsd: string;
  explicitFeeUsd: string;
  explicitFeeAlreadyDeducted: boolean;
  expiresAt: string;
  transaction: TxCandidate;
}
```

In `schemas.ts`, declare `.strict()` Zod objects for `PlanV1` and `JournalV1`. Export `isMonotonicHistory()` and use it from the journal `superRefine` rule. Map normal states to ranks, allow `FAILED` from any non-terminal state, and never allow transitions out of `COMPLETED` or `FAILED`.

Create `tests/support/factories.ts` with typed builders `validPlan()`, `validRoute()`, and `validJournal()`. Every builder returns a complete schema-valid value and accepts a `Partial` override through explicit field assignment; it must not use `as any`.

- [x] **Step 4: Run schema tests and typecheck**

Run: `npx vitest run tests/domain/schemas.test.ts && npm run typecheck`

Expected: both tests pass and TypeScript reports no errors.

- [x] **Step 5: Commit**

```bash
git add src/domain tests/domain tests/support/factories.ts
git commit -m "feat: define plans routes and journal schemas"
```

## Task 3: Build pinned chain, asset, and protocol registries

**Files:**
- Create: `src/config/chains.ts`
- Create: `src/config/assets.ts`
- Create: `src/config/protocols.ts`
- Create: `scripts/verify-registry.ts`
- Create: `tests/config/registries.test.ts`
- Create: `docs/registry-sources.md`

- [x] **Step 1: Write failing registry invariants**

```ts
// tests/config/registries.test.ts
import { describe, expect, it } from 'vitest';
import { CHAINS } from '../../src/config/chains.js';
import { ASSETS } from '../../src/config/assets.js';
import { PROTOCOLS } from '../../src/config/protocols.js';

describe('pinned registries', () => {
  it('contains exactly the six approved chain IDs', () => {
    expect(Object.keys(CHAINS).map(Number).sort((a, b) => a - b))
      .toEqual([1, 10, 56, 137, 8453, 42161]);
  });

  it('has unique lower-cased chain/address asset identities with evidence', () => {
    const ids = ASSETS.map((asset) => `${asset.chainId}:${asset.address.toLowerCase()}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ASSETS.every((asset) => asset.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('does not trust a protocol without entrypoint, selector, and evidence', () => {
    expect(PROTOCOLS.every((p) => p.entrypoints.length > 0 && p.selectors.length > 0 && p.sourceUrl.startsWith('https://'))).toBe(true);
  });
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/config/registries.test.ts`

Expected: FAIL because registry modules do not exist.

- [x] **Step 3: Add chain registry and registry record types**

```ts
// src/config/chains.ts
import { arbitrum, base, bsc, mainnet, optimism, polygon } from 'viem/chains';

export const CHAINS = {
  1: { chain: mainnet, key: 'ethereum', confirmations: 2, rpcEnv: 'ETHEREUM_RPC_URL', gasBufferBps: 2_000 },
  10: { chain: optimism, key: 'optimism', confirmations: 2, rpcEnv: 'OPTIMISM_RPC_URL', gasBufferBps: 2_000 },
  56: { chain: bsc, key: 'bsc', confirmations: 3, rpcEnv: 'BSC_RPC_URL', gasBufferBps: 2_000 },
  137: { chain: polygon, key: 'polygon', confirmations: 5, rpcEnv: 'POLYGON_RPC_URL', gasBufferBps: 2_000 },
  8453: { chain: base, key: 'base', confirmations: 2, rpcEnv: 'BASE_RPC_URL', gasBufferBps: 2_000 },
  42161: { chain: arbitrum, key: 'arbitrum', confirmations: 2, rpcEnv: 'ARBITRUM_RPC_URL', gasBufferBps: 2_000 },
} as const;
```

Use `getAddress()` while constructing `ASSETS`; store `kind`, `symbol`, `decimals`, `source`, `destination`, `sourceUrl`, `reviewedAt`, and the `$1 / 1%` probe evidence required by the design. Native entries use the internal identity `native`; ERC-20 entries use checksummed addresses.

Start `PROTOCOLS` with LI.FI Diamond `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE` only on networks confirmed by LI.FI deployment records. Permit only LI.FI tool IDs `across`, `stargateV2`, `1inch`, and `odos` for the first release. Pin selectors extracted from the reviewed LI.FI Diamond ABI; do not accept an unknown selector even when the entrypoint address matches.

- [x] **Step 4: Verify registry data against authoritative sources**

`scripts/verify-registry.ts` must assert checksummed addresses, on-chain bytecode through each configured RPC, ERC-20 decimals, duplicate identities, evidence URLs, review dates, and destination coverage. It exits non-zero on any mismatch and never modifies the registry.

Populate and cite exact chain/address entries using:

- Circle: `https://developers.circle.com/stablecoins/usdc-contract-addresses`
- Tether: `https://tether.to/en/supported-protocols/`
- Wrapped-native, WBTC, DAI, LINK, UNI, AAVE: each project's official deployment documentation
- LI.FI deployments: `https://github.com/lifinance/contracts/tree/main/deployments`
- LI.FI entrypoint: `https://docs.li.fi/introduction/lifi-architecture/smart-contract-addresses`

Run: `npx tsx scripts/verify-registry.ts`

Expected: six chains are covered; every enabled contract has bytecode and matching decimals; unsupported chain/token pairs are absent rather than inferred by symbol.

- [x] **Step 5: Run tests and commit**

Run: `npx vitest run tests/config/registries.test.ts && npm run typecheck`

Expected: registry invariant tests pass.

```bash
git add src/config scripts/verify-registry.ts tests/config docs/registry-sources.md
git commit -m "feat: add reviewed chain asset and protocol registries"
```

## Task 4: Add redaction and TTY-only secret input

**Files:**
- Create: `src/security/redact.ts`
- Create: `src/security/secret-input.ts`
- Create: `tests/security/redact.test.ts`
- Create: `tests/security/secret-input.test.ts`

- [x] **Step 1: Write failing security tests**

```ts
// tests/security/redact.test.ts
import { expect, it } from 'vitest';
import { redact } from '../../src/security/redact.js';

it('redacts nested secrets and URL query keys', () => {
  const value = redact({
    privateKey: '0xabc',
    headers: { authorization: 'Bearer secret' },
    url: 'https://example.test/path?apiKey=secret&chain=1',
  });
  expect(JSON.stringify(value)).not.toContain('secret');
  expect(JSON.stringify(value)).not.toContain('0xabc');
  expect(JSON.stringify(value)).toContain('[REDACTED]');
});
```

```ts
// tests/security/secret-input.test.ts
import { expect, it, vi } from 'vitest';
import { readSigner } from '../../src/security/secret-input.js';

it('rejects execution without an interactive TTY', async () => {
  await expect(readSigner('0x0000000000000000000000000000000000000000', {
    isTTY: false,
    prompt: vi.fn(),
  })).rejects.toThrow('interactive TTY');
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/security`

Expected: FAIL because security modules do not exist.

- [x] **Step 3: Implement recursive redaction and signer verification**

```ts
// src/security/secret-input.ts
import { password } from '@inquirer/prompts';
import { getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

interface SecretInputDeps {
  isTTY: boolean;
  prompt: (message: string) => Promise<string>;
}

export async function readSigner(expected: Address, deps: SecretInputDeps = {
  isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  prompt: (message) => password({ message, mask: '*' }),
}) {
  if (!deps.isTTY) throw new Error('Mainnet signing requires an interactive TTY');
  let raw: string | undefined = await deps.prompt('Private key');
  try {
    const secret = raw;
    if (!secret || !/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error('Invalid private key format');
    const account = privateKeyToAccount(secret as Hex);
    if (getAddress(account.address) !== getAddress(expected)) throw new Error('Signer address does not match plan');
    return account;
  } finally {
    raw = undefined;
  }
}
```

`redact()` recursively replaces keys matching `/private.?key|authorization|api.?key|secret|signer/i`, sanitizes `Error` objects, and removes those query parameters from URL strings. It must handle arrays, circular references, and non-plain objects without invoking getters.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run tests/security && npm run typecheck`

Expected: security tests pass and raw secrets are absent from snapshots.

```bash
git add src/security tests/security
git commit -m "feat: enforce masked signing and secret redaction"
```

## Task 5: Implement verified RPC clients and discovery fallback

**Files:**
- Create: `src/providers/rpc.ts`
- Create: `src/providers/discovery.ts`
- Create: `tests/providers/rpc.test.ts`
- Create: `tests/providers/discovery.test.ts`

- [x] **Step 1: Write failing failover and allowlist-only tests**

```ts
// tests/providers/discovery.test.ts
import { expect, it, vi } from 'vitest';
import { discoverAssets } from '../../src/providers/discovery.js';

it('queries only registry assets when no indexer key exists', async () => {
  const rpc = { balances: vi.fn().mockResolvedValue([]) };
  const result = await discoverAssets('0x0000000000000000000000000000000000000001', {
    alchemyApiKey: undefined,
    rpc,
    registryAssetIds: ['1:native', '1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
  });
  expect(result.mode).toBe('ALLOWLIST_ONLY');
  expect(rpc.balances).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining(['1:native']));
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/providers/rpc.test.ts tests/providers/discovery.test.ts`

Expected: FAIL because RPC and discovery modules do not exist.

- [x] **Step 3: Implement chain-verified clients and multicall balances**

`createVerifiedPublicClient(chainId)` must try the configured private RPC first and the chain's reviewed public RPC fallback second. After connection, call `eth_chainId`; discard any transport returning a different chain. Use `multicall({ allowFailure: true })` for ERC-20 `balanceOf`, preserve individual failures as warnings, and read native balance separately.

```ts
export interface DiscoveryResult {
  mode: 'INDEXED' | 'ALLOWLIST_ONLY';
  balances: readonly { assetId: string; amount: bigint }[];
  warnings: readonly { chainId: number; code: string; message: string }[];
  completeChains: readonly number[];
}
```

Never convert a failed balance call into amount zero.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run tests/providers/rpc.test.ts tests/providers/discovery.test.ts && npm run typecheck`

Expected: wrong-chain failover is rejected; partial multicall failures remain warnings; fallback mode queries only registry entries.

```bash
git add src/providers/rpc.ts src/providers/discovery.ts tests/providers
git commit -m "feat: add verified RPC asset discovery"
```

## Task 6: Add Alchemy indexed discovery with partial failure semantics

**Files:**
- Create: `src/providers/alchemy.ts`
- Create: `tests/providers/alchemy.test.ts`
- Create: `tests/fixtures/alchemy/partial-success.json`

- [x] **Step 1: Record a sanitized fixture and write the failing test**

```ts
// tests/providers/alchemy.test.ts
import fixture from '../fixtures/alchemy/partial-success.json';
import { expect, it } from 'vitest';
import { normalizeAlchemyBalances } from '../../src/providers/alchemy.js';

it('keeps successful balances and exposes partial network errors', () => {
  const result = normalizeAlchemyBalances(fixture);
  expect(result.balances.length).toBeGreaterThan(0);
  expect(result.failedNetworks).toEqual(['bnb-mainnet']);
});
```

The fixture contains one native balance, one allowlisted ERC-20, one unknown ERC-20, and `error.partialErrors` for BNB Smart Chain. Replace wallet addresses and request IDs with deterministic test values before committing.

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/providers/alchemy.test.ts`

Expected: FAIL because the normalizer does not exist.

- [x] **Step 3: Implement strict response parsing and discovery orchestration**

Use a `.passthrough()` Zod schema only at the external response boundary. Require network, wallet address, token address/null, and hex balance for every normalized entry. Unknown token contracts remain report-only. Convert `partialErrors` into per-chain fallback requests and keep the final report partial when both Alchemy and RPC fail.

Call endpoint:

```text
POST https://api.g.alchemy.com/data/v1/{ALCHEMY_API_KEY}/assets/tokens/balances/by-address
```

Do not include the endpoint URL containing the API key in thrown errors or debug data.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run tests/providers/alchemy.test.ts tests/providers/discovery.test.ts && npm run typecheck`

Expected: indexed mode preserves unknown assets for reporting and retries partial chains through RPC.

```bash
git add src/providers/alchemy.ts src/providers/discovery.ts tests/providers tests/fixtures/alchemy
git commit -m "feat: add indexed multichain discovery"
```

## Task 7: Normalize LI.FI routes without granting signing authority

**Files:**
- Create: `src/providers/lifi.ts`
- Create: `src/providers/pricing.ts`
- Create: `tests/providers/lifi.test.ts`
- Create: `tests/providers/pricing.test.ts`
- Create: `tests/fixtures/lifi/routes-safe.json`
- Create: `tests/fixtures/lifi/routes-unknown-tool.json`

- [x] **Step 1: Write failing adapter tests**

```ts
// tests/providers/lifi.test.ts
import safe from '../fixtures/lifi/routes-safe.json';
import { expect, it } from 'vitest';
import { normalizeLifiRoutes } from '../../src/providers/lifi.js';

it('normalizes amounts as bigint and records fee deduction', () => {
  const [route] = normalizeLifiRoutes(safe);
  expect(typeof route?.fromAmount).toBe('bigint');
  expect(typeof route?.quotedToAmount).toBe('bigint');
  expect(route?.explicitFeeAlreadyDeducted).toBe(true);
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/providers/lifi.test.ts`

Expected: FAIL because the LI.FI adapter does not exist.

- [x] **Step 3: Implement request and normalization**

POST `/v1/advanced/routes` with exact chain IDs, token addresses, amount, sender/receiver, and:

```ts
const routeOptions = {
  bridges: { allow: ['across', 'stargateV2'] },
  exchanges: { allow: ['1inch', 'odos'] },
  order: 'RECOMMENDED',
  slippage: 0.01,
};
```

Use `/v1/advanced/stepTransaction` for fresh transaction data and `/v1/status` for bridge status. Parse all integer fields from decimal strings into `bigint`; reject floats, negative values, missing expiry, inconsistent chain/token/receiver, or any tool not returned as a stable identifier. The adapter exposes data only and imports no wallet client or account type.

`pricing.ts` obtains timestamped USD observations from LI.FI token metadata for the native gas asset and destination asset. Reject absent, non-positive, or stale observations. Convert locally estimated approval/reset gas to USD as `gasUnits * maxFeePerGas * nativeUsd / 10**nativeDecimals`; keep all arithmetic in `bigint` plus `Decimal`, never JavaScript `number`.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run tests/providers/lifi.test.ts tests/providers/pricing.test.ts && npm run typecheck`

Expected: safe fixture normalizes; malformed integer and missing-expiry fixtures fail closed.

```bash
git add src/providers/lifi.ts src/providers/pricing.ts tests/providers/lifi.test.ts tests/providers/pricing.test.ts tests/fixtures/lifi
git commit -m "feat: add untrusted LI.FI route adapter"
```

## Task 8: Enforce route and transaction policy with adversarial fixtures

**Files:**
- Create: `src/policy/decode.ts`
- Create: `src/policy/validate-route.ts`
- Create: `src/policy/validate-transaction.ts`
- Create: `tests/support/route-builders.ts`
- Create: `tests/policy/validate-route.test.ts`
- Create: `tests/policy/validate-transaction.test.ts`
- Create: `tests/fixtures/adversarial/`

- [x] **Step 1: Write the adversarial rejection table**

```ts
// tests/policy/validate-transaction.test.ts
import { describe, expect, it } from 'vitest';
import { validateTransaction } from '../../src/policy/validate-transaction.js';
import { makeSafeContext, mutate } from '../support/route-builders.js';

describe.each([
  ['wrong recipient', mutate({ receiver: '0x0000000000000000000000000000000000000002' })],
  ['wrong chain', mutate({ chainId: 56 })],
  ['unknown entrypoint', mutate({ to: '0x0000000000000000000000000000000000000003' })],
  ['unlimited approval', mutate({ approvalAmount: (1n << 256n) - 1n })],
  ['unknown selector', mutate({ data: '0xdeadbeef' })],
  ['excessive native value', mutate({ value: 10n ** 20n })],
])('%s', (_name, applyMutation) => {
  it('rejects before signing', () => {
    expect(() => validateTransaction(applyMutation(makeSafeContext()))).toThrow();
  });
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/policy`

Expected: FAIL because policy modules and route builders do not exist.

- [x] **Step 3: Implement deterministic policy checks**

Decode the first four calldata bytes and dispatch only to ABIs pinned beside each allowed selector. Return a normalized decoded intent containing receiver, source token, source amount, destination chain, destination token/minimum amount, bridge tool, swap tools, deadline, and native value purpose. Reject unsupported overloads and undecoded trailing route data.

`validateRoute()` checks exact chain/address asset identities, allowed tool IDs, every intermediate asset, expiry, maximum 1% slippage, and price impact. `validateTransaction()` checks sender, receiver, chain, entrypoint, selector, spender, exact approval, input maximum, minimum output, deadline, native value, and decoded intent equality with the normalized route.

Use discriminated error codes such as `UNKNOWN_ASSET`, `UNKNOWN_TOOL`, `UNKNOWN_ENTRYPOINT`, `UNKNOWN_SELECTOR`, `RECIPIENT_MISMATCH`, `CHAIN_MISMATCH`, `UNLIMITED_APPROVAL`, and `VALUE_EXCEEDS_PLAN`; reporter output depends on these stable codes.

- [x] **Step 4: Add all required malicious fixtures**

Fixtures must cover wrong recipient, wrong chain ID, unknown router, unknown bridge, unknown intermediate asset, symbol spoofing, unlimited approval, altered amount, altered calldata, excessive native value, expired quote, and opaque call shape. Each fixture has one test asserting its exact rejection code.

- [x] **Step 5: Run tests and commit**

Run: `npx vitest run tests/policy && npm run typecheck`

Expected: every malicious fixture is rejected and the reviewed safe fixture passes.

```bash
git add src/policy tests/policy tests/fixtures/adversarial tests/support/route-builders.ts
git commit -m "feat: reject untrusted routes and calldata"
```

## Task 9: Calculate profitability and build immutable plans

**Files:**
- Create: `src/planning/economics.ts`
- Create: `src/planning/planner.ts`
- Create: `tests/planning/economics.test.ts`
- Create: `tests/planning/planner.test.ts`

- [x] **Step 1: Write failing fee and boundary tests**

```ts
// tests/planning/economics.test.ts
import { expect, it } from 'vitest';
import { netOutputUsd } from '../../src/planning/economics.js';

it('does not subtract a fee already reflected in destination output', () => {
  expect(netOutputUsd({ outputUsd: '0.80', gasUsd: '0.10', explicitFeeUsd: '0.05', feeDeducted: true })).toBe('0.70');
});

it('subtracts a non-deducted explicit fee once', () => {
  expect(netOutputUsd({ outputUsd: '0.80', gasUsd: '0.10', explicitFeeUsd: '0.05', feeDeducted: false })).toBe('0.65');
});
```

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/planning`

Expected: FAIL because planning modules do not exist.

- [x] **Step 3: Implement exact decimal economics and route ranking**

```ts
// src/planning/economics.ts
import Decimal from 'decimal.js';

export function netOutputUsd(input: {
  outputUsd: string;
  gasUsd: string;
  explicitFeeUsd: string;
  feeDeducted: boolean;
}): string {
  const result = new Decimal(input.outputUsd)
    .minus(input.gasUsd)
    .minus(input.feeDeducted ? 0 : input.explicitFeeUsd);
  return result.toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed();
}
```

`planner.ts` assigns one stable result per holding: `READY` with best route or `SKIPPED` with `UNKNOWN_ASSET`, `UNSUPPORTED_BEHAVIOR`, `MISSING_PRICE`, `INSUFFICIENT_GAS`, `NO_ALLOWED_ROUTE`, `PRICE_IMPACT`, or `BELOW_MIN_NET_USD`. Rank only routes passing policy. For native inputs, subtract estimated maximum gas plus the chain buffer from spendable balance and reject a zero/negative remainder.

- [x] **Step 4: Add property tests**

Use `fast-check` integer cents to prove that increasing gas never increases net output, deducted fees are never counted twice, a selected route has maximal net output among valid candidates, and native spend plus reserve never exceeds balance.

- [x] **Step 5: Run tests and commit**

Run: `npx vitest run tests/planning && npm run typecheck`

Expected: example and property tests pass.

```bash
git add src/planning tests/planning
git commit -m "feat: plan economically viable consolidation routes"
```

## Task 10: Persist plans and journals atomically

**Files:**
- Create: `src/storage/atomic-json.ts`
- Create: `src/storage/plan-store.ts`
- Create: `src/storage/journal-store.ts`
- Create: `tests/storage/atomic-json.test.ts`
- Create: `tests/storage/journal-store.test.ts`

- [x] **Step 1: Write failing crash and monotonicity tests**

```ts
// tests/storage/journal-store.test.ts
import { expect, it } from 'vitest';
import { transitionRoute } from '../../src/storage/journal-store.js';

it('does not transition backward or out of a terminal state', () => {
  expect(() => transitionRoute('SUBMITTED', 'READY')).toThrow('backward');
  expect(() => transitionRoute('COMPLETED', 'SUBMITTED')).toThrow('terminal');
});
```

Test `writeJsonAtomic()` with an injected rename failure and assert the previous destination remains parseable and unchanged.

- [x] **Step 2: Run and verify failure**

Run: `npx vitest run tests/storage`

Expected: FAIL because storage modules do not exist.

- [x] **Step 3: Implement durable public persistence**

Write JSON to a sibling path named `.<basename>.<pid>.<random>.tmp` using mode `0o600`, call file-handle `sync()`, close, rename to destination, then sync the parent directory on platforms that support it. Clean only the exact temporary path in `finally`. Run the object through `planSchema` or `journalSchema` and `redact()` before serialization.

Plan IDs are SHA-256 over canonical JSON excluding volatile quote timestamps. Journals reference the plan ID and store transaction hashes before receipt polling. `transitionRoute()` enforces the schema's monotonic state graph.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run tests/storage && npm run typecheck`

Expected: atomic-write, permission, schema, and state-transition tests pass.

```bash
git add src/storage tests/storage
git commit -m "feat: persist resumable plans and journals safely"
```

## Task 11: Build the read-only plan command

**Files:**
- Create: `src/config/env.ts`
- Create: `src/reporting/console.ts`
- Create: `src/cli/plan.ts`
- Modify: `src/cli.ts`
- Modify: `tests/support/factories.ts`
- Create: `tests/cli/plan.test.ts`

- [ ] **Step 1: Write the failing command test**

```ts
// tests/cli/plan.test.ts
import { expect, it, vi } from 'vitest';
import { runPlan } from '../../src/cli/plan.js';
import { makePlanDeps } from '../support/factories.js';

it('creates a secret-free plan and reports incomplete discovery', async () => {
  const save = vi.fn();
  const result = await runPlan({
    wallet: '0x0000000000000000000000000000000000000001',
    targetChain: 'base', targetToken: 'USDC', minNetUsd: '0.25',
  }, makePlanDeps({ partialChain: 56, save }));
  expect(save).toHaveBeenCalledOnce();
  expect(JSON.stringify(result)).not.toMatch(/private.?key/i);
  expect(result.warnings).toContainEqual(expect.objectContaining({ chainId: 56 }));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/cli/plan.test.ts`

Expected: FAIL because `runPlan` does not exist.

- [ ] **Step 3: Implement the command orchestration**

Register:

```text
all-for-one plan --wallet <address> --target-chain <key> --target-token <symbol> --min-net-usd <decimal> --out <path>
```

Validate the destination strictly from `ASSETS`; reject arbitrary addresses and contracts. `runPlan()` calls discovery, classifies unknown tokens without routing them, obtains approved candidates, runs policy and economics, saves the plan, and prints `INDEXED`, `ALLOWLIST_ONLY`, or `PARTIAL` discovery status. Default `--out` is `plan.json`; default `--min-net-usd` is `0.25`.

`env.ts` reads API/RPC variables by an explicit name list. It returns only presence booleans to reporters and never returns `process.env` wholesale.

Extend `tests/support/factories.ts` with `makePlanDeps()`, a complete in-memory dependency object whose discovery, route, policy, reporter, and store functions are typed against `runPlan`'s exported dependency interface.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/cli/plan.test.ts tests/planning tests/providers && npm run typecheck`

Expected: read-only planning passes with indexed and fallback fixtures and never requests a signer.

```bash
git add src/config/env.ts src/reporting src/cli src/cli.ts tests/cli/plan.test.ts tests/support/factories.ts
git commit -m "feat: add read-only consolidation planning"
```

## Task 12: Add full-batch refresh, simulation, and exact approvals

**Files:**
- Create: `src/execution/simulator.ts`
- Create: `src/execution/executor.ts`
- Create: `src/cli/execute.ts`
- Modify: `src/cli.ts`
- Modify: `tests/support/factories.ts`
- Create: `tests/execution/simulator.test.ts`
- Create: `tests/execution/executor.test.ts`
- Create: `tests/cli/execute.test.ts`

- [ ] **Step 1: Write failing safety-gate tests**

```ts
// tests/execution/executor.test.ts
import { expect, it, vi } from 'vitest';
import { executeBatch } from '../../src/execution/executor.js';
import { invalidRefresh, makeExecutionDeps, planWithTwoRoutes, validRefresh } from '../support/factories.js';

it('refreshes every route before prompting and stops on one invalid route', async () => {
  const prompt = vi.fn();
  const sign = vi.fn();
  await expect(executeBatch(planWithTwoRoutes(), makeExecutionDeps({
    refreshResults: [validRefresh(), invalidRefresh('QUOTE_EXPIRED')], prompt, sign,
  }))).rejects.toThrow('QUOTE_EXPIRED');
  expect(prompt).not.toHaveBeenCalled();
  expect(sign).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/execution tests/cli/execute.test.ts`

Expected: FAIL because execution modules do not exist.

- [ ] **Step 3: Implement preflight and exact approval construction**

For every route, refresh balance, nonce, gas, native USD price, LI.FI quote, and transaction data; rerun route and transaction policy; verify bytecode using `getCode`; simulate from the planned signer with `call`; estimate gas; and recalculate profitability. Abort the entire batch before confirmation if any route is invalid or materially changed.

Construct ERC-20 approval calls with `encodeFunctionData()` and the standard `approve(address,uint256)` ABI. Approval amount equals refreshed input amount. Reject `maxUint256`. When non-zero allowance cannot be changed directly, add `approve(spender, 0)` followed by the exact approval and include both gas estimates before profitability confirmation.

- [ ] **Step 4: Implement one confirmation and sequential execution**

`execute` requires an interactive TTY, prints the refreshed diff and maximum/minimum values, asks exactly `Execute N routes? Type EXECUTE to continue`, then calls `readSigner()`. Before each signature, rerun simulation and compare nonce/balance. Submit, atomically journal the hash, wait for configured confirmations, and stop the whole batch on revert or invariant violation. Handle `SIGINT` by stopping before the next signature and flushing the journal.

Extend `tests/support/factories.ts` with the four helpers imported by the execution test. They must return schema-valid values and fully typed injected dependencies; `invalidRefresh(code)` changes only the validity result so the test proves the all-route gate.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/execution tests/cli/execute.test.ts tests/security tests/policy && npm run typecheck`

Expected: no signer call occurs before all-route refresh and confirmation; exact approvals pass; unlimited approvals, failed simulation, changed nonce, and changed balances stop execution.

```bash
git add src/execution src/cli/execute.ts src/cli.ts tests/execution tests/cli/execute.test.ts tests/support/factories.ts
git commit -m "feat: safely execute refreshed route batches"
```

## Task 13: Track bridges and resume without duplicate submissions

**Files:**
- Create: `src/execution/bridge-monitor.ts`
- Create: `src/cli/resume.ts`
- Modify: `src/cli.ts`
- Modify: `tests/support/factories.ts`
- Create: `tests/execution/bridge-monitor.test.ts`
- Create: `tests/cli/resume.test.ts`

- [ ] **Step 1: Write failing pending and duplicate-prevention tests**

```ts
// tests/cli/resume.test.ts
import { expect, it, vi } from 'vitest';
import { runResume } from '../../src/cli/resume.js';
import { journalAtBridgePending, journalAtSubmitted, makeResumeDeps } from '../support/factories.js';

it('does not resubmit a journaled transaction whose receipt is unresolved', async () => {
  const submit = vi.fn();
  const result = await runResume(journalAtSubmitted(), makeResumeDeps({ receipt: null, submit }));
  expect(result.state).toBe('SUBMITTED');
  expect(submit).not.toHaveBeenCalled();
});

it('keeps bridge timeout pending', async () => {
  const result = await runResume(journalAtBridgePending(), makeResumeDeps({ bridgeStatus: 'TIMEOUT' }));
  expect(result.state).toBe('BRIDGE_PENDING');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/execution/bridge-monitor.test.ts tests/cli/resume.test.ts`

Expected: FAIL because bridge monitor and resume do not exist.

- [ ] **Step 3: Implement evidence-based reconciliation**

Poll LI.FI status with bounded exponential backoff of 5, 10, 20, 30 seconds and a configurable observation timeout. Confirm source submission through RPC receipt. Confirm destination completion through destination transaction receipt plus the planned wallet's destination balance delta; provider `DONE` status alone is insufficient. Map timeout to `BRIDGE_PENDING`, explicit on-chain revert to `FAILED`, and verified delivery to `COMPLETED`.

Record the destination balance snapshot for each route immediately before its source submission. Reconciliation compares against that route-specific snapshot so sequential routes into the same destination asset cannot claim one another's balance increase.

Resume rules:

```ts
const MAY_SUBMIT = new Set(['READY']);
const NEVER_RESUBMIT = new Set(['SUBMITTED', 'CONFIRMED', 'BRIDGE_PENDING', 'COMPLETED', 'FAILED']);
```

Reconcile all journal entries before asking for a signer. Only a `READY` step may be signed, and it must pass the same full refresh and confirmation path as `execute`.

Extend `tests/support/factories.ts` with the three resume helpers imported above, including route-specific pre-submission destination balances.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/execution/bridge-monitor.test.ts tests/cli/resume.test.ts tests/storage && npm run typecheck`

Expected: interrupted, pending, delivered, and reverted fixtures transition monotonically with zero duplicate submissions.

```bash
git add src/execution/bridge-monitor.ts src/cli/resume.ts src/cli.ts tests/execution/bridge-monitor.test.ts tests/cli/resume.test.ts tests/support/factories.ts
git commit -m "feat: monitor bridges and resume idempotently"
```

## Task 14: Complete reporting, logs, and operator documentation

**Files:**
- Modify: `src/reporting/console.ts`
- Create: `tests/reporting/console.test.ts`
- Create: `tests/security/log-leak.test.ts`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/operations.md`

- [ ] **Step 1: Write failing output and leak tests**

```ts
// tests/security/log-leak.test.ts
import { expect, it } from 'vitest';
import { renderFailure } from '../../src/reporting/console.js';

it('never renders secrets from nested provider errors', () => {
  const output = renderFailure({
    message: 'request failed',
    privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    config: { headers: { authorization: 'Bearer api-secret' } },
  });
  expect(output).not.toContain('aaaaaaaa');
  expect(output).not.toContain('api-secret');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/reporting tests/security/log-leak.test.ts`

Expected: FAIL until all reporter paths call `redact()`.

- [ ] **Step 3: Finish stable human and JSON reporting**

Render one row per holding with chain, exact contract abbreviation, balance, USD observation time, classification, route tools, gas, fees, net output, minimum receive, and stable reason code. Print discovery status and every incomplete chain above the table. Execution output includes explorer-linked hashes and the final state; pending routes include the exact `resume` command. `--json` emits the strict schema and writes diagnostics to stderr.

- [ ] **Step 4: Document safe operation**

`README.md` includes prerequisites, install/build, the three commands, provider fallback behavior, supported assets/chains, the meaning of “optimal,” and the non-guarantee against protocol compromise. `.env.example` lists only empty API/RPC variable names.

`docs/operations.md` includes registry evidence review, ABI/selector review, `$1 / 1%` liquidity probe, read-only mainnet smoke test, low-value dedicated canary wallet, bridge-pending handling, RPC incident handling, log-leak response, and a prohibition on production keys in CI.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/reporting tests/security && npm run typecheck`

Expected: snapshots show complete classifications and no secret fixture appears in output.

```bash
git add src/reporting tests/reporting tests/security .env.example README.md docs/operations.md
git commit -m "docs: add safe operation and complete reporting"
```

## Task 15: Run acceptance verification and prepare a canary release

**Files:**
- Create: `tests/acceptance/plan-fallback.test.ts`
- Create: `tests/acceptance/adversarial.test.ts`
- Create: `tests/acceptance/resume.test.ts`
- Create: `scripts/mainnet-smoke.ts`
- Modify: `package.json`

- [ ] **Step 1: Add end-to-end dependency-injected acceptance tests**

Create tests that execute the real CLI orchestration with fixture transports and temporary storage:

1. Alchemy absent → six-chain allowlist-only plan with visible completeness warning.
2. Unknown token present → reported `UNKNOWN_ASSET`, no route request.
3. Safe same-chain swap → one exact approval, one swap, `COMPLETED`.
4. Safe bridge → source receipt, `BRIDGE_PENDING`, destination evidence, `COMPLETED`.
5. Every adversarial fixture → no confirmation and no signer invocation.
6. Process interruption after journaling hash → resume performs no duplicate submission.
7. Native input → final source balance remains at or above calculated reserve.

- [ ] **Step 2: Run the acceptance tests**

Run: `npx vitest run tests/acceptance`

Expected: all seven scenarios pass with zero real network calls.

- [ ] **Step 3: Add and run the read-only mainnet smoke script**

`scripts/mainnet-smoke.ts` accepts only `--wallet`, invokes planning with execution dependencies absent, and exits non-zero for wrong chain IDs, malformed registry data, or unreported partial discovery. It contains no signer imports.

Add script:

```json
{
  "scripts": {
    "smoke:mainnet": "tsx scripts/mainnet-smoke.ts"
  }
}
```

Run with a public address that has no relationship to the development team:

```bash
npm run smoke:mainnet -- --wallet 0x000000000000000000000000000000000000dEaD
```

Expected: a read-only plan or explicit partial report; zero signing prompts and zero transaction hashes.

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
npm audit --audit-level=critical
npm run check
npx vitest run --coverage
npx tsx scripts/verify-registry.ts
git diff --check
git status --short
```

Expected: no critical audit finding; typecheck, all tests, build, and registry verification pass; coverage includes every policy rejection branch; `git diff --check` is clean. `git status` contains only intended acceptance changes before commit.

- [ ] **Step 5: Commit the verified MVP**

```bash
git add package.json package-lock.json scripts/mainnet-smoke.ts tests/acceptance
git commit -m "test: verify all-for-one swap MVP"
```

- [ ] **Step 6: Perform the manual release gate without automating funds**

Follow `docs/operations.md` with a dedicated low-value wallet. First run `plan` on all six chains. Execute one same-chain route and one cross-chain route using the smallest provider-supported amounts that remain above the profitability threshold. Record plan ID, registry commit, route tools, transaction hashes, actual output, and any pending duration in a local release checklist that contains no secret. A human must explicitly approve promotion after comparing actual output with `minAmountOut`; the CLI must not schedule or repeat canary transactions.
