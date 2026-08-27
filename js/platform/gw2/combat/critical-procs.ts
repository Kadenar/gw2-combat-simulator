import { isInternalCooldownReady } from '../../engine/core/clock.js';

export type CriticalProcMaterialization = 'threshold' | 'weighted';

export interface CriticalOpportunity {
  readonly expectedCriticals: number;
  readonly sampledCriticals?: number;
}

export interface CriticalProcState {
  progress: number;
  readyAt: number;
}

export interface CriticalProcRequest {
  readonly id: string;
  readonly at: number;
  readonly stochastic: boolean;
  readonly chanceOnCriticalHit?: number;
  readonly materialization?: CriticalProcMaterialization;
  readonly internalCooldown?: number;
  readonly progressDuringCooldown?: 'ignore' | 'accumulate';
  readonly randomStream?: string;
  readonly roll?: (chance: number, stream: string) => boolean;
}

export interface CriticalProcApplication {
  readonly quantity: number;
  readonly kind: 'sampled' | 'threshold' | 'weighted';
}

export const CRITICAL_PROC_PROGRESS_TOLERANCE = 1e-9;

function finiteNonNegative(value: unknown, label: string): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${label} must be a finite non-negative number.`);
  }

  return number;
}

function procChance(value: unknown, id: string): number {
  const chance = Number(value ?? 1);

  if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
    throw new TypeError(`${id} critical proc chance must be 0..1.`);
  }

  return chance;
}

function validateState(state: CriticalProcState | undefined, id: string): CriticalProcState {
  if (!state) throw new TypeError(`${id} threshold critical proc requires state.`);

  if (!Number.isFinite(state.progress) || state.progress < 0) {
    throw new TypeError(`${id} critical proc progress must be a finite non-negative number.`);
  }

  if (Number.isNaN(Number(state.readyAt))) {
    throw new TypeError(`${id} critical proc readyAt must be numeric.`);
  }

  return state;
}

/**
 * Normalizes one event's critical facts for the shared proc kernel. Aggregated
 * hits preserve their existing all-or-none sampled result while deterministic
 * mode advances by the expected critical count.
 */
export function criticalOpportunity(chance: number, didCrit?: boolean, opportunities = 1): CriticalOpportunity {
  const count = finiteNonNegative(opportunities, 'Critical opportunities');
  return Object.freeze({
    expectedCriticals: finiteNonNegative(chance, 'Critical chance') * count,
    ...(typeof didCrit === 'boolean' ? { sampledCriticals: didCrit ? count : 0 } : {})
  });
}

/**
 * Advances one isolated critical-proc tracker from canonical hit facts so
 * resolver and scheduler mechanics share RNG, progress, tolerance, and ICD
 * behavior without sharing profession effects or state ownership.
 */
export function advanceCriticalProc(
  opportunity: CriticalOpportunity,
  request: CriticalProcRequest,
  suppliedState?: CriticalProcState
): CriticalProcApplication | null {
  // Normalize caller-owned inputs once so every profession gets the same
  // validation and default one-proc-per-critical behavior.
  const expectedCriticals = finiteNonNegative(opportunity.expectedCriticals, `${request.id} expected criticals`);
  const chanceOnCriticalHit = procChance(request.chanceOnCriticalHit, request.id);
  const materialization = request.materialization || 'threshold';
  const hasInternalCooldown = request.internalCooldown != null;
  const internalCooldown = hasInternalCooldown
    ? finiteNonNegative(request.internalCooldown, `${request.id} internal cooldown`)
    : 0;
  const state =
    materialization === 'threshold' || hasInternalCooldown ? validateState(suppliedState, request.id) : suppliedState;

  // Weighted applications cannot express a single ICD winner without turning
  // the fractional result into threshold state, so reject that ambiguous mix.
  if (materialization === 'weighted' && internalCooldown > 0) {
    throw new TypeError(`${request.id} weighted critical proc cannot use an internal cooldown.`);
  }

  if (!(chanceOnCriticalHit > 0) || !(expectedCriticals > 0)) return null;

  const onCooldown = hasInternalCooldown && !isInternalCooldownReady(request.at, state?.readyAt);

  if (onCooldown) {
    // Most mechanics discard opportunities while unavailable. The explicit
    // accumulate mode preserves legacy deterministic traits that bank progress.
    if (!request.stochastic && materialization === 'threshold' && request.progressDuringCooldown === 'accumulate') {
      state!.progress += expectedCriticals * chanceOnCriticalHit;
    }

    return null;
  }

  if (request.stochastic) {
    // Stochastic mode must consume the resolver or scheduler's canonical crit
    // result; sampling it again here would let separate traits disagree.
    if (opportunity.sampledCriticals == null) {
      throw new TypeError(`${request.id} stochastic critical proc requires sampled criticals.`);
    }

    const sampledCriticals = finiteNonNegative(opportunity.sampledCriticals, `${request.id} sampled criticals`);

    if (!Number.isInteger(sampledCriticals)) {
      throw new TypeError(`${request.id} sampled criticals must be an integer.`);
    }

    let quantity = sampledCriticals;

    if (chanceOnCriticalHit < 1 && quantity > 0) {
      // A trait-specific chance is a second roll for each confirmed critical,
      // isolated on the declaration's stable random stream.
      if (typeof request.roll !== 'function') {
        throw new TypeError(`${request.id} stochastic secondary chance requires a roll function.`);
      }

      quantity = 0;
      for (let critical = 0; critical < sampledCriticals; critical += 1) {
        if (request.roll(chanceOnCriticalHit, request.randomStream || request.id)) quantity += 1;
      }
    }

    if (!(quantity > 0)) return null;

    if (hasInternalCooldown) {
      // One event can win an ICD only once even when it represents multiple
      // critical hits; subsequent hits are unavailable at the same timestamp.
      quantity = 1;
      state!.readyAt = request.at + internalCooldown;
    }

    return Object.freeze({ quantity, kind: 'sampled' });
  }

  const expectedQuantity = expectedCriticals * chanceOnCriticalHit;

  if (materialization === 'weighted') {
    // Weighted consumers apply the fractional expectation directly and do not
    // retain cross-event progress.
    return Object.freeze({ quantity: expectedQuantity, kind: 'weighted' });
  }

  // Threshold consumers retain fractional expectation until a whole proc is
  // earned. The tolerance prevents floating-point drift from missing a proc.
  const progress = state!.progress + expectedQuantity;
  let quantity = Math.floor(progress + CRITICAL_PROC_PROGRESS_TOLERANCE);

  if (!(quantity > 0)) {
    state!.progress = progress;
    return null;
  }

  if (hasInternalCooldown) {
    // An ICD materializes one proc and preserves any deterministic remainder;
    // without an ICD, every whole proc accumulated by this event is emitted.
    quantity = 1;
    state!.progress = Math.max(0, progress - 1);
    state!.readyAt = request.at + internalCooldown;
  } else {
    state!.progress = Math.max(0, progress - quantity);
  }

  return Object.freeze({ quantity, kind: 'threshold' });
}
