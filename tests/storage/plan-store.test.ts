import { describe, expect, it } from 'vitest';

import { computePlanId } from '../../src/storage/plan-store.js';
import { validPlan } from '../support/factories.js';

describe('computePlanId', () => {
  it('is stable across volatile timestamps and object key insertion order', () => {
    const first = validPlan({ id: 'ignored', createdAt: '2026-09-12T00:00:00.000Z' });
    const second = validPlan({ id: 'also-ignored', createdAt: '2026-09-12T00:01:00.000Z' });
    expect(computePlanId(first)).toBe(computePlanId(second));
  });
});
