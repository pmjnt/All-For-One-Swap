import { decodeAbiParameters, getAddress, type Address, type Hex } from 'viem';

const bridgeDataParameter = {
  type: 'tuple',
  components: [
    { name: 'transactionId', type: 'bytes32' },
    { name: 'bridge', type: 'string' },
    { name: 'integrator', type: 'string' },
    { name: 'referrer', type: 'address' },
    { name: 'sendingAssetId', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'minAmount', type: 'uint256' },
    { name: 'destinationChainId', type: 'uint256' },
    { name: 'hasSourceSwaps', type: 'bool' },
    { name: 'hasDestinationCall', type: 'bool' },
  ],
} as const;

const bridgeSelectors = new Set<Hex>([
  '0xa1f1ce43',
  '0x1794958f',
  '0x14d53077',
  '0xa6010a66',
]);

export interface DecodedBridgeIntent {
  bridge: string;
  destinationChainId: bigint;
  hasDestinationCall: boolean;
  hasSourceSwaps: boolean;
  minAmount: bigint;
  receiver: Address;
  selector: Hex;
  sendingAsset: Address;
}

export function selectorOf(data: Hex): Hex {
  if (data.length < 10) throw new Error('Calldata is shorter than a function selector');
  return data.slice(0, 10) as Hex;
}

export function decodeBridgeIntent(data: Hex): DecodedBridgeIntent {
  const selector = selectorOf(data);
  if (!bridgeSelectors.has(selector)) throw new Error('Unsupported LI.FI call shape');
  try {
    const [decoded] = decodeAbiParameters([bridgeDataParameter], `0x${data.slice(10)}`);
    return {
      bridge: decoded.bridge,
      destinationChainId: decoded.destinationChainId,
      hasDestinationCall: decoded.hasDestinationCall,
      hasSourceSwaps: decoded.hasSourceSwaps,
      minAmount: decoded.minAmount,
      receiver: getAddress(decoded.receiver),
      selector,
      sendingAsset: getAddress(decoded.sendingAssetId),
    };
  } catch {
    throw new Error('Malformed LI.FI bridge calldata');
  }
}
