import { password } from '@inquirer/prompts';
import { getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export interface SecretInputDependencies {
  isTTY: boolean;
  prompt: (message: string) => Promise<string>;
}

export async function readSigner(
  expected: Address,
  dependencies: SecretInputDependencies = {
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: (message) => password({ mask: '*', message }),
  },
) {
  if (!dependencies.isTTY) {
    throw new Error('Mainnet signing requires an interactive TTY');
  }

  let raw: string | undefined = await dependencies.prompt('Private key');
  try {
    const secret = raw;
    if (!secret || !/^0x[0-9a-fA-F]{64}$/.test(secret)) {
      throw new Error('Invalid private key format');
    }
    const account = privateKeyToAccount(secret as Hex);
    if (getAddress(account.address) !== getAddress(expected)) {
      throw new Error('Signer address does not match plan');
    }
    return account;
  } finally {
    raw = undefined;
  }
}
