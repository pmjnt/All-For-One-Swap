# Interactive CLI Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual, no-subcommand terminal wizard that creates a reviewed plan and optionally delegates to the existing safe execution pipeline.

**Architecture:** A pure wizard orchestrator owns localized prompts and registry-derived choices behind an injected prompt port. A live adapter connects it to Inquirer, the existing planner, and the existing executor; a small CLI dispatcher invokes it only when no arguments are supplied. Explicit Commander subcommands and all transaction safety gates remain unchanged.

**Tech Stack:** Node.js 22+, TypeScript, Commander, `@inquirer/prompts`, `viem`, `decimal.js`, Vitest, tsup.

---

**Design reference:** `docs/superpowers/specs/2026-09-13-interactive-cli-wizard-design.md`

## File map

| Path | Responsibility |
|---|---|
| `src/cli/live-plan.ts` | Assemble live RPC, Alchemy, LI.FI, price, reporting, and storage dependencies once for both entry paths |
| `src/cli/wizard.ts` | Bilingual prompt catalog, validation, registry choices, and testable `plan → optional execute` orchestration |
| `src/cli.ts` | Commander definitions plus no-argument dispatcher |
| `tests/cli/wizard.test.ts` | Wizard choice, validation, stop, execute, and localization behavior |
| `tests/cli/entrypoint.test.ts` | No-argument versus explicit-command dispatch behavior |
| `tests/execution/executor.test.ts` | Regression proof that failed pre-broadcast recheck never reaches submit |
| `README.md` | English interactive quick start and argument-based automation reference |
| `tutorial.html` | Vietnamese interactive usage flow and simulation explanation |

### Task 1: Build the pure wizard orchestrator

**Files:**
- Create: `src/cli/wizard.ts`
- Create: `tests/cli/wizard.test.ts`

- [ ] **Step 1: Write failing registry-choice and validation tests**

Create `tests/cli/wizard.test.ts` with tests that import `destinationChoices`, `validateWallet`,
`validateMinimum`, and `validatePath` from `src/cli/wizard.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  destinationChoices,
  validateMinimum,
  validatePath,
  validateWallet,
} from '../../src/cli/wizard.js';

describe('wizard fields', () => {
  it('derives destination tokens from the registry', () => {
    expect(destinationChoices('bsc').map(({ value }) => value)).toEqual(['BNB']);
    expect(destinationChoices('base').map(({ value }) => value)).toEqual(['ETH', 'USDC']);
  });

  it('validates wallet, minimum, and paths without accepting secrets', () => {
    expect(validateWallet('0x0000000000000000000000000000000000000001')).toBe(true);
    expect(validateWallet('private-key')).toBe(false);
    expect(validateMinimum('0.25')).toBe(true);
    expect(validateMinimum('-1')).toBe(false);
    expect(validateMinimum('Infinity')).toBe(false);
    expect(validatePath(' plan.json ')).toBe(true);
    expect(validatePath('   ')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run tests/cli/wizard.test.ts`

Expected: FAIL because `src/cli/wizard.ts` does not exist.

- [ ] **Step 3: Define wizard ports, localized messages, and registry choices**

Create `src/cli/wizard.ts` with these public contracts:

```ts
export type WizardLanguage = 'en' | 'vi';

export interface WizardChoice<Value extends string> {
  name: string;
  value: Value;
}

export interface WizardPrompts {
  confirm(options: { default: boolean; message: string }): Promise<boolean>;
  input(options: {
    default?: string;
    message: string;
    validate?: (value: string) => boolean | string;
  }): Promise<string>;
  select<Value extends string>(options: {
    choices: readonly WizardChoice<Value>[];
    message: string;
  }): Promise<Value>;
}

export interface WizardDependencies {
  execute(plan: PlanV1, journalPath: string): Promise<unknown>;
  plan(options: PlanOptions): Promise<PlanReport>;
  prompts: WizardPrompts;
  write(message: string): void;
}

export type WizardResult = 'EXECUTED' | 'NO_ROUTES' | 'PLAN_SAVED';
```

Export these deterministic helpers:

