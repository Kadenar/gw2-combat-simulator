import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  applyFluidStrikes,
  applyHardToCatch,
  applyLeadAttacks,
  applyUpperHand
} from '#gw2/professions/thief/core/traits/behavior.js';
import {
  applyUnrelentingStrikes,
  noQuarterCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-boons.js';
import { applyAlliedLeechingVenoms, applyLeechingVenoms } from '#gw2/professions/thief/core/traits/leeching-venoms.js';
import {
  applyDeadlyAmbition,
  applyLotusPoison,
  applyPanicStrike,
  applyPanicStrikePoison
} from '#gw2/professions/thief/core/traits/poison.js';
import type { ThiefResolverContext, ThiefSkill } from '#gw2/professions/thief/types.js';

const noQuarter = criticalProcHandler(noQuarterCriticalReaction);

function resolverContext(runtime: ThiefRuntime): ThiefResolverContext {
  return runtime;
}

/** Movement skills open Fluid Strikes' window and grant Hard to Catch's endurance. */
function movementTraits(runtime: ThiefRuntime): void {
  applyFluidStrikes(runtime);
  applyHardToCatch(runtime);
}

/** Completion-time trait state: dodge, initiative-spend, and movement traits. */
export function completeThiefCastTraits(runtime: ThiefRuntime, cast: RuntimeCast, committed: boolean): void {
  if (!committed) return;
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) applyUpperHand(runtime);
  applyLeadAttacks(runtime, cast);
  if ((cast.skill as ThiefSkill).movementSkill) movementTraits(runtime);
}

/** Landed strikes drive critical Fury traits, Deadly Arts, venoms, and Shadow Arts siphons in their established order. */
export function reactThiefCoreDamage(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  details: Record<string, unknown>
): void {
  const context = resolverContext(runtime);
  const resolved = details as unknown as NativeResolvedDamageDetails;
  applyUnrelentingStrikes(context, event, resolved);
  noQuarter(context, event, resolved);
  applyDeadlyAmbition(context, event);
  // Multiple venom types consume their charges but share one siphon per player strike.
  if (applyActiveVenoms(context, event) > 0) applyLeechingVenoms(context, event);
  applyPanicStrike(context, event);
}

/** Applied conditions drive Lotus Poison, allied Leeching Venoms, Panic Strike, Cloaked in Shadow, then the skill bonus. */
export function reactThiefCoreCondition(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  const context = resolverContext(runtime);
  applyLotusPoison(context, application);
  applyAlliedLeechingVenoms(context, application);
  applyPanicStrikePoison(context, application);
}
