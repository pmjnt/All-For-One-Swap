import { Decimal } from 'decimal.js';

function money(value: string): Decimal {
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) throw new Error('USD value must be finite');
  return parsed;
}

export function netOutputUsd(input: {
  explicitFeeUsd: string;
  feeDeducted: boolean;
  gasUsd: string;
  outputUsd: string;
}): string {
  const result = money(input.outputUsd)
    .minus(money(input.gasUsd))
    .minus(input.feeDeducted ? 0 : money(input.explicitFeeUsd));
  return result.toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed();
}

export function reserveNativeAmount(
  balance: bigint,
  estimatedMaximumGas: bigint,
  gasBufferBps: number,
): { reserve: bigint; spendable: bigint } {
  if (balance < 0n || estimatedMaximumGas < 0n) throw new Error('Native amounts must be non-negative');
  if (!Number.isInteger(gasBufferBps) || gasBufferBps < 0) {
    throw new Error('Gas buffer must be a non-negative integer');
  }
  const buffered = estimatedMaximumGas * BigInt(10_000 + gasBufferBps);
  const requestedReserve = (buffered + 9_999n) / 10_000n;
  const reserve = requestedReserve > balance ? balance : requestedReserve;
  return { reserve, spendable: balance - reserve };
}
