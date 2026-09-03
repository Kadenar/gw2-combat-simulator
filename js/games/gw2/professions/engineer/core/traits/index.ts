/** Public Core Engineer trait dispatcher preserving cross-line reaction order. */
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/state-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';
import { applyHgh, observeEngineerHghEvent } from '#gw2/professions/engineer/core/traits/alchemy.js';
import {
  engineerCoreCriticalHitDefinitions,
  applyHematicFocus,
  applySanguineArray,
  applyThermalVision
} from '#gw2/professions/engineer/core/traits/firearms.js';
import {
  applyAimAssistedRocket,
  applyExplosiveEntrance,
  applyExplosiveTemper,
  applyGrandEntrance,
  applyGrenadier,
  applyShrapnel,
  applyShortFuse,
  applySteelPackedPowder,
  resetExplosiveEntrance
} from '#gw2/professions/engineer/core/traits/explosives.js';
import {
  applyEngineerToolbeltTraits,
  applyStreamlinedKits,
  isEngineerToolbeltSkill,
  recordStaticDischargeProc
} from '#gw2/professions/engineer/core/traits/tools.js';

export {
  applyEngineerToolbeltTraits,
  engineerCoreCriticalHitDefinitions,
  isEngineerToolbeltSkill,
  observeEngineerHghEvent
};

function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === 'Heal' || skill?.slot === 'Heal';
}

/** Dispatches completed casts without regrouping the cross-line gameplay order. */
export function applyEngineerCastTraits(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  if (isHealingSkill(skill)) applyGrenadier(context, skill, at);
  applyStreamlinedKits(context, skill, at);
  applyEngineerToolbeltTraits(context, skill, at);
  applyHgh(context, skill, at);
}

// Keep shared explosion classification here so every later Explosives reaction consumes the same result.
function isExplosion(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.explosion || event.damageKind === 'explosion') return true;
  const skill = resolverSkill(context, event.skillId ?? event.sourceId);
  return Boolean(
    skill?.categories?.some((category) => String(category).toLowerCase() === 'explosion') ||
    skill?.kit === 'Grenade Kit' ||
    skill?.id === ID.DEVASTATOR
  );
}

/** Preserves the registered dodge handler identity while delegating the trait-owned reset. */
export function handleEngineerDodge(context: EngineerResolverContext): void {
  resetExplosiveEntrance(context);
}

/** Dispatches damage reactions in their established causal order. */
export function reactToEngineerDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  _details: EngineerResolverReactionDetails = {}
): void {
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
