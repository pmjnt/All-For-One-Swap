const rpcVariableNames = [
  'ETHEREUM_RPC_URL',
  'OPTIMISM_RPC_URL',
  'BSC_RPC_URL',
  'POLYGON_RPC_URL',
  'BASE_RPC_URL',
  'ARBITRUM_RPC_URL',
] as const;

export interface RuntimeEnvironment {
  alchemyApiKey?: string;
  lifiApiKey?: string;
}

export function readRuntimeEnvironment(source: NodeJS.ProcessEnv = process.env): RuntimeEnvironment {
  return {
    ...(source.ALCHEMY_API_KEY ? { alchemyApiKey: source.ALCHEMY_API_KEY } : {}),
    ...(source.LIFI_API_KEY ? { lifiApiKey: source.LIFI_API_KEY } : {}),
  };
}

export function environmentPresence(source: NodeJS.ProcessEnv = process.env): Record<string, boolean> {
  return {
    ALCHEMY_API_KEY: Boolean(source.ALCHEMY_API_KEY),
    LIFI_API_KEY: Boolean(source.LIFI_API_KEY),
    ...Object.fromEntries(rpcVariableNames.map((name) => [name, Boolean(source[name])])),
  };
}
