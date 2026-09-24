import { isInternalCooldownReady } from '#kernel/core/clock.js';

export interface CriticalOpportunity {
  readonly sampledCriticals: number;
}

export interface CriticalProcState {
  readyAt: number;
}

export interface CriticalProcRequest {
  readonly id: string;
  readonly at: number;
  readonly chanceOnCriticalHit?: number;
  readonly internalCooldown?: number;
  readonly randomStream?: string;
  readonly roll?: (chance: number, stream: string) => boolean;
}

export interface CriticalProcApplication {
  readonly quantity: number;
}

function finiteNonNegative(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number.`);
  return number;
}

/** Both simulation modes consume the same seeded hit fact; aggregated packets share their critical outcome. */
export function criticalOpportunity(
  chance: number,
  didCrit: boolean | undefined,
  opportunities = 1
): CriticalOpportunity {
  const count = finiteNonNegative(opportunities, 'Critical opportunities');
  const criticalChance = finiteNonNegative(chance, 'Critical chance');
  if (!Number.isInteger(count)) throw new TypeError('Critical opportunities must be an integer.');
  if (criticalChance > 1) throw new TypeError('Critical chance must be 0..1.');
  if (criticalChance > 0 && typeof didCrit !== 'boolean') {
    throw new TypeError('Critical opportunity requires a sampled critical outcome.');
  }

  return Object.freeze({ sampledCriticals: criticalChance > 0 && didCrit ? count : 0 });
}

/** Claim an ICD before emitting effects, rolling only a trait's separate chance after the shared critical hit. */
export function advanceCriticalProc(
  opportunity: CriticalOpportunity,
  request: CriticalProcRequest,
  state?: CriticalProcState
): CriticalProcApplication | null {
  const criticals = finiteNonNegative(opportunity.sampledCriticals, `${request.id} sampled criticals`);
  if (!Number.isInteger(criticals)) throw new TypeError(`${request.id} sampled criticals must be an integer.`);
  const chance = finiteNonNegative(request.chanceOnCriticalHit ?? 1, `${request.id} critical proc chance`);
  if (chance > 1) throw new TypeError(`${request.id} critical proc chance must be 0..1.`);
  const cooldown = finiteNonNegative(request.internalCooldown ?? 0, `${request.id} internal cooldown`);
  if (request.internalCooldown != null) {
    if (!state || typeof state.readyAt !== 'number' || Number.isNaN(state.readyAt)) {
      throw new TypeError(`${request.id} internal cooldown requires a numeric deadline.`);
    }

    if (!isInternalCooldownReady(request.at, state.readyAt)) return null;
  }

  if (!criticals || !chance) return null;
  let quantity = criticals;
  if (chance < 1) {
    if (!request.roll) throw new TypeError(`${request.id} secondary chance requires a roll function.`);
    quantity = 0;
    for (let hit = 0; hit < criticals; hit += 1) {
      if (request.roll(chance, request.randomStream || request.id)) quantity += 1;
    }
  }

  if (!quantity) return null;
  if (request.internalCooldown != null) {
    quantity = 1;
    state!.readyAt = request.at + cooldown;
  }

  return Object.freeze({ quantity });
}
