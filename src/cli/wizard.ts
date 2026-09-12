import { Decimal } from 'decimal.js';
import { getAddress } from 'viem';

import { ASSETS } from '../config/assets.js';
import { CHAINS } from '../config/chains.js';
import type { PlanV1 } from '../domain/schemas.js';
import type { PlanOptions } from './plan.js';
import type { PlanReport } from '../reporting/console.js';

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
    chain: 'Target chain',
    executeNow: 'Execute this plan now?',
    invalidMinimum: 'Enter a non-negative decimal amount.',
    invalidPath: 'Path cannot be blank.',
    invalidWallet: 'Enter a valid EVM wallet address.',
    journalPath: 'Journal file',
    minimum: 'Minimum net USD',
    noRoutes: 'No executable routes were found. The plan was saved for review.',
    planPath: 'Plan file',
    planSaved: 'Plan saved to {path}. Review it before execution.',
    token: 'Target token',
    wallet: 'Wallet address (public address, not private key)',
  },
  vi: {
    chain: 'Chain đích',
    executeNow: 'Thực thi kế hoạch này ngay?',
    invalidMinimum: 'Nhập số thập phân không âm.',
    invalidPath: 'Đường dẫn không được để trống.',
    invalidWallet: 'Nhập địa chỉ ví EVM hợp lệ.',
    journalPath: 'File journal',
    minimum: 'Giá trị net tối thiểu (USD)',
    noRoutes: 'Không tìm thấy route có thể thực thi. Plan đã được lưu để kiểm tra.',
    planPath: 'File plan',
    planSaved: 'Đã lưu plan tại {path}. Hãy kiểm tra trước khi thực thi.',
    token: 'Token đích',
    wallet: 'Địa chỉ ví công khai (không phải private key)',
  },
};

export function validateWallet(value: string): boolean {
  try {
    getAddress(value.trim());
    return true;
  } catch {
    return false;
  }
}

export function validateMinimum(value: string): boolean {
  try {
    const amount = new Decimal(value.trim());
    return amount.isFinite() && !amount.isNegative();
  } catch {
    return false;
  }
}

export function validatePath(value: string): boolean {
  return value.trim().length > 0;
}

export function chainChoices(): WizardChoice<string>[] {
  return Object.values(CHAINS).map(({ chain, key }) => ({ name: chain.name, value: key }));
}

export function destinationChoices(chainKey: string): WizardChoice<string>[] {
  const chainId = Number(
    Object.entries(CHAINS).find(([, chain]) => chain.key === chainKey)?.[0],
  );
  return ASSETS
    .filter((asset) => asset.chainId === chainId && asset.destination)
    .map((asset) => ({ name: asset.symbol, value: asset.symbol }));
}

export async function runWizard(dependencies: WizardDependencies): Promise<WizardResult> {
  const language = await dependencies.prompts.select<WizardLanguage>({
    message: 'Language / Ngôn ngữ',
    choices: [
      { name: 'English', value: 'en' },
      { name: 'Tiếng Việt', value: 'vi' },
    ],
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
    default: 'plan.json',
    message: text.planPath,
    validate: (value) => validatePath(value) || text.invalidPath,
  })).trim();
  const journal = (await dependencies.prompts.input({
    default: 'journal.json',
    message: text.journalPath,
    validate: (value) => validatePath(value) || text.invalidPath,
  })).trim();
  const result = await dependencies.plan({
    minNetUsd,
    out,
    targetChain,
    targetToken,
    wallet: getAddress(walletInput.trim()),
  });
  if (!result.plan.routes.some((route) => route.state === 'READY')) {
    dependencies.write(text.noRoutes);
    return 'NO_ROUTES';
  }
  const executeNow = await dependencies.prompts.confirm({
    default: false,
    message: text.executeNow,
  });
  if (!executeNow) {
    dependencies.write(text.planSaved.replace('{path}', out));
    return 'PLAN_SAVED';
  }
  await dependencies.execute(result.plan, journal);
  return 'EXECUTED';
}
