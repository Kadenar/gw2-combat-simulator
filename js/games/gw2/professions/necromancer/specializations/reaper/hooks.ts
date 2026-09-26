import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireEffect,
  effectNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
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
  // Augury belongs to the completed shout and uses its own siphon packet, independent of the shout's strike effects.
  onCastComplete(runtime, cast) {
    if (!castCompleted(cast) || !cast.skill.categories?.includes('Shout') || !hasTrait(runtime, TRAIT.AUGURY_OF_DEATH))
      return;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.auguryOfDeath);
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.AUGURY_OF_DEATH,
          actorType: 'effect',
          skillName: 'Augury of Death',
          triggeredBy: cast.skill.name,
          activationId: cast.id,
          offTarget: cast.command.offTarget,
          coefficient: 0,
          skillWeapon: 'Unequipped',
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
          noCrit: true,
          damageKind: 'life-steal'
        })
      );
  },
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
        for (const skill of runtime.helpers.skillsById?.values() ?? []) {
          if (skill.shroud === 'reaper') runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
        }
      }

      if (
        hasTrait(runtime, TRAIT.CHILLING_VICTORY) &&
        runtime.query.targetHasCondition('Chilled', runtime.time, runtime) &&
        isInternalCooldownReady(runtime.time, specialization.state.chillingVictoryReadyAt)
      ) {
        const profile = requireBalanceProfileFromContext(runtime, PROFILE.chillingVictory);
        specialization.state.chillingVictoryReadyAt = runtime.time + balanceProfileNumber(profile, 'cooldown');
        grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
      }
    },
    'condition.applied': reaperResolverEventReactions.condition,
    'control.resolved': reaperResolverEventReactions.control,
    'buff.applied'(runtime, event) {
      if (event.resolvedAudience?.includesSelf && hasTrait(runtime, TRAIT.BLIGHTERS_BOON)) {
        grantNecromancerLifeForce(
          runtime,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.blightersBoon), 'lifeForceGain')
        );
      }
    }
  }
};
