import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { planSchema, type PlanV1 } from '../domain/schemas.js';
import { redact } from '../security/redact.js';
import { writeJsonAtomic } from './atomic-json.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['id', 'createdAt', 'expiresAt', 'updatedAt'].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function computePlanId(plan: PlanV1): string {
  const canonical = JSON.stringify(canonicalize(plan));
  return createHash('sha256').update(canonical).digest('hex');
}

export async function savePlan(path: string, input: PlanV1): Promise<PlanV1> {
  const parsed = planSchema.parse(input);
  const plan = planSchema.parse({ ...parsed, id: computePlanId(parsed) });
  await writeJsonAtomic(path, redact(plan));
  return plan;
}

export async function loadPlan(path: string): Promise<PlanV1> {
  return planSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
