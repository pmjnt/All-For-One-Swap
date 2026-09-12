import { describe, expect, it } from 'vitest';

import { isMonotonicHistory, journalSchema, planSchema } from '../../src/domain/schemas.js';
import { validJournal, validPlan } from '../support/factories.js';

describe('persisted schemas', () => {
  it('does not expose a private-key field in the strict plan schema', () => {
    expect(planSchema.keyof().safeParse('privateKey').success).toBe(false);
  });

  it('accepts forward journal histories', () => {
    expect(
      isMonotonicHistory([
        'READY',
        'SUBMITTED',
        'CONFIRMED',
        'BRIDGE_PENDING',
        'COMPLETED',
      ]),
    ).toBe(true);
  });

  it('rejects a backward journal transition', () => {
    expect(isMonotonicHistory(['SUBMITTED', 'READY'])).toBe(false);
  });

  it('allows failure only as a terminal transition', () => {
    expect(isMonotonicHistory(['READY', 'FAILED'])).toBe(true);
    expect(isMonotonicHistory(['READY', 'FAILED', 'READY'])).toBe(false);
  });

  it('accepts the shared valid plan and journal fixtures', () => {
    expect(planSchema.parse(validPlan())).toEqual(validPlan());
    expect(journalSchema.parse(validJournal())).toEqual(validJournal());
  });
});
