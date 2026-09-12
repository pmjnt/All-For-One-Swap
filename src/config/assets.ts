import { getAddress, type Address } from 'viem';

import type { SupportedChainId } from '../domain/model.js';

export interface LiquidityProbe {
  maxPriceImpactBps: number;
  notionalUsd: string;
  reviewedAt: string;
}

export interface AssetRegistryEntry {
  address: Address | 'native';
  chainId: SupportedChainId;
  decimals: number;
  destination: boolean;
  kind: 'native' | 'erc20';
  liquidityProbe?: LiquidityProbe;
  source: boolean;
  sourceUrl: string;
  symbol: string;
  transferBehavior: 'native' | 'standard' | 'legacy-no-return';
}

const reviewedAt = '2026-09-12';
const probe: LiquidityProbe = { maxPriceImpactBps: 100, notionalUsd: '1', reviewedAt };

function native(
  chainId: SupportedChainId,
  symbol: string,
  sourceUrl: string,
): AssetRegistryEntry {
  return {
    address: 'native',
    chainId,
    decimals: 18,
    destination: true,
    kind: 'native',
    source: true,
    sourceUrl,
    symbol,
    transferBehavior: 'native',
  };
}

function erc20(entry: Omit<AssetRegistryEntry, 'address' | 'kind'> & { address: string }): AssetRegistryEntry {
  return { ...entry, address: getAddress(entry.address), kind: 'erc20' };
}

const circleSource = 'https://developers.circle.com/stablecoins/usdc-contract-addresses';
const lifiTokenSource = 'https://docs.li.fi/agents/overview';

export const ASSETS: readonly AssetRegistryEntry[] = Object.freeze([
  native(1, 'ETH', 'https://ethereum.org/en/eth/'),
  native(10, 'ETH', 'https://docs.optimism.io/chain-operators/reference/chain-ids'),
  native(56, 'BNB', 'https://docs.bnbchain.org/bnb-smart-chain/developers/quick-guide/'),
  native(137, 'POL', 'https://docs.polygon.technology/pos/concepts/tokens/pol'),
  native(8453, 'ETH', 'https://docs.base.org/base-chain/network-information'),
  native(42161, 'ETH', 'https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers'),
  erc20({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1, decimals: 6,
    destination: true, source: true, sourceUrl: circleSource, symbol: 'USDC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', chainId: 10, decimals: 6,
    destination: true, source: true, sourceUrl: circleSource, symbol: 'USDC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', chainId: 137, decimals: 6,
    destination: true, source: true, sourceUrl: circleSource, symbol: 'USDC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, decimals: 6,
    destination: true, source: true, sourceUrl: circleSource, symbol: 'USDC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, decimals: 6,
    destination: true, source: true, sourceUrl: circleSource, symbol: 'USDC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainId: 1, decimals: 6,
    destination: true, source: true, sourceUrl: 'https://tether.to/en/supported-protocols/',
    symbol: 'USDT', transferBehavior: 'legacy-no-return',
  }),
  erc20({
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chainId: 1, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: lifiTokenSource,
    symbol: 'WETH', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x4200000000000000000000000000000000000006', chainId: 10, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://docs.optimism.io/app-developers/tools/building-on-optimism/contracts',
    symbol: 'WETH', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x4200000000000000000000000000000000000006', chainId: 8453, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: lifiTokenSource,
    symbol: 'WETH', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: lifiTokenSource,
    symbol: 'WETH', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', chainId: 137, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://docs.polygon.technology/pos/reference/mapped-tokens/',
    symbol: 'WETH', transferBehavior: 'standard',
  }),
  erc20({
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', chainId: 56, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://docs.bnbchain.org/bnb-smart-chain/benchmark/design-reference/',
    symbol: 'WBNB', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chainId: 1, decimals: 8,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://docs.bitgo.com/docs/wbtc',
    symbol: 'WBTC', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', chainId: 1, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://developers.sky.money/deployment-addresses/ethereum/',
    symbol: 'DAI', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', chainId: 1, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://docs.chain.link/resources/link-token-contracts',
    symbol: 'LINK', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chainId: 1, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://blog.uniswap.org/uni',
    symbol: 'UNI', transferBehavior: 'standard',
  }),
  erc20({
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2dDaE9', chainId: 1, decimals: 18,
    destination: false, liquidityProbe: probe, source: true, sourceUrl: 'https://aave.com/docs/resources/addresses',
    symbol: 'AAVE', transferBehavior: 'standard',
  }),
]);
