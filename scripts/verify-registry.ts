import { createPublicClient, getAddress, http } from 'viem';

import { ASSETS } from '../src/config/assets.js';
import { CHAINS, SUPPORTED_CHAIN_IDS } from '../src/config/chains.js';
import { PROTOCOLS } from '../src/config/protocols.js';
import { verifyRegistryOnline } from '../src/config/verify.js';

function verifyRegistry(): void {
  const identities = new Set<string>();

  for (const asset of ASSETS) {
    const address = asset.address === 'native' ? 'native' : getAddress(asset.address);
    const identity = `${asset.chainId}:${address.toLowerCase()}`;
    if (identities.has(identity)) throw new Error(`Duplicate asset ${identity}`);
    identities.add(identity);
    if (!asset.sourceUrl.startsWith('https://')) throw new Error(`Missing evidence for ${identity}`);
    if (asset.decimals < 0 || asset.decimals > 255) throw new Error(`Invalid decimals for ${identity}`);
    if (asset.kind === 'erc20' && asset.source && !asset.destination && !asset.liquidityProbe) {
      throw new Error(`Missing liquidity review for ${identity}`);
    }
  }

  for (const chainId of SUPPORTED_CHAIN_IDS) {
    if (!CHAINS[chainId]) throw new Error(`Missing chain ${chainId}`);
    if (!ASSETS.some((asset) => asset.chainId === chainId && asset.destination)) {
      throw new Error(`Missing destination for chain ${chainId}`);
    }
  }

  for (const protocol of PROTOCOLS) {
    if (protocol.entrypoints.length === 0 || protocol.selectors.length === 0) {
      throw new Error(`Incomplete protocol ${protocol.id}`);
    }
    for (const address of [...protocol.entrypoints, ...protocol.approvedSpenders]) getAddress(address);
    for (const selector of protocol.selectors) {
      if (!/^0x[0-9a-fA-F]{8}$/.test(selector)) throw new Error(`Invalid selector ${selector}`);
    }
  }
}

verifyRegistry();

if (process.argv.includes('--online')) {
  const clients = new Map(
    SUPPORTED_CHAIN_IDS.map((chainId) => [
      chainId,
      createPublicClient({ chain: CHAINS[chainId].chain, transport: http(CHAINS[chainId].publicRpcUrl) }),
    ]),
  );
  const clientForChain = (chainId: (typeof SUPPORTED_CHAIN_IDS)[number]) => {
    const client = clients.get(chainId);
    if (!client) throw new Error(`Missing client for chain ${chainId}`);
    return {
      getBytecode: (args: Parameters<typeof client.getBytecode>[0]) => client.getBytecode(args),
      readContract: (args: Parameters<typeof client.readContract>[0]) => client.readContract(args),
    };
  };
  await verifyRegistryOnline({
    assets: ASSETS.flatMap((asset) =>
      asset.address === 'native'
        ? []
        : [{ address: asset.address, chainId: asset.chainId, decimals: asset.decimals }],
    ),
    clientForChain,
    contracts: PROTOCOLS.flatMap((protocol) =>
      protocol.chainIds.flatMap((chainId) =>
        [...protocol.entrypoints, ...protocol.approvedSpenders].map((address) => ({ address, chainId })),
      ),
    ),
  });
}

console.log(
  `Registry verified${process.argv.includes('--online') ? ' on-chain' : ' statically'}: ${SUPPORTED_CHAIN_IDS.length} chains, ${ASSETS.length} assets, ${PROTOCOLS.length} protocol`,
);
