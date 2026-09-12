import { describe, expect, it, vi } from 'vitest';

import {
  destinationChoices,
  runLiveWizard,
  runWizard,
  runWizardSafely,
  validateMinimum,
  validatePath,
  validateWallet,
  type WizardChoice,
  type WizardPrompts,
} from '../../src/cli/wizard.js';
import { TEST_WALLET, validJournal, validPlan, validRoute } from '../support/factories.js';

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

function readyPlan() {
  const route = validRoute();
  return validPlan({
    routes: [{
      state: 'READY',
      routeId: route.id,
      fromAsset: route.fromAsset,
      toAsset: route.toAsset,
      fromAmount: route.fromAmount.toString(),
      quotedToAmount: route.quotedToAmount.toString(),
      minToAmount: (route.quotedToAmount * 9_900n / 10_000n).toString(),
      netOutputUsd: '0.79',
      expiresAt: route.expiresAt,
      toolIds: [...route.toolIds],
    }],
  });
}

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

describe('wizard orchestration', () => {
  it('saves a plan and defaults to no execution', async () => {
    const saved = readyPlan();
    const plan = vi.fn(async () => ({ plan: saved, warnings: [] }));
    const execute = vi.fn();
    const prompts = promptQueue([
      'en', TEST_WALLET, 'base', 'USDC', '0.25', 'plan.json', 'journal.json', false,
    ]);

    await expect(runWizard({ execute, plan, prompts, write: vi.fn() }))
      .resolves.toBe('PLAN_SAVED');
    expect(plan).toHaveBeenCalledWith({
      wallet: TEST_WALLET,
      targetChain: 'base',
      targetToken: 'USDC',
      minNetUsd: '0.25',
      out: 'plan.json',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(prompts.confirmCalls[0]?.default).toBe(false);
    expect(prompts.inputCalls[0]?.message).toContain('Wallet address');
  });

  it('does not offer execution when no route is ready', async () => {
    const prompts = promptQueue([
      'vi', TEST_WALLET, 'bsc', 'BNB', '0.25', 'plan.json', 'journal.json',
    ]);
    const execute = vi.fn();

    await expect(runWizard({
      execute,
      plan: async () => ({ plan: validPlan({ routes: [] }), warnings: [] }),
      prompts,
      write: vi.fn(),
    })).resolves.toBe('NO_ROUTES');
    expect(prompts.confirmCalls).toHaveLength(0);
    expect(prompts.inputCalls[0]?.message).toContain('Địa chỉ ví');
    expect(execute).not.toHaveBeenCalled();
  });

  it('delegates an approved plan to the existing executor', async () => {
    const saved = readyPlan();
    const execute = vi.fn(async () => validJournal());
    const prompts = promptQueue([
      'en', TEST_WALLET, 'base', 'USDC', '0.25',
      'custom-plan.json', 'custom-journal.json', true,
    ]);

    await expect(runWizard({
      execute,
      plan: async () => ({ plan: saved, warnings: [] }),
      prompts,
      write: vi.fn(),
    })).resolves.toBe('EXECUTED');
    expect(execute).toHaveBeenCalledWith(saved, 'custom-journal.json');
  });

  it('turns prompt cancellation into a safe result', async () => {
    const cancellation = new Error('User force closed the prompt');
    cancellation.name = 'ExitPromptError';
    const write = vi.fn();

    await expect(runWizardSafely(async () => { throw cancellation; }, write))
      .resolves.toBe('CANCELLED');
    expect(write).toHaveBeenCalledWith('Cancelled.');
  });

  it('does not hide non-prompt failures', async () => {
    const failure = new Error('RPC failed');

    await expect(runWizardSafely(async () => { throw failure; }, vi.fn()))
      .rejects.toThrow('RPC failed');
  });

  it('runs the live adapter through the same wizard orchestration', async () => {
    const prompts = promptQueue([
      'en', TEST_WALLET, 'bsc', 'BNB', '0.25', 'plan.json', 'journal.json',
    ]);
    const execute = vi.fn();

    await expect(runLiveWizard({
      execute,
      plan: async () => ({ plan: validPlan({ routes: [] }), warnings: [] }),
      prompts,
      write: vi.fn(),
    })).resolves.toBe('NO_ROUTES');
    expect(execute).not.toHaveBeenCalled();
  });
});