```ts
export function validateWallet(value: string): boolean {
  try { getAddress(value.trim()); return true; } catch { return false; }
}

export function validateMinimum(value: string): boolean {
  const amount = new Decimal(value.trim());
  return amount.isFinite() && !amount.isNegative();
}

export function validatePath(value: string): boolean {
  return value.trim().length > 0;
}

export function chainChoices(): WizardChoice<string>[] {
  return Object.values(CHAINS).map(({ chain, key }) => ({ name: chain.name, value: key }));
}

export function destinationChoices(chainKey: string): WizardChoice<string>[] {
  const chainId = Number(Object.entries(CHAINS).find(([, chain]) => chain.key === chainKey)?.[0]);
  return ASSETS.filter((asset) => asset.chainId === chainId && asset.destination)
    .map((asset) => ({ name: asset.symbol, value: asset.symbol }));
}
```

Define the localized record explicitly. English and Vietnamese use the same prompt order and
defaults:

```ts
interface WizardMessages {
  chain: string;
  executeNow: string;
  invalidMinimum: string;
  invalidPath: string;
  invalidWallet: string;
  journalPath: string;
  minimum: string;
  noRoutes: string;
  planPath: string;
  planSaved: string;
  token: string;
  wallet: string;
}

const messages: Record<WizardLanguage, WizardMessages> = {
  en: {
    chain: 'Target chain', executeNow: 'Execute this plan now?',
    invalidMinimum: 'Enter a non-negative decimal amount.',
    invalidPath: 'Path cannot be blank.', invalidWallet: 'Enter a valid EVM wallet address.',
    journalPath: 'Journal file', minimum: 'Minimum net USD',
    noRoutes: 'No executable routes were found. The plan was saved for review.',
    planPath: 'Plan file', planSaved: 'Plan saved to {path}. Review it before execution.',
    token: 'Target token', wallet: 'Wallet address (public address, not private key)',
  },
  vi: {
    chain: 'Chain đích', executeNow: 'Thực thi kế hoạch này ngay?',
    invalidMinimum: 'Nhập số thập phân không âm.', invalidPath: 'Đường dẫn không được để trống.',
    invalidWallet: 'Nhập địa chỉ ví EVM hợp lệ.', journalPath: 'File journal',
    minimum: 'Giá trị net tối thiểu (USD)',
    noRoutes: 'Không tìm thấy route có thể thực thi. Plan đã được lưu để kiểm tra.',
    planPath: 'File plan', planSaved: 'Đã lưu plan tại {path}. Hãy kiểm tra trước khi thực thi.',
    token: 'Token đích', wallet: 'Địa chỉ ví công khai (không phải private key)',
  },
};
```

- [ ] **Step 4: Run the field tests and verify they pass**

Run: `npx vitest run tests/cli/wizard.test.ts`

Expected: the two field tests pass.

- [ ] **Step 5: Write failing orchestration tests**

Extend `tests/cli/wizard.test.ts` with a queue-backed prompt stub. Each prompt method records its
options and returns the next typed value. Use `validPlan()` to implement these cases:

