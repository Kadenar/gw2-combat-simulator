import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  applyHghAcidBomb,
  applyHematicFocus,
  applySanguineArray,
  applyThermalVision
} from '#gw2/professions/engineer/core/traits/behavior.js';
import {
  applyGrenadier,
  applyAimAssistedRocket,
  applyExplosiveEntrance,
  applyExplosiveTemper,
  applyGrandEntrance,
  applyShortFuse,
  applyShrapnel,
  applySteelPackedPowder
} from '#gw2/professions/engineer/core/traits/explosions.js';
import {
  applyEngineerToolbeltTraits,
  applyStreamlinedKits,
  recordStaticDischargeProc
} from '#gw2/professions/engineer/core/traits/toolbelt.js';
import type {
  EngineerSkill,
  EngineerRuntime,
  EngineerResolverContext,
  EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { isExplosion } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';

/** Dispatches completed casts without regrouping the cross-line gameplay order. */
export function applyEngineerCastTraits(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  const skill = cast.skill;
  const at = context.time;
  applyGrenadier(context, skill, at);
  applyStreamlinedKits(context, skill, at);
  // Issuing a mech command uses the tool-belt slot immediately while its animation runs independently.
  if (!skill.independentCast) applyEngineerToolbeltTraits(context, skill, at);
  applyHghAcidBomb(context, cast);
}

/** Dispatches damage reactions in their established causal order. */
export function reactToEngineerDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  recordStaticDischargeProc(context, event);
  applyExplosiveEntrance(context, event);
  const explosion = isExplosion(context, event);
  applySteelPackedPowder(context, event, explosion);
  applyShortFuse(context, event, explosion);
  applyExplosiveTemper(context, event, explosion);
  applyGrandEntrance(context, event);
  applyShrapnel(context, event, explosion);
  applyAimAssistedRocket(context, event);
}

/** Dispatches condition reactions in their established Firearms definition order. */
export function reactToEngineerCondition(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  applyThermalVision(context, event);
  applySanguineArray(context, event);
  applyHematicFocus(context, event);
}
