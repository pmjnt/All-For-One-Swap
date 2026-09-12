import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

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
]);

const swapDataParameter = {
  type: 'tuple[]',
  components: [
    { name: 'callTo', type: 'address' },
    { name: 'approveTo', type: 'address' },
    { name: 'sendingAssetId', type: 'address' },
    { name: 'receivingAssetId', type: 'address' },
    { name: 'fromAmount', type: 'uint256' },
    { name: 'callData', type: 'bytes' },
    { name: 'requiresDeposit', type: 'bool' },
  ],
} as const;

const acrossDataParameter = {
  type: 'tuple',
  components: [
    { name: 'receiverAddress', type: 'bytes32' },
    { name: 'refundAddress', type: 'bytes32' },
    { name: 'sendingAssetId', type: 'bytes32' },
    { name: 'receivingAssetId', type: 'bytes32' },
    { name: 'outputAmount', type: 'uint256' },
    { name: 'outputAmountMultiplier', type: 'uint128' },
    { name: 'exclusiveRelayer', type: 'bytes32' },
    { name: 'quoteTimestamp', type: 'uint32' },
    { name: 'fillDeadline', type: 'uint32' },
    { name: 'exclusivityParameter', type: 'uint32' },
    { name: 'message', type: 'bytes' },
  ],
} as const;

const genericSwapAbi = parseAbi([
  'function swapTokensMultipleV3ERC20ToERC20(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit)[] _swapData)',
  'function swapTokensMultipleV3ERC20ToNative(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit)[] _swapData)',
  'function swapTokensMultipleV3NativeToERC20(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit)[] _swapData)',
  'function swapTokensSingleV3ERC20ToERC20(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit) _swapData)',
  'function swapTokensSingleV3ERC20ToNative(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit) _swapData)',
  'function swapTokensSingleV3NativeToERC20(bytes32 _transactionId,string _integrator,string _referrer,address _receiver,uint256 _minAmountOut,(address callTo,address approveTo,address sendingAssetId,address receivingAssetId,uint256 fromAmount,bytes callData,bool requiresDeposit) _swapData)',
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

export interface RawSwapData {
  approveTo: Address;
  callData: Hex;
  callTo: Address;
  fromAmount: bigint;
  receivingAssetId: Address;
  requiresDeposit: boolean;
  sendingAssetId: Address;
}

export interface DecodedAcrossIntent {
  fillDeadline: number;
  outputAmount: bigint;
  outputAmountMultiplier: bigint;
  receiver: Address;
  refundAddress: Address;
  receivingAsset: Address;
  sendingAsset: Address;
  swaps: readonly RawSwapData[];
}

function dynamicArgument(data: Hex, index: number): Hex {
  const argumentsHex = data.slice(10);
  const word = argumentsHex.slice(index * 64, (index + 1) * 64);
  if (word.length !== 64) throw new Error('Missing ABI argument offset');
  const offset = Number(BigInt(`0x${word}`));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset * 2 >= argumentsHex.length) {
    throw new Error('Invalid ABI argument offset');
  }
  return `0x${'0'.repeat(62)}20${argumentsHex.slice(offset * 2)}`;
}

function bytes32Address(value: Hex): Address {
  if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(value)) throw new Error('Non-EVM bytes32 address');
  return getAddress(`0x${value.slice(-40)}`);
}

function normalizeSwaps(swaps: readonly RawSwapData[]): RawSwapData[] {
  return swaps.map((swap) => ({
    ...swap,
    approveTo: getAddress(swap.approveTo),
    callTo: getAddress(swap.callTo),
    receivingAssetId: getAddress(swap.receivingAssetId),
    sendingAssetId: getAddress(swap.sendingAssetId),
  }));
}

export function decodeAcrossIntent(data: Hex): DecodedAcrossIntent {
  const withSwaps = selectorOf(data) === '0x1794958f';
  try {
    const acrossIndex = withSwaps ? 2 : 1;
    const [across] = decodeAbiParameters([acrossDataParameter], dynamicArgument(data, acrossIndex));
    const swaps = withSwaps
      ? decodeAbiParameters([swapDataParameter], dynamicArgument(data, 1))[0]
      : [];
    return {
      fillDeadline: across.fillDeadline,
      outputAmount: across.outputAmount,
      outputAmountMultiplier: across.outputAmountMultiplier,
      receiver: bytes32Address(across.receiverAddress),
      refundAddress: bytes32Address(across.refundAddress),
      receivingAsset: bytes32Address(across.receivingAssetId),
      sendingAsset: bytes32Address(across.sendingAssetId),
      swaps: normalizeSwaps(swaps),
    };
  } catch {
    throw new Error('Malformed Across V4 calldata');
  }
}

export interface DecodedSwapIntent {
  kind: 'swap';
  minAmountOut: bigint;
  receiver: Address;
  selector: Hex;
  swaps: readonly RawSwapData[];
}

export function isBridgeSelector(selector: Hex): boolean {
  return bridgeSelectors.has(selector);
}

export function decodeSwapIntent(data: Hex): DecodedSwapIntent {
  try {
    const decoded = decodeFunctionData({ abi: genericSwapAbi, data });
    const args = decoded.args as readonly [Hex, string, string, Address, bigint, RawSwapData | readonly RawSwapData[]];
    const rawSwaps = Array.isArray(args[5]) ? args[5] : [args[5]];
    if (rawSwaps.length === 0) throw new Error('Swap path is empty');
    return {
      kind: 'swap',
      minAmountOut: args[4],
      receiver: getAddress(args[3]),
      selector: selectorOf(data),
      swaps: normalizeSwaps(rawSwaps),
    };
  } catch {
    throw new Error('Malformed LI.FI generic swap calldata');
  }
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
