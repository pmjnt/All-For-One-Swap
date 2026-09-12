import { erc20Abi, type Address, type Hex } from 'viem';

import type { SupportedChainId } from '../domain/model.js';

interface ContractReference {
  address: Address;
  chainId: SupportedChainId;
}

interface AssetReference extends ContractReference {
  decimals: number;
}

interface RegistryVerificationClient {
  getBytecode(args: { address: Address }): Promise<Hex | undefined>;
  readContract(args: {
    abi: typeof erc20Abi;
    address: Address;
    functionName: 'decimals';
  }): Promise<unknown>;
}

export async function verifyRegistryOnline(input: {
  assets: readonly AssetReference[];
  clientForChain: (chainId: SupportedChainId) => RegistryVerificationClient;
  contracts: readonly ContractReference[];
}): Promise<void> {
  for (const asset of input.assets) {
    const client = input.clientForChain(asset.chainId);
    const bytecode = await client.getBytecode({ address: asset.address });
    if (!bytecode || bytecode === '0x') {
      throw new Error(`Missing bytecode at ${asset.chainId}:${asset.address}`);
    }
    const decimals = await client.readContract({
      abi: erc20Abi,
      address: asset.address,
      functionName: 'decimals',
    });
    if (decimals !== asset.decimals) {
      throw new Error(
        `Decimals mismatch at ${asset.chainId}:${asset.address}; expected ${asset.decimals}, received ${String(decimals)}`,
      );
    }
  }

  for (const contract of input.contracts) {
    const bytecode = await input
      .clientForChain(contract.chainId)
      .getBytecode({ address: contract.address });
    if (!bytecode || bytecode === '0x') {
      throw new Error(`Missing bytecode at ${contract.chainId}:${contract.address}`);
    }
  }
}
