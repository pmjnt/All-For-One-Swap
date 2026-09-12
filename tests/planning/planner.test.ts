import { describe, expect, it } from 'vitest';

import { selectBestRoute } from '../../src/planning/planner.js';
import { validRoute } from '../support/factories.js';

describe('selectBestRoute', () => {
  it('selects the allowed candidate with maximal net USD', () => {
    const weak = validRoute({ id: 'weak', gasUsd: '0.30' });
    const best = validRoute({ id: 'best', gasUsd: '0.10' });
    const result = selectBestRoute({
      minNetUsd: '0.25',
      outputUsd: () => '1.00',
      routes: [weak, best],
      routePolicy: { maxSlippageBps: 100, now: Date.parse('2026-09-12T00:00:00.000Z') },
    });
    expect(result.state).toBe('READY');
    if (result.state === 'READY') expect(result.route.id).toBe('best');
  });

  it('skips holdings below the configured net threshold', () => {
    const result = selectBestRoute({
      minNetUsd: '0.25',
      outputUsd: () => '0.20',
      routes: [validRoute()],
      routePolicy: { maxSlippageBps: 100, now: Date.parse('2026-09-12T00:00:00.000Z') },
    });
    expect(result).toEqual({ state: 'SKIPPED', reason: 'BELOW_MIN_NET_USD' });
  });

  it('does not rank a route that fails policy', () => {
    const result = selectBestRoute({
      minNetUsd: '0',
      outputUsd: () => '100',
      routes: [validRoute({ toolIds: ['unknown'] })],
      routePolicy: { maxSlippageBps: 100, now: Date.parse('2026-09-12T00:00:00.000Z') },
    });
    expect(result).toEqual({ state: 'SKIPPED', reason: 'NO_ALLOWED_ROUTE' });
  });
});