```ts
function promptQueue(values: unknown[]) {
  const confirmCalls: Array<{ default: boolean; message: string }> = [];
  const inputCalls: Array<{ default?: string; message: string }> = [];
  const selectCalls: Array<{ message: string }> = [];
  const port: WizardPrompts = {
    confirm: async (options) => {
      confirmCalls.push(options);
      return Boolean(values.shift());
    },
    input: async (options) => {
      inputCalls.push({
        message: options.message,
        ...(options.default === undefined ? {} : { default: options.default }),
      });
      return String(values.shift());
    },
    select: async <Value extends string>(options: {
      choices: readonly WizardChoice<Value>[];
      message: string;
    }) => {
      selectCalls.push({ message: options.message });
      return values.shift() as Value;
    },
  };
  return Object.assign(port, { confirmCalls, inputCalls, selectCalls });
}

it('saves a plan and defaults to no execution', async () => {
  const route = validRoute();
  const ready = {
    state: 'READY' as const, routeId: route.id, fromAsset: route.fromAsset,
    toAsset: route.toAsset, fromAmount: route.fromAmount.toString(),
    quotedToAmount: route.quotedToAmount.toString(),
    minToAmount: (route.quotedToAmount * 9_900n / 10_000n).toString(),
    netOutputUsd: '0.79', expiresAt: route.expiresAt, toolIds: [...route.toolIds],
  };
  const plan = vi.fn(async () => ({ plan: validPlan({ routes: [ready] }), warnings: [] }));
  const execute = vi.fn();
  const prompts = promptQueue(['en', TEST_WALLET, 'base', 'USDC', '0.25', 'plan.json', 'journal.json', false]);

  await expect(runWizard({ execute, plan, prompts, write: vi.fn() })).resolves.toBe('PLAN_SAVED');
  expect(plan).toHaveBeenCalledWith({
    wallet: TEST_WALLET,
    targetChain: 'base',
    targetToken: 'USDC',
    minNetUsd: '0.25',
    out: 'plan.json',
  });
  expect(execute).not.toHaveBeenCalled();
  expect(prompts.confirmCalls[0]?.default).toBe(false);
});

it('does not offer execution when no route is ready', async () => {
  const prompts = promptQueue(['vi', TEST_WALLET, 'bsc', 'BNB', '0.25', 'plan.json', 'journal.json']);
  const execute = vi.fn();
  await expect(runWizard({
    execute,
    plan: async () => ({ plan: validPlan({ routes: [] }), warnings: [] }),
    prompts,
    write: vi.fn(),
  })).resolves.toBe('NO_ROUTES');
  expect(prompts.confirmCalls).toHaveLength(0);
  expect(execute).not.toHaveBeenCalled();
});

it('delegates an approved plan to the existing executor', async () => {
  const route = validRoute();
  const ready = {
    state: 'READY' as const,
    routeId: 'route-1',
    fromAsset: route.fromAsset,
    toAsset: route.toAsset,
    fromAmount: route.fromAmount.toString(),
    quotedToAmount: route.quotedToAmount.toString(),
    minToAmount: (route.quotedToAmount * 9_900n / 10_000n).toString(),
    netOutputUsd: '0.79',
    expiresAt: route.expiresAt,
    toolIds: [...route.toolIds],
  };
  const saved = validPlan({ routes: [ready] });
  const execute = vi.fn(async () => validJournal());
  const prompts = promptQueue(['en', TEST_WALLET, 'base', 'USDC', '0.25', 'custom-plan.json', 'custom-journal.json', true]);
  await expect(runWizard({
    execute,
    plan: async () => ({ plan: saved, warnings: [] }),
    prompts,
    write: vi.fn(),
  })).resolves.toBe('EXECUTED');
  expect(execute).toHaveBeenCalledWith(saved, 'custom-journal.json');
});
```

Also assert captured prompt messages contain `Wallet address` for English and `Địa chỉ ví` for
Vietnamese.

- [ ] **Step 6: Run orchestration tests and verify they fail**

Run: `npx vitest run tests/cli/wizard.test.ts`

Expected: FAIL because `runWizard` is not exported.

- [ ] **Step 7: Implement `runWizard`**

Implement the exact orchestration sequence:

```ts
export async function runWizard(dependencies: WizardDependencies): Promise<WizardResult> {
  const language = await dependencies.prompts.select<WizardLanguage>({
    message: 'Language / Ngôn ngữ',
    choices: [{ name: 'English', value: 'en' }, { name: 'Tiếng Việt', value: 'vi' }],
  });
  const text = messages[language];
  const walletInput = await dependencies.prompts.input({
    message: text.wallet,
    validate: (value) => validateWallet(value) || text.invalidWallet,
  });
  const targetChain = await dependencies.prompts.select({
    message: text.chain,
    choices: chainChoices(),
  });
  const targetToken = await dependencies.prompts.select({
    message: text.token,
    choices: destinationChoices(targetChain),
  });
  const minNetUsd = (await dependencies.prompts.input({
    default: '0.25',
    message: text.minimum,
    validate: (value) => validateMinimum(value) || text.invalidMinimum,
  })).trim();
  const out = (await dependencies.prompts.input({
    default: 'plan.json', message: text.planPath,
    validate: (value) => validatePath(value) || text.invalidPath,
  })).trim();
  const journal = (await dependencies.prompts.input({
    default: 'journal.json', message: text.journalPath,
    validate: (value) => validatePath(value) || text.invalidPath,
  })).trim();
  const result = await dependencies.plan({
    minNetUsd, out, targetChain, targetToken, wallet: getAddress(walletInput.trim()),
  });
  if (!result.plan.routes.some((route) => route.state === 'READY')) {
    dependencies.write(text.noRoutes);
    return 'NO_ROUTES';
  }
  const executeNow = await dependencies.prompts.confirm({ default: false, message: text.executeNow });
  if (!executeNow) {
    dependencies.write(text.planSaved.replace('{path}', out));
    return 'PLAN_SAVED';
  }
  await dependencies.execute(result.plan, journal);
  return 'EXECUTED';
}
```

