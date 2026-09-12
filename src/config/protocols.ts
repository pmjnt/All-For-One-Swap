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

const lifiDiamond = getAddress('0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE');

export const PROTOCOLS: readonly ProtocolRegistryEntry[] = Object.freeze([
  {
    allowedBridgeTools: ['across', 'stargateV2'],
    allowedExchangeTools: ['1inch', 'odos'],
    approvedSpenders: [lifiDiamond],
    chainIds: [1, 10, 56, 137, 8453, 42161],
    entrypoints: [lifiDiamond],
    id: 'lifi',
    selectors: [
      '0xa1f1ce43',
      '0x1794958f',
      '0x14d53077',
      '0xa6010a66',
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
