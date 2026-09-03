import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  gainNecromancerLifeForce,
  registerCreatureSummonReaction,
  registerNecromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { syncNecromancerResources } from '#gw2/professions/necromancer/core/state.js';
import {
  registerNecromancerResourceAdvance,
  registerNecromancerShroudLifecycle
} from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

function applyRitualistCreatureSummonTraits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count: number
): void {
  if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    gainNecromancerLifeForce(
      context,
      Number(balanceProfileFromContext(context, PROFILE.boonOfCreation)?.lifeForceGain || 10) * count,
      at
    );
  }

  if (!hasTrait(context, TRAIT.EXPLOSIVE_GROWTH)) return;
  const explosive = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.explosiveGrowth), 'strike');
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
    coefficient: Number(explosive?.coefficient || 1.2) * count,
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
  registerNecromancerResourceAdvance(context, 'ritualist.lingering-spirits', (runtime, start, end) => {
    const core = professionCoreState(runtime);
    const state = ritualistState.from(runtime);
    if (core.activeShroud || !Object.keys(state.activeSpirits).length || !hasTrait(runtime, TRAIT.LINGERING_SPIRITS)) {
      return;
    }

    const drainPercent = Number(balanceProfileFromContext(runtime, PROFILE.resources)?.lifeForceDrain || 3);
    core.lifeForce = Math.max(0, core.lifeForce - core.maximumLifeForce * (drainPercent / 100) * (end - start));
    if (core.lifeForce <= runtime.epsilon) {
      core.lifeForce = 0;
      state.activeSpirits = {};
    }

    syncNecromancerResources(core);
  });
}

/** Refunds the first completed spirit summon after Soul Twisting is armed. */
export function refundRitualistSoulTwisting(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = ritualistState.from(context);
  if (state.pendingSoulTwistSkill !== skill.id) return;
  context.state.cooldowns.delete(skill.id);
  delete state.pendingSoulTwistSkill;
}

/** Emits Empowering Spirits boons only when its owning trait is selected. */
export function emitEmpoweringSpirits(context: NecromancerCastContext, skill: NecromancerSkill, key: string): void {
  if (!hasTrait(context, TRAIT.EMPOWERING_SPIRITS)) return;
  const profile = balanceProfileFromContext(context, PROFILE.empoweringSpirits);
  const quickness = balanceProfileEffect(profile, 'boon');
  const boonOptions = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: String(quickness?.boon || 'quickness'),
    duration: Number(quickness?.duration || 3.75),
    stacks: Number(quickness?.stacks || 1),
    ...boonOptions
  });
  const boonIndex = key === 'anguish' ? 1 : key === 'wanderlust' ? 2 : 3;
  const boon = balanceProfileEffect(profile, 'boon', boonIndex);
  const defaults =
    key === 'anguish'
      ? { kind: 'might', duration: 10, stacks: 8 }
      : key === 'wanderlust'
        ? { kind: 'fury', duration: 5, stacks: 1 }
        : key === 'preservation'
          ? { kind: 'resolution', duration: 4, stacks: 1 }
          : null;
  if (!defaults) return;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: String(boon?.boon || defaults.kind),
    duration: Number(boon?.duration || defaults.duration),
    stacks: Number(boon?.stacks || defaults.stacks),
    ...boonOptions
  });
}