- [ ] **Step 8: Run wizard tests and commit**

Run: `npx vitest run tests/cli/wizard.test.ts && npm run typecheck`

Expected: all wizard tests pass and TypeScript reports no errors.

```bash
git add src/cli/wizard.ts tests/cli/wizard.test.ts
git commit -m "feat: add bilingual planning wizard"
```

### Task 2: Reuse live planning and dispatch empty arguments

**Files:**
- Create: `src/cli/live-plan.ts`
- Modify: `src/cli.ts`
- Create: `tests/cli/entrypoint.test.ts`
- Modify: `tests/cli/help.test.ts`

- [ ] **Step 1: Write failing dispatcher tests**

Create `tests/cli/entrypoint.test.ts`:

```ts
import { expect, it, vi } from 'vitest';
import { runCli } from '../../src/cli.js';

it('starts the wizard only for an empty CLI argument list', async () => {
  const wizard = vi.fn(async () => undefined);
  const parse = vi.fn(async () => undefined);
  await runCli(['node', 'dist/cli.js'], { parse, wizard });
  expect(wizard).toHaveBeenCalledOnce();
  expect(parse).not.toHaveBeenCalled();
});

it.each([['--help'], ['plan', '--help'], ['execute', '--help'], ['resume', '--help']])(
  'keeps explicit arguments on Commander: %s',
  async (...args) => {
    const wizard = vi.fn(async () => undefined);
    const parse = vi.fn(async () => undefined);
    await runCli(['node', 'dist/cli.js', ...args.flat()], { parse, wizard });
    expect(parse).toHaveBeenCalledOnce();
    expect(wizard).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 2: Run dispatcher tests and verify failure**

Run: `npx vitest run tests/cli/entrypoint.test.ts`

Expected: FAIL because `runCli` does not exist.

- [ ] **Step 3: Extract live planning assembly**

Move the provider construction currently inside the `plan` Commander action into
`src/cli/live-plan.ts` and export:

```ts
export async function runPlanWithLiveProviders(
  options: PlanOptions & { json?: boolean },
): Promise<PlanReport>;
```

It must retain the current Alchemy-or-RPC discovery, LI.FI route and price providers, per-chain gas
price calculation, atomic `savePlan`, and console/JSON report selection. The explicit plan command
calls this function with its current parsed options; no command flag or default changes.

- [ ] **Step 4: Add Inquirer and live wizard adapters**

In `src/cli/wizard.ts`, import `confirm`, `input`, and `select` from `@inquirer/prompts` and export
`runLiveWizard()`. Adapt each library function to `WizardPrompts`, then call:

```ts
return runWizard({
  execute: executeWithLiveProviders,
  plan: (options) => runPlanWithLiveProviders(options),
  prompts: inquirerPrompts,
  write: console.log,
});
```

Catch only errors whose `name` is `ExitPromptError`; print `Cancelled.` and return without calling
execution. Re-throw all other errors so policy, RPC, storage, and execution failures remain visible.

- [ ] **Step 5: Implement `runCli` and preserve Commander behavior**

In `src/cli.ts`, define:

```ts
export interface CliDispatchDependencies {
  parse(argv: readonly string[]): Promise<unknown>;
  wizard(): Promise<unknown>;
}

