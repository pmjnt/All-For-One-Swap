import { describe, expect, it, vi } from 'vitest';

import safe from '../fixtures/lifi/routes-safe.json' with { type: 'json' };
import {
  createLifiRouteProvider,
  createLifiStatusProvider,
  normalizeLifiRoutes,
} from '../../src/providers/lifi.js';
import { TEST_WALLET } from '../support/factories.js';

describe('normalizeLifiRoutes', () => {
  it('normalizes integer amounts and records deducted fees', () => {
    const [route] = normalizeLifiRoutes(safe);

    expect(typeof route?.fromAmount).toBe('bigint');
    expect(typeof route?.quotedToAmount).toBe('bigint');
    expect(route?.explicitFeeAlreadyDeducted).toBe(true);
    expect(route?.gasUsd).toBe('0.1');
  });

  it('rejects decimal on-chain amounts', () => {
    const malformed = structuredClone(safe);
    malformed.routes[0]!.fromAmount = '1.5';

    expect(() => normalizeLifiRoutes(malformed)).toThrow();
  });

  it('hydrates one route step with fresh transaction data and a local TTL', async () => {
    const rawRoutes = structuredClone(safe) as Record<string, unknown>;
    const route = (rawRoutes.routes as Array<Record<string, unknown>>)[0]!;
    const step = (route.steps as Array<Record<string, unknown>>)[0]!;
    const transactionRequest = step.transactionRequest;
    delete route.expiresAt;
    delete step.transactionRequest;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(rawRoutes), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...step, transactionRequest }), { status: 200 }),
      );
    const provider = createLifiRouteProvider(fetcher, () => Date.parse('2026-09-12T00:00:00.000Z'));

    const routes = await provider.getRoutes({
      amount: 1_000_000n,
      fromChainId: 1,
      fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      toChainId: 8453,
      toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      wallet: TEST_WALLET,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(routes[0]?.expiresAt).toBe('2026-09-12T00:00:30.000Z');
  });
});

describe('createLifiStatusProvider', () => {
  it('normalizes destination transaction evidence', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'DONE', receiving: { txHash: '0x1234' },
    }), { status: 200 }));
    const provider = createLifiStatusProvider(fetcher);
    await expect(provider.status({
      bridge: 'across', fromChainId: 1, sourceTxHash: '0xabcd', toChainId: 8453,
    })).resolves.toEqual({ status: 'DONE', destinationTxHash: '0x1234' });
  });
});
