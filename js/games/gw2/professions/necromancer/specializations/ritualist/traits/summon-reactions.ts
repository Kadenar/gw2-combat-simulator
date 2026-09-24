import { refreshResource, type ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import { necromancerLifeForce, leaveShroud } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  gainNecromancerLifeForce,
  registerCreatureSummonReaction,
  registerNecromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';

function applyRitualistCreatureSummonTraits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count: number
): void {
  if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    gainNecromancerLifeForce(
      context,
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.boonOfCreation), 'lifeForceGain') * count,
      at
    );
  }

  if (!hasTrait(context, TRAIT.EXPLOSIVE_GROWTH)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.explosiveGrowth);
  const explosive = requireEffect(profile, 'strike', 'Strike');
  if (!explosive) return;
  emitSkillDamage(context, skill, {
    at,
    name: 'Explosive Growth',
    source: 'Trait',
    sourceId: TRAIT.EXPLOSIVE_GROWTH,
    actorType: 'effect',
    skillId: TRAIT.EXPLOSIVE_GROWTH,
    skillName: 'Explosive Growth',
    parentSkillName: skill.name,
    triggeredBy: skill.name,
    coefficient: effectNumber(profile, explosive, 'coefficient') * count,
    skillWeapon: 'Unequipped'
  });
}

/** Registers every trait-gated reaction that changes Ritualist summon lifetime or output. */
export function initializeRitualistSummonTraits(context: NecromancerSchedulerContext): void {
  registerCreatureSummonReaction(context, 'ritualist.creature-summon-traits', applyRitualistCreatureSummonTraits);
  registerNecromancerCreatureStrikeMultiplier(context, 'ritualist.spirits-strength', (castContext) =>
    hasTrait(castContext, TRAIT.SPIRITS_STRENGTH) ? 1.5 : 1
  );
  registerNecromancerShroudLifecycle(context, 'ritualist.shroud', {
    onEnter: (runtime, skill) => {
      if (skill.shroudEntry !== 'ritualist') return;
      const state = ritualistState.from(runtime);
      state.resummonedSpiritAutoCycle = Object.keys(state.activeSpirits).length > 0;
      state.spiritAutoAnchorAt = Number.NaN;
      state.soulTwistingAvailable = hasTrait(runtime, TRAIT.SOUL_TWISTING);
    },
    onExit: (runtime) => {
      if (hasTrait(runtime, TRAIT.LINGERING_SPIRITS)) return;
      ritualistState.from(runtime).activeSpirits = {};
    }
  });
}

/** Refunds the first completed spirit summon after Soul Twisting is armed. */
export function refundRitualistSoulTwisting(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (castWasInterrupted(context)) return;
  const state = ritualistState.from(context);
  if (state.pendingSoulTwistSkill !== skill.id) return;
  context.cooldownController.clear(skill.id);
  delete state.pendingSoulTwistSkill;
}

/** Emits Empowering Spirits boons only when its owning trait is selected. */
export function emitEmpoweringSpirits(context: NecromancerCastContext, skill: NecromancerSkill, key: string): void {
  if (!hasTrait(context, TRAIT.EMPOWERING_SPIRITS)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.empoweringSpirits);
  const boonOptions = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
  // Quickness plus the summoned spirit's own boon; each is named, so removing one never substitutes another.
  const spiritBoon =
    key === 'anguish' ? 'might' : key === 'wanderlust' ? 'fury' : key === 'preservation' ? 'resolution' : null;
  for (const name of spiritBoon ? ['quickness', spiritBoon] : ['quickness']) {
    const boon = requireEffect(profile, 'boon', name);
    if (!boon) continue;
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: String(boon.boon),
      duration: effectNumber(profile, boon, 'duration'),
      stacks: effectNumber(profile, boon, 'stacks'),
      ...boonOptions
    });
  }
}

/** Lingering Spirits keep draining after shroud; exhaustion removes spirits once without re-entering the form. */
export const ritualistLifeForceDepletion = resourceDepletion({
  id: 'necromancer.ritualist-life-force-depleted',
  priority: -300,
  clock: (context: NecromancerSchedulerContext) => professionCoreState(context).lifeForce,
  depleted(context: NecromancerSchedulerContext, at: number) {
    if (professionCoreState(context).activeShroud) leaveShroud(context, at, 'life-force-depleted');
    ritualistState.from(context).activeSpirits = {};
    refreshResource(context, 'lifeForce');
    // The resource observation carries only life force, so spirit removal needs its own transition.
    emitNecromancerStateSnapshot(context, at, 'spirits-depleted', { dedupeAcrossSourceIds: true });
  }
});
export const ritualistLifeForce: ResourcePolicy<NecromancerSchedulerContext> = {
  ...necromancerLifeForce,
  depletion: ritualistLifeForceDepletion,
  recovery(context) {
    const core = professionCoreState(context);
    if (
      !core.activeShroud &&
      Object.keys(ritualistState.from(context).activeSpirits).length &&
      hasTrait(context, TRAIT.LINGERING_SPIRITS)
    )
      return (
        (-core.lifeForce.maximum *
          balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'lifeForceDrain')) /
        100
      );
    return necromancerLifeForce.recovery(context);
  }
};
