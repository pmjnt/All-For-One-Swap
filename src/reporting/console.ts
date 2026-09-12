import type { PlanV1 } from '../domain/schemas.js';

export interface PlanReport {
  plan: PlanV1;
  warnings: PlanV1['discovery']['warnings'];
}

export function reportPlan(result: PlanReport, write: (line: string) => void = console.log): void {
  const ready = result.plan.routes.filter((route) => route.state === 'READY').length;
  const skipped = result.plan.routes.length - ready;
  write(`Discovery: ${result.plan.discovery.mode}`);
  write(`Routes: ${ready} ready, ${skipped} skipped`);
  for (const warning of result.warnings) {
    write(`Warning chain ${warning.chainId} [${warning.code}]: ${warning.message}`);
  }
}
