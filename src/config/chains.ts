import { arbitrum, base, bsc, mainnet, optimism, polygon } from 'viem/chains';

import type { SupportedChainId } from '../domain/model.js';

export interface ChainConfig {
  chain: typeof mainnet | typeof optimism | typeof bsc | typeof polygon | typeof base | typeof arbitrum;
  confirmations: number;
  gasBufferBps: number;
  key: string;
  publicRpcUrl: string;
  rpcEnv: string;
}

export const CHAINS: Readonly<Record<SupportedChainId, ChainConfig>> = {
  1: {
    chain: mainnet,
    confirmations: 2,
    gasBufferBps: 2_000,
    key: 'ethereum',
    publicRpcUrl: 'https://ethereum-rpc.publicnode.com',
    rpcEnv: 'ETHEREUM_RPC_URL',
  },
  10: {
    chain: optimism,
    confirmations: 2,
    gasBufferBps: 2_000,
    key: 'optimism',
    publicRpcUrl: 'https://mainnet.optimism.io',
    rpcEnv: 'OPTIMISM_RPC_URL',
  },
  56: {
    chain: bsc,
    confirmations: 3,
    gasBufferBps: 2_000,
    key: 'bsc',
    publicRpcUrl: 'https://bsc-dataseed.bnbchain.org',
    rpcEnv: 'BSC_RPC_URL',
  },
  137: {
    chain: polygon,
    confirmations: 5,
    gasBufferBps: 2_000,
    key: 'polygon',
    publicRpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    rpcEnv: 'POLYGON_RPC_URL',
  },
  8453: {
    chain: base,
    confirmations: 2,
    gasBufferBps: 2_000,
    key: 'base',
    publicRpcUrl: 'https://mainnet.base.org',
    rpcEnv: 'BASE_RPC_URL',
  },
  42161: {
    chain: arbitrum,
    confirmations: 2,
    gasBufferBps: 2_000,
    key: 'arbitrum',
    publicRpcUrl: 'https://arb1.arbitrum.io/rpc',
    rpcEnv: 'ARBITRUM_RPC_URL',
  },
};

export const SUPPORTED_CHAIN_IDS = Object.freeze(
  Object.keys(CHAINS).map(Number) as SupportedChainId[],
);
