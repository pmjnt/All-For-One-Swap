import { getAddress, type Address, type Hex } from 'viem';

import type { SupportedChainId } from '../domain/model.js';

export interface ProtocolRegistryEntry {
  allowedBridgeTools: readonly string[];
  allowedExchangeTools: readonly string[];
  approvedSpenders: readonly Address[];
  chainIds: readonly SupportedChainId[];
  entrypoints: readonly Address[];
  id: string;
  selectors: readonly Hex[];
  sourceUrl: string;
}

export interface DexRouterRegistryEntry {
  address: Address;
  chainId: SupportedChainId;
  sourceUrl: string;
  tool: '1inch' | 'odos';
}

const lifiDiamond = getAddress('0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE');

export const PROTOCOLS: readonly ProtocolRegistryEntry[] = Object.freeze([
  {
    allowedBridgeTools: ['across'],
    allowedExchangeTools: ['1inch', 'odos'],
    approvedSpenders: [lifiDiamond],
    chainIds: [1, 10, 56, 137, 8453, 42161],
    entrypoints: [lifiDiamond],
    id: 'lifi',
    selectors: [
      '0xa1f1ce43',
      '0x1794958f',
      '0x5fd9ae2e',
      '0x2c57e884',
      '0x736eac0b',
      '0x4666fc80',
      '0x733214a3',
      '0xaf7060fd',
    ],
    sourceUrl: 'https://github.com/lifinance/lifi-contract-types/blob/main/dist/diamond.json',
  },
]);

const oneInchSource = 'https://business.1inch.com/portal/documentation/apis/swap/classic-swap/quick-start';
const odosSource = 'https://github.com/odos-xyz/odos-router-v2#chain-deployments';
const oneInchV6 = getAddress('0x111111125421ca6dc452d289314280a0f8842a65');

export const DEX_ROUTERS: readonly DexRouterRegistryEntry[] = Object.freeze([
  ...([1, 10, 56, 137, 8453, 42161] as const).map((chainId) => ({
    address: oneInchV6, chainId, sourceUrl: oneInchSource, tool: '1inch' as const,
  })),
  { address: getAddress('0xcf5540fffcdc3d510b18bfca6d2b9987b0772559'), chainId: 1, sourceUrl: odosSource, tool: 'odos' },
  { address: getAddress('0xca423977156bb05b13a2ba3b76bc5419e2fe9680'), chainId: 10, sourceUrl: odosSource, tool: 'odos' },
  { address: getAddress('0x89b8aa89fdd0507a99d334cbe3c808fafc7d850e'), chainId: 56, sourceUrl: odosSource, tool: 'odos' },
  { address: getAddress('0x4e3288c9ca110bcc82bf38f09a7b425c095d92bf'), chainId: 137, sourceUrl: odosSource, tool: 'odos' },
  { address: getAddress('0x19ceead7105607cd444f5ad10dd51356436095a1'), chainId: 8453, sourceUrl: odosSource, tool: 'odos' },
  { address: getAddress('0xa669e7a0d4b3e4fa48af2de86bd4cd7126be4e13'), chainId: 42161, sourceUrl: odosSource, tool: 'odos' },
]);
