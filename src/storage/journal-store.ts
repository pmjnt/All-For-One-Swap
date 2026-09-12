import { readFile } from 'node:fs/promises';

import {
  journalSchema,
  type JournalV1,
  type PersistedRouteState,
} from '../domain/schemas.js';
import { redact } from '../security/redact.js';
import { writeJsonAtomic } from './atomic-json.js';

const rank: Readonly<Partial<Record<PersistedRouteState, number>>> = {
  READY: 0,
  SUBMITTED: 1,
  CONFIRMED: 2,
  BRIDGE_PENDING: 3,
  COMPLETED: 4,
};

export function transitionRoute(
  current: PersistedRouteState,
  next: PersistedRouteState,
): PersistedRouteState {
  if (current === 'SKIPPED' || current === 'FAILED' || current === 'COMPLETED') {
    throw new Error(`Cannot transition out of terminal state ${current}`);
  }
  if (next === 'SKIPPED') throw new Error('Cannot transition an executable route to SKIPPED');
  if (next === 'FAILED') return next;
  const currentRank = rank[current];
  const nextRank = rank[next];
  if (currentRank === undefined || nextRank === undefined || nextRank < currentRank) {
    throw new Error(`Cannot transition backward from ${current} to ${next}`);
  }
  return next;
}

export async function saveJournal(path: string, input: JournalV1): Promise<void> {
  const journal = journalSchema.parse(input);
  await writeJsonAtomic(path, redact(journal));
}

export async function loadJournal(path: string): Promise<JournalV1> {
  return journalSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
