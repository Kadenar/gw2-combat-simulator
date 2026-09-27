import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  reactToReaperDamage,
  reaperResolverEventReactions
} from '#gw2/professions/necromancer/specializations/reaper/mechanics/shroud-effects.js';
import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';

/** Reaper resource and recharge reactions follow landed impacts and delivered boons in the same live state. */
export const reaperHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  // Completed shouts own their siphon's targeting and diagnostic attribution.
  traitTriggers: [
    {
      trait: TRAIT.AUGURY_OF_DEATH,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Shout')),
      emit: PROFILE.auguryOfDeath,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Augury of Death',
        name: 'Augury of Death',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }
  ],
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const specialization = runtime.profession.specialization;
      if (specialization.kind !== 'Reaper') throw new TypeError('Reaper mechanics require Reaper state.');
      reactToReaperDamage(runtime, event, details);
      if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
      if (event.skillId === ID.LIFE_REAP && hasTrait(runtime, TRAIT.REAPERS_ONSLAUGHT)) {
        const reduction = balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, PROFILE.reapersOnslaught),
          'rechargeReduction'
        );
        for (const skill of runtime.helpers.skillsById.values()) {
          if (skill.shroud === 'reaper') runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
        }
      }

      if (
        hasTrait(runtime, TRAIT.CHILLING_VICTORY) &&
        runtime.query.targetHasCondition('Chilled', runtime.time, runtime)
      ) {
        const profile = requireBalanceProfileFromContext(runtime, PROFILE.chillingVictory);
        // Chilled player hits claim the profile's cooldown before granting life force.
        if (
          runtime.procs.claimCooldown(
            'necromancer.reaper.chillingVictory',
            runtime.time,
            balanceProfileNumber(profile, 'cooldown')
          )
        )
          grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
      }
    },
    'condition.applied': reaperResolverEventReactions.condition,
    'control.resolved': reaperResolverEventReactions.control,
    'buff.applied'(runtime, event) {
      // Personal statuses share this stage with boons but must not award Blighter's Boon life force.
      if (
        isStandardBoon(event.kind) &&
        event.resolvedAudience?.includesSelf &&
        hasTrait(runtime, TRAIT.BLIGHTERS_BOON)
      ) {
        grantNecromancerLifeForce(
          runtime,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.blightersBoon), 'lifeForceGain')
        );
      }
    }
  }
};
