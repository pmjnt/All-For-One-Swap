import type { PlanV1 } from '../domain/schemas.js';
import { planSchema } from '../domain/schemas.js';
import { redact } from '../security/redact.js';

export interface PlanReport {
  plan: PlanV1;
  warnings: PlanV1['discovery']['warnings'];
}

export function renderFailure(error: unknown): string {
  return JSON.stringify(redact(error));
}

export function renderPlan(plan: PlanV1): string {
  const lines = [`Discovery: ${plan.discovery.mode}`];
  for (const warning of plan.discovery.warnings) {
    lines.push(`Warning chain ${warning.chainId} [${warning.code}]: ${warning.message}`);
  }
  for (const route of plan.routes) {
    if (route.state === 'SKIPPED') {
      lines.push(`${route.fromAsset} | SKIPPED | ${route.reason}`);
    } else {
      lines.push(
        `${route.fromAsset} -> ${route.toAsset} | READY | amount=${route.fromAmount}`
        + ` | min=${route.minToAmount} | net=$${route.netOutputUsd} | tools=${route.toolIds.join(',')}`,
      );
    }
  }
  return lines.join('\n');
}

export function renderPlanJson(plan: PlanV1): string {
  return JSON.stringify(planSchema.parse(plan));
}

export function reportPlan(result: PlanReport, write: (line: string) => void = console.log): void {
  write(renderPlan(result.plan));
}
