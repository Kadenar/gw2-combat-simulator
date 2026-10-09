import { emitAimAssistedRocket } from '#gw2/professions/engineer/core/skills/trait-skills.js';
import { type EngineerResolverContext, type EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { type Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import { advanceCyclicCounter } from '#gw2/platform/combat/resources/counters.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

// Only player packets with authored projectile identity can trigger Aim-Assisted Rocket.
function isAimAssistedProjectile(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType !== 'player') return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'projectile'));
}

/** Queues Aim-Assisted Rocket, upgrading every fifth eligible proc to Orbital Command Strike. */
export function applyAimAssistedRocket(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Accepted projectile procs consume recharge and advance the cycle even if their payload is removed.
  if (
    !hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) ||
    !isAimAssistedProjectile(context, event) ||
    !context.procs.claim(TRAIT.AIM_ASSISTED_ROCKET, 'aimAssistedRocket', event.at)
  ) {
    return;
  }

  const aimAssistedRocketProfile = requireBalanceProfileFromContext(context, TRAIT.AIM_ASSISTED_ROCKET);
  const core = professionCoreState(context);
  const alternateEvery = balanceProfileNumber(aimAssistedRocketProfile, 'maximumStacks');
  // Count only accepted procs and preserve the cumulative total used to select each orbital strike.
  const progress = advanceCyclicCounter(core.aimAssistedRocketCount, 1, alternateEvery);
  core.aimAssistedRocketCount = progress.value;
  emitAimAssistedRocket(context, event, progress.reached);
}

/** Applies Explosive Temper at the live attribute boundary while preserving build provenance. */
export function applyExplosiveTemperAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
    modified.ferocity =
      (modified.ferocity || 0) +
      activeBuffStacks(context, 'explosive-temper', balanceProfileNumber(explosiveTemperProfile, 'maximumStacks')) *
        balanceProfileNumber(explosiveTemperProfile, 'attributePerStack');
  }
}
