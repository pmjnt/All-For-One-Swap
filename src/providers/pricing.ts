import { Decimal } from 'decimal.js';

export interface PriceObservation {
  observedAt: string;
  priceUsd: string;
}

export function assertFreshPrice(
  observation: PriceObservation,
  nowMs: number,
  maxAgeMs: number,
): void {
  const price = new Decimal(observation.priceUsd);
  if (!price.isFinite() || price.lte(0)) throw new Error('Price must be positive');
  const observedAt = Date.parse(observation.observedAt);
  if (!Number.isFinite(observedAt) || nowMs - observedAt > maxAgeMs || observedAt > nowMs) {
    throw new Error('Price observation is stale or invalid');
  }
}

export function gasCostUsd(input: {
  gasUnits: bigint;
  maxFeePerGas: bigint;
  nativeDecimals: number;
  nativeUsd: string;
}): string {
  const nativeUsd = new Decimal(input.nativeUsd);
  if (!nativeUsd.isFinite() || nativeUsd.lte(0)) throw new Error('Native USD price must be positive');
  if (input.gasUnits < 0n || input.maxFeePerGas < 0n) throw new Error('Gas values must be non-negative');
  if (!Number.isInteger(input.nativeDecimals) || input.nativeDecimals < 0) {
    throw new Error('Native decimals must be a non-negative integer');
  }

  return new Decimal(input.gasUnits.toString())
    .times(input.maxFeePerGas.toString())
    .div(new Decimal(10).pow(input.nativeDecimals))
    .times(nativeUsd)
    .toDecimalPlaces(8, Decimal.ROUND_UP)
    .toFixed();
}

export function createLifiPriceProvider(fetcher: typeof fetch = fetch): {
  getPrice(chainId: number, token: string): Promise<PriceObservation>;
} {
  return {
    async getPrice(chainId, token) {
      let response: Response;
      try {
        const url = new URL('https://li.quest/v1/token');
        url.searchParams.set('chain', String(chainId));
        url.searchParams.set('token', token);
        response = await fetcher(url);
      } catch {
        throw new Error('LI.FI token-price network request failed');
      }
      if (!response.ok) throw new Error(`LI.FI token-price request failed with HTTP ${response.status}`);
      const body = (await response.json()) as { priceUSD?: unknown };
      if (typeof body.priceUSD !== 'string') throw new Error('LI.FI token price is missing');
      const observation = { observedAt: new Date().toISOString(), priceUsd: body.priceUSD };
      assertFreshPrice(observation, Date.now(), 60_000);
      return observation;
    },
  };
}