export async function runCli(
  argv: readonly string[],
  dependencies: CliDispatchDependencies = {
    parse: (values) => buildCli().parseAsync([...values]),
    wizard: runLiveWizard,
  },
): Promise<void> {
  if (argv.length === 2) await dependencies.wizard();
  else await dependencies.parse(argv);
}
```

Replace the direct `buildCli().parseAsync(process.argv)` entrypoint call with `runCli(process.argv)`.
Keep `buildCli().commands.map(...)` equal to `['plan', 'execute', 'resume']` and route its `plan`
action through `runPlanWithLiveProviders`.

- [ ] **Step 6: Run CLI tests and commit**

Run: `npx vitest run tests/cli/entrypoint.test.ts tests/cli/help.test.ts tests/cli/plan.test.ts`

Expected: dispatcher, help, and existing plan tests pass.

```bash
git add src/cli.ts src/cli/live-plan.ts src/cli/wizard.ts tests/cli/entrypoint.test.ts tests/cli/help.test.ts
git commit -m "feat: launch wizard without a subcommand"
```

### Task 3: Prove simulation remains a hard broadcast gate

**Files:**
- Modify: `tests/execution/executor.test.ts`
- Modify: `tests/execution/simulator.test.ts`

- [ ] **Step 1: Add the executor regression test**

Add a test where refresh succeeds, confirmation returns `EXECUTE`, signer creation succeeds, and
`recheck` rejects with `SIMULATION_FAILED`. Assert both `submit` and `wait` were never called:

```ts
it('never submits a route whose pre-broadcast simulation fails', async () => {
  const submit = vi.fn();
  const wait = vi.fn();
  await expect(executeBatch(validPlan({ routes: [planWithTwoRoutes().routes[0]!] }), {
    confirm: async () => 'EXECUTE',
    now: () => Date.parse('2026-09-12T00:00:00.000Z'),
    persistJournal: vi.fn(async () => undefined),
    readSigner: async () => ({}),
    refresh: async () => ({ valid: true, route: validRoute() }),
    recheck: async () => { throw new Error('SIMULATION_FAILED'); },
    submit,
    wait,
  })).rejects.toThrow('SIMULATION_FAILED');
  expect(submit).not.toHaveBeenCalled();
  expect(wait).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add the simulator ordering test**

Add a `simulateCandidate` test whose `call` rejects. Assert `estimateGas` and
`getTransactionCount` are not called. This proves a failed `eth_call` cannot progress through the
candidate preflight.

- [ ] **Step 3: Run safety tests and commit**

Run: `npx vitest run tests/execution/executor.test.ts tests/execution/simulator.test.ts`

Expected: all execution and simulation tests pass.

```bash
git add tests/execution/executor.test.ts tests/execution/simulator.test.ts
git commit -m "test: enforce simulation before broadcast"
```

### Task 4: Document the wizard workflow

**Files:**
- Modify: `README.md`
- Modify: `tutorial.html`

- [ ] **Step 1: Update the English README**

Make `node dist/cli.js` the beginner quick start after `npm run build`. Document the exact prompt
sequence, public-wallet versus masked-private-key distinction, execute-now default `No`, and the
three wizard outcomes. Keep the full `plan`, `execute`, and `resume` examples under an automation
or advanced usage subsection.

Describe simulation precisely: approval candidates are simulated before approval broadcast; when
an approval is required, the route is simulated again after that approval is mined and before the
swap/bridge broadcast. A failed candidate simulation blocks that candidate but does not provide a
future success guarantee.

- [ ] **Step 2: Update the Vietnamese tutorial**

Change the primary flow and command blocks to start with:

```bash
node dist/cli.js
```

Explain the bilingual language selector, registry-filtered target choices, default values, plan
review, `Thực thi ngay? (y/N)`, the unchanged exact `EXECUTE` gate, and masked key prompt. Retain the
explicit command examples for automation and `resume` recovery. Add a visible simulation callout
that says `FAIL` means the relevant candidate is not broadcast and `PASS` is not a guarantee.

- [ ] **Step 3: Verify documentation and commit**

Run:

```bash
rg -n "node dist/cli\.js$|Language|Tiếng Việt|y/N|EXECUTE|simulation|mô phỏng|private key" README.md tutorial.html
rg -n "success rate|success probability|guarantee.*success|[T]BD|[T]ODO|[F]IXME" README.md tutorial.html
git diff --check
```

Expected: required wizard and safety terms are present, the misleading-probability/placeholder scan
produces no output, and the diff contains no whitespace errors.

```bash
git add README.md tutorial.html
git commit -m "docs: add interactive wizard guide"
```

### Task 5: Run the release gate and publish

**Files:**
- Verify all modified files

- [ ] **Step 1: Run focused and complete verification**

Run:

```bash
npm run check
node dist/cli.js --help
git diff --check 8157a30..HEAD
git status --short
```

Expected: typecheck passes, all tests pass, build succeeds, explicit help does not open the wizard,
the diff has no whitespace errors, and the working tree is clean.

- [ ] **Step 2: Run a safe terminal smoke test**

Run `node dist/cli.js`, choose both languages in separate runs, inspect the chain/token selection,
then cancel with `Ctrl+C` before planning or execution. Use no funded private key and broadcast no
transaction.

Expected: the wizard starts only with no subcommand, both language paths render, registry choices
are correct, cancellation prints a concise message, and no plan/journal is created by the cancelled
run.

- [ ] **Step 3: Push main without rewriting history**

Run:

```bash
git push origin main
```

Expected: GitHub accepts the new commits and local `main` matches `origin/main`. Never use force
push.
